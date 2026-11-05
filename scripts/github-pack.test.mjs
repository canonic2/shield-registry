import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {githubPack, destination, validateScope} from './build-github-pack.mjs';
import {githubCases, exampleScope} from './build-github-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {compatibleDirectory} from './pack-formats.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, destination)));
test('GitHub source artifacts reproduce and scopes reject ambiguous configuration', () => {
  assert.deepEqual(read('pack.yml'), githubPack());
  assert.deepEqual(read('cases.json'), {schema_version: 1, cases: githubCases()});
  const validate = schemaValidator(schema);
  for (const doc of [read('pack.yml'), read('cases.json'), githubPack(exampleScope, 'acme/github')])
    assert.equal(validate(doc), true, JSON.stringify(validate.errors));
  assert.deepEqual(read('commands.json').commands, [{name: 'gh', rule_ids: githubPack().rules.filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]);
  for (const scope of [null, [], {repos: []}, {repositories: []}, {repositories: ['acme/*']},
    {organizations: ['acme'], repositories: ['other/web']}, {projects: [{owner: 'acme', number: '7'}]},
    {projects: [{owner: 'acme', number: 7, id: 'other'}]}, {repositories: ['acme/web', 'acme/web']}])
    assert.throws(() => validateScope(scope));
  assert.throws(() => githubPack(exampleScope), /own publisher/);
  assert.throws(() => githubPack({}, 'acme/github', 'latest'), /version/);
});

test('GitHub scope CLI produces an installable local catalog with exact artifact digests', t => {
  const owner = mkdtempSync(join(tmpdir(), 'shield-github-build-'));
  t.after(() => rmSync(owner, {recursive: true, force: true}));
  const scope = join(owner, 'scope.json');
  writeFileSync(scope, JSON.stringify(exampleScope));
  const result = spawnSync(process.execPath, [new URL('build-github-pack.mjs', import.meta.url).pathname,
    '--scope', scope, '--id', 'acme/github', '--output', join(owner, 'registry'), '--pack-version', '0.1.1'], {encoding: 'utf8', timeout: 10000});
  assert.equal(result.status, 0, result.stderr);
  const bytes = readFileSync(join(owner, 'registry', 'pack.yml'));
  const pack = JSON.parse(bytes);
  assert.deepEqual(pack, githubPack(exampleScope, 'acme/github', '0.1.1'));
  assert.deepEqual(JSON.parse(readFileSync(join(owner, 'registry', 'catalog.json'))), {schema_version: 1,
    packs: [{id: 'acme/github', version: '0.1.1', path: 'pack.yml', sha256: createHash('sha256').update(bytes).digest('hex')}]});
});

test('GitHub CLI and MCP profiles and explicit scopes use production decisions', {skip: !process.env.SHIELD_BINARY}, t => {
  const owner = mkdtempSync(join(tmpdir(), 'shield-github-'));
  t.after(() => rmSync(owner, {recursive: true, force: true}));
  const run = (pack, cases, companions = []) => {
    const packPath = join(owner, 'pack.json');
    const casesPath = join(owner, 'cases.json');
    writeFileSync(packPath, JSON.stringify(pack));
    writeFileSync(casesPath, JSON.stringify({schema_version: 1, cases}));
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', packPath, '--cases', casesPath,
      ...companions.flatMap(path => ['--with-pack', path])], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
  };
  run(githubPack(), githubCases());
  for (const integration of ['hosted', 'local', 'local-read-only']) {
    run(githubPack(exampleScope, 'acme/github'), githubCases({scope: true, id: 'acme/github', integration}));
    run(githubPack({organizations: ['acme']}, 'acme/github'), githubCases({organizations: true, id: 'acme/github', integration}));
  }
  const baseline = compatibleDirectory(['0.10.0', '0.9.0', '0.8.1'].map(version => new URL(`../packs/canonic/baseline/${version}/`, import.meta.url)));
  assert.ok(baseline, 'A current Baseline release must admit on the selected Shield.');
  const composed = githubCases({scope: true, id: 'acme/github'}).filter(c => c.name.startsWith('list-') || c.name.startsWith('other-repo-')
    || c.name.startsWith('merge-') || c.name.startsWith('api-graphql-') || c.name.startsWith('mcp-files-')
    || c.name.startsWith('jq-') || c.name.startsWith('privileged-'));
  run(githubPack(exampleScope, 'acme/github'), composed, [new URL('pack.yml', baseline).pathname]);
  run(githubPack(), githubCases().filter(c => c.name.startsWith('jq-') || c.name.startsWith('privileged-')),
    [new URL('pack.yml', baseline).pathname]);
  // All alternatives fit the production bounds even at maximum scope size.
  run(githubPack({repositories: Array.from({length: 16}, (_, i) => `acme/repo${i}`),
    projects: Array.from({length: 16}, (_, i) => ({owner: 'acme', number: i + 1}))}, 'acme/github'), [
    {name: 'last-repo', profile: 'recommended', argv: ['gh', 'issue', 'list', '-R', 'acme/repo15'], expected: 'allow'},
    {name: 'last-project', profile: 'recommended', argv: ['gh', 'project', 'view', '16', '--owner', 'acme'], expected: 'allow'},
  ]);
  // A project scope never infers issue/repository membership, and vice versa.
  for (const scope of [{repositories: ['acme/web']}, {projects: [{owner: 'acme', number: 7}]}]) {
    const projectOnly = Boolean(scope.projects);
    run(githubPack(scope, 'acme/github'), ['loose', 'recommended', 'strict'].flatMap(profile => [
      {name: `repo-${profile}`, profile, argv: ['gh', 'issue', 'list', '-R', 'acme/web'], expected: projectOnly ? 'deny' : profile === 'strict' ? 'ask' : 'allow'},
      {name: `project-${profile}`, profile, argv: ['gh', 'project', 'view', '7', '--owner', 'acme'], expected: projectOnly ? profile === 'strict' ? 'ask' : 'allow' : 'deny'},
    ]));
  }
  // Shell batches retain a refusal for a disallowed second target.
  run(githubPack(exampleScope, 'acme/github'), ['loose', 'recommended', 'strict'].map(profile => ({name: `shell-${profile}`, profile, expected: 'deny',
    input: {kind: 'shell', source: 'gh issue list -R acme/web; gh issue list -R outside/web', dialect: 'posix', dialect_version: null, original_input: {}}})));
  for (const [scope, id] of [[{}, 'canonic/github'], [exampleScope, 'acme/github']]) {
    const scoped = Object.keys(scope).length > 0;
    run(githubPack(scope, id), ['loose', 'recommended', 'strict'].flatMap(profile => [
      {name: `shell-jq-${profile}`, profile, expected: scoped || profile === 'strict' ? 'deny' : 'ask',
        input: {kind: 'shell', source: 'gh issue list -R acme/web --json number --jq env', dialect: 'posix', dialect_version: null, original_input: {}}},
      {name: `shell-delete-${profile}`, profile, expected: scoped || profile !== 'loose' ? 'deny' : 'ask',
        input: {kind: 'shell', source: 'gh release --repo=acme/web delete v1 --yes', dialect: 'posix', dialect_version: null, original_input: {}}},
      {name: `shell-merge-variant-${profile}`, profile, expected: scoped || profile !== 'loose' ? 'deny' : 'ask',
        input: {kind: 'shell', source: 'gh pr -Racme/web merge fix -s', dialect: 'posix', dialect_version: null, original_input: {}}},
      {name: `shell-issue-url-${profile}`, profile, expected: scoped || profile !== 'loose' ? 'deny' : 'ask',
        input: {kind: 'shell', source: 'gh issue delete https://github.com/acme/web/issues/12 --yes', dialect: 'posix', dialect_version: null, original_input: {}}},
    ]));
  }
});

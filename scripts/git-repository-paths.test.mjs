import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {editorRevision, gitRepositoryPathFixtureCases, gitRepositoryPathPack,
  repositoryPathRevision} from './build-git-allow-by-default.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {checkPublication, digest} from './registry-release.mjs';

const previous = new URL(`../packs/canonic/git/${editorRevision}/`, import.meta.url);
const current = new URL(`../packs/canonic/git/${repositoryPathRevision}/`, import.meta.url);
const read = (directory, file) => JSON.parse(readFileSync(new URL(file, directory)));

test('Git repository path candidate preserves the prior commands and fixtures', async () => {
  const pack = read(current, 'pack.yml');
  const cases = read(current, 'cases.json');
  assert.deepEqual(pack, await gitRepositoryPathPack());
  assert.deepEqual(cases, {schema_version: 1, cases: gitRepositoryPathFixtureCases()});
  assert.deepEqual(read(current, 'commands.json'), read(previous, 'commands.json'));
  const old = read(previous, 'pack.yml');
  assert.deepEqual(pack.rules.slice(0, -2), old.rules);
  assert.deepEqual(pack.invocations, old.invocations);
  assert.deepEqual(pack.preconditions, old.preconditions);
  const previousCases = read(previous, 'cases.json').cases;
  assert.deepEqual(cases.cases.slice(0, previousCases.length), previousCases);
  const validate = schemaValidator(schema);
  for (const document of [pack, cases])
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
});

test('Git preserves the authenticated 0.12.1 release and its companion files', async () => {
  const published = new URL('../public/', import.meta.url);
  const key = readFileSync(new URL('../keys/main.pub', import.meta.url), 'utf8').trim();
  const catalog = await checkPublication(published.pathname, key);
  const entry = catalog.releases.find(pack => pack.id === 'canonic/git' && pack.version === editorRevision);
  assert.ok(entry, `authenticated Git ${editorRevision} release`);
  assert.equal(digest(readFileSync(new URL('pack.yml', previous))), entry.sha256);
  for (const name of ['pack.yml', 'cases.json', 'commands.json', 'README.md', 'LICENSE'])
    assert.deepEqual(readFileSync(new URL(name, previous)),
      readFileSync(new URL(`packs/canonic/git/${editorRevision}/${name}`, published)), name);
});

function checkCases(cases, cwd) {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack',
    '--pack', new URL('pack.yml', current).pathname, '--cases', cases], {
    cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
  });
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
}

test('Production Shield decides Git repository path cases in all profiles',
  {skip: !process.env.SHIELD_BINARY}, () => checkCases(new URL('cases.json', current).pathname));

test('Production Shield resolves real paths and reviews Git directory pointers',
  {skip: !process.env.SHIELD_BINARY}, t => {
    const fixture = realpathSync(mkdtempSync(join(tmpdir(), 'shield-git-paths-')));
    t.after(() => rmSync(fixture, {recursive: true, force: true}));
    const workspace = join(fixture, 'workspace');
    const gitDir = join(workspace, '.git');
    const outside = join(fixture, 'outside');
    mkdirSync(gitDir, {recursive: true});
    mkdirSync(outside);
    writeFileSync(join(workspace, 'gitfile'), `gitdir: ${outside}\n`);
    const scenarios = [
      ['absolute-project-paths', [`--git-dir=${gitDir}`, `--work-tree=${workspace}`], 'allow'],
      ['absolute-outside-path', [`--git-dir=${outside}`], 'ask'],
      ['git-directory-pointer', ['--git-dir=gitfile'], 'ask'],
    ];
    // Windows junctions also exercise resolution without requiring symlink privileges.
    symlinkSync(gitDir, join(workspace, 'inside-link'), 'junction');
    symlinkSync(outside, join(workspace, 'outside-link'), 'junction');
    scenarios.push(
      ['internal-link', ['--git-dir=inside-link'], 'allow'],
      ['outside-git-dir-link', ['--git-dir=outside-link'], 'ask'],
      ['outside-work-tree-link', ['--git-dir=.git', '--work-tree=outside-link'], 'ask'],
    );
    const cases = scenarios.map(([name, selectors, expected]) => ({
      name, profile: 'recommended', argv: ['git', ...selectors, 'log', '--oneline'], expected,
    }));
    const file = join(fixture, 'cases.json');
    writeFileSync(file, JSON.stringify({schema_version: 1, cases}));
    checkCases(file, workspace);
  });

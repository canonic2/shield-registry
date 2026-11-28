import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {editorRevision, gitRepositoryPathFixtureCases, gitRepositoryPathPack,
  gitTreeRepositoryPathFixtureCases, gitTreeRepositoryPathPack, repositoryPathRevision,
  treeRepositoryPathRevision} from './build-git-allow-by-default.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {checkPublication, digest} from './registry-release.mjs';

const directory = version => new URL(`../packs/canonic/git/${version}/`, import.meta.url);
const current = directory(treeRepositoryPathRevision);
const read = (directory, file) => JSON.parse(readFileSync(new URL(file, directory)));

for (const [version, previousVersion, buildPack, buildCases] of [
  [repositoryPathRevision, editorRevision, gitRepositoryPathPack, gitRepositoryPathFixtureCases],
  [treeRepositoryPathRevision, repositoryPathRevision, gitTreeRepositoryPathPack, gitTreeRepositoryPathFixtureCases],
]) {
  test(`Git ${version} reproduces and preserves the prior commands and fixtures`, async () => {
    const source = directory(version);
    const previous = directory(previousVersion);
    const pack = read(source, 'pack.yml');
    const cases = read(source, 'cases.json');
    assert.deepEqual(pack, await buildPack());
    assert.deepEqual(cases, {schema_version: 1, cases: buildCases()});
    assert.deepEqual(read(source, 'commands.json'), read(previous, 'commands.json'));
    const old = read(previous, 'pack.yml');
    assert.deepEqual(pack.rules.slice(0, -2), old.rules);
    assert.deepEqual(pack.invocations, old.invocations);
    assert.deepEqual(pack.preconditions, old.preconditions);
    const previousCases = read(previous, 'cases.json').cases;
    assert.deepEqual(cases.cases.slice(0, previousCases.length), previousCases);
    const validate = schemaValidator(schema);
    for (const document of [pack, cases])
      assert.equal(validate(document), true, JSON.stringify(validate.errors));
    const manifest = read(import.meta.url, '../release.json');
    assert.equal(manifest.packs.filter(path => path === `packs/canonic/git/${version}/pack.yml`).length, 1);
  });
}

test('Git preserves authenticated 0.12.1 and 0.12.2 releases and their companion files', async () => {
  const published = new URL('../public/', import.meta.url);
  const key = readFileSync(new URL('../keys/main.pub', import.meta.url), 'utf8').trim();
  const catalog = await checkPublication(published.pathname, key);
  for (const version of [editorRevision, repositoryPathRevision]) {
    const entry = catalog.releases.find(pack => pack.id === 'canonic/git' && pack.version === version);
    assert.ok(entry, `authenticated Git ${version} release`);
    const source = directory(version);
    assert.equal(digest(readFileSync(new URL('pack.yml', source))), entry.sha256);
    for (const name of ['pack.yml', 'cases.json', 'commands.json', 'README.md', 'LICENSE'])
      assert.deepEqual(readFileSync(new URL(name, source)),
        readFileSync(new URL(`packs/canonic/git/${version}/${name}`, published)), `${version} ${name}`);
  }
});

function checkCases(cases, cwd) {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack',
    '--pack', new URL('pack.yml', current).pathname, '--cases', cases], {
    cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
  });
  assert.ifError(result.error);
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
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
    const cases = [['log', '--oneline'], ['ls-tree', '--name-only', 'HEAD']]
      .flatMap(command => scenarios.map(([name, selectors, expected]) => ({
        name: `${command[0]}-${name}`, profile: 'recommended',
        argv: ['git', ...selectors, ...command], expected,
      })));
    const file = join(fixture, 'cases.json');
    writeFileSync(file, JSON.stringify({schema_version: 1, cases}));
    checkCases(file, workspace);
  });

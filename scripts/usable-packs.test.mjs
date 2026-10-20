import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { baseline, git } from './build-usable-packs.mjs';
import { updateExpected } from './usable-cases.mjs';
import { validatorFor, shieldFor } from './pack-formats.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const packs = { baseline: '../packs/canonic/baseline/0.3.0/', git: '../packs/canonic/git/0.6.0/' };
const binary = shieldFor(read(`${packs.baseline}pack.yml`));
function evaluate(pack, cases) {
  const result = spawnSync(binary, ['__internal','test-pack','--pack',pack,'--cases',cases], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120000 });
  let report;
  try { report = JSON.parse(result.stdout); } catch { throw Error(result.stderr || result.stdout); }
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report));
  assert.equal(report.passed, true);
  return report;
}

test('Usability packs preserve compact sources and enumerate every baseline rule in the inventory', async () => {
  assert.deepEqual(await baseline(), read(`${packs.baseline}pack.yml`));
  assert.deepEqual(await git(), read(`${packs.git}pack.yml`));
  const pack = read(`${packs.baseline}pack.yml`);
  const inventory = read(`${packs.baseline}commands.json`);
  for (const { name, rule_ids } of inventory.commands) {
    assert.deepEqual(rule_ids, pack.rules.filter(r => r.conditions.executable?.one_of?.includes(name)).map(r => r.id));
  }
  assert.equal(pack.rules.length, 84);
  assert.equal(read(`${packs.git}pack.yml`).rules.length, 126);
});

test('Production Shield validates all 513 Baseline and 117 new Git decision fixtures', { skip: !binary }, () => {
  for (const [name, count] of [['baseline',513],['git',117]]) {
    const report = evaluate(new URL(`${packs[name]}pack.yml`, import.meta.url).pathname, new URL(`${packs[name]}cases.json`, import.meta.url).pathname);
    assert.equal(report.cases.length, count);
  }
});

test('Every historical Git fixture runs against the new policy with seven explicit expectation changes', { skip: !binary }, async t => {
  const fixtures = read('../packs/canonic/git/0.5.0/cases.json');
  assert.equal(updateExpected('git', fixtures.cases), 7);
  const root = await mkdtemp(join(tmpdir(), 'shield-git-regression-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'cases.json');
  await writeFile(path, JSON.stringify(fixtures));
  assert.equal(evaluate(new URL(`${packs.git}pack.yml`, import.meta.url).pathname, path).cases.length, 1023);
});

test('Both native adapters enforce usable reads, transaction controls and retained protection', { skip: !binary || process.platform === 'win32', timeout: 180000 }, () => {
  const result = spawnSync('python3', [new URL('usable-native.py', import.meta.url).pathname, binary,
    new URL(`${packs.baseline}pack.yml`, import.meta.url).pathname, new URL(`${packs.git}pack.yml`, import.meta.url).pathname],
    { encoding: 'utf8', timeout: 170000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, true);
  assert.equal(report.cases.length, 261);
});

test('Merged branch deletion retains Git’s unmerged-work check and normal housekeeping preserves the working tree', async t => {
  const root = await mkdtemp(join(tmpdir(), 'shield-git-usable-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { mkdir } = await import('node:fs/promises');
  const home = join(root, 'home'), repo = join(root, 'repo');
  await mkdir(home); await mkdir(repo);
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  Object.assign(env, { HOME: home, XDG_CONFIG_HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat' });
  const run = (args, status = 0) => {
    const result = spawnSync('git', ['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args], { cwd: repo, env, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, status, `${args.join(' ')}: ${result.stderr}`);
    return result.stdout;
  };
  run(['init','-b','main',`--template=${home}`]);
  run(['config','user.name','Acme']); run(['config','user.email','developer@example.com']);
  await writeFile(join(repo, 'item.txt'), 'first\n');
  run(['add','item.txt']); run(['commit','-m','Initial fixture']);
  run(['switch','-c','feature']);
  await writeFile(join(repo, 'item.txt'), 'second\n');
  run(['commit','-am','Unmerged fixture']);
  run(['switch','main']);
  run(['branch','-d','feature'], 1);
  assert.match(run(['branch','--list','feature']), /feature/);
  run(['merge','--ff-only','feature']); run(['branch','-d','feature']);
  run(['log','--oneline','-17']); run(['status','-u']); run(['branch','-vv']);
  run(['reflog','-n','5']); run(['gc','--auto']);
  assert.equal(run(['status','--porcelain']), '');
  assert.equal(readFileSync(join(repo, 'item.txt'), 'utf8'), 'second\n');
});

test('Fixed text programs work against real tools without changing their inputs', { skip: process.platform === 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'shield-fixed-reads-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { mkdir, readdir } = await import('node:fs/promises');
  const home = join(root, 'home');
  await mkdir(home);
  const sources = { 'lines.txt': 'b\na\nc\n', 'rows.txt': 'Acme:7\n', 'data.json': '{"items":[{"name":"Acme"}]}\n' };
  for (const [name, content] of Object.entries(sources)) await writeFile(join(root, name), content);
  const env = { ...process.env, HOME: home, RIPGREP_CONFIG_PATH: '', LC_ALL: 'C' };
  for (const [tool, args, expected] of [
    ['sed',['-n','2,3p','lines.txt'],'a\nc\n'],
    ['awk',['-F:','{print $1, $2}','rows.txt'],'Acme 7\n'],
    ['jq',['-r','.items[0].name','data.json'],'Acme\n'],
    ['jq',['.items | length','data.json'],'1\n'],
    ['sort',['lines.txt'],'a\nb\nc\n'],
    ['uniq',['rows.txt'],'Acme:7\n'],
    ['cut',['-d:','-f2','rows.txt'],'7\n'],
    ['diff',['-u','rows.txt','rows.txt'],''],
    ['cmp',['-s','rows.txt','rows.txt'],''],
  ]) {
    const result = spawnSync(tool, args, { cwd: root, env, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, `${tool}: ${result.stderr || result.error}`);
    assert.equal(result.stdout, expected, tool);
  }
  assert.deepEqual((await readdir(root)).sort(), [...Object.keys(sources),'home'].sort());
  for (const [name, content] of Object.entries(sources)) assert.equal(readFileSync(join(root, name), 'utf8'), content);
});

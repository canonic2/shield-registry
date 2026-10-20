import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {currentFormat} from './pack-formats.mjs';
import {sedEditsPack, sedEditsCases, sedEditsCommands, destination, narrowed,
  printScript, readScript, editScript, writeScript} from './build-baseline-sed-edits.mjs';

const previous = name => JSON.parse(readFileSync(new URL(`../packs/canonic/baseline/0.3.1/${name}`, import.meta.url)));
const current = name => JSON.parse(readFileSync(new URL(name, destination)));

test('Sed edits add three rules and change only sed scripts and write exclusions', async () => {
  const pack = current('pack.yml');
  assert.deepEqual(pack, await sedEditsPack());
  assert.equal(pack.rules.length, 87);
  assert.deepEqual(pack.engines, {shield: '>=0.1.13, <0.2.0'});
  const old = currentFormat(previous('pack.yml'));
  const restored = structuredClone(pack);
  restored.version = old.version;
  restored.engines = old.engines;
  restored.rules = restored.rules.filter(rule => !['edit-sed', 'edit-sed-gnu', 'write-sed'].includes(rule.id));
  for (const id of ['read-sed', 'stdin-sed-read', 'review-sed', ...narrowed]) {
    const index = restored.rules.findIndex(rule => rule.id === id);
    restored.rules[index] = old.rules.find(rule => rule.id === id);
  }
  assert.deepEqual(restored, old);
  // Writes keep excluding Git metadata and Shield's state, and nothing else.
  for (const id of narrowed) {
    const text = JSON.stringify(pack.rules.find(rule => rule.id === id));
    for (const path of ['.claude', '.codex', '.mcp.json', '"path":".shield"']) assert.ok(!text.includes(path), `${id}: ${path}`);
    for (const path of ['.git', '.shield/review', '.shield/cache']) assert.ok(text.includes(path), `${id}: ${path}`);
  }
  assert.deepEqual(current('commands.json'), await sedEditsCommands());
});

test('Sed script patterns stay within the regex bound and separate reads from writes', () => {
  for (const pattern of [printScript, readScript, editScript, writeScript]) assert.ok(pattern.length < 4096);
  const full = pattern => new RegExp(`^(?:${pattern})$`, 'u');
  const [print, read, edit, write] = [printScript, readScript, editScript, writeScript].map(full);
  for (const script of ['1,200p', 's/a/b/g', 's|/a|/b|', 'y/ab/cd/; 3d', '$p\ns#a#b#2']) {
    assert.ok(print.test(script) && read.test(script) && edit.test(script) && !write.test(script), script);
  }
  for (const script of ['1r notes.txt', 's/a/b/\nR other.txt']) {
    assert.ok(!print.test(script) && read.test(script) && edit.test(script) && !write.test(script), script);
  }
  for (const script of ['w out.txt', 's/a/b/w out.txt', '1p; $W tail.txt', 's/a/b/gw out']) {
    assert.ok(!print.test(script) && !read.test(script) && edit.test(script) && write.test(script), script);
  }
  for (const script of ['', '1e id', 's/a/b/e', 's,a,b,', '/acme/p', '1{p}', 'w', 's/a/b']) {
    assert.ok(![print, read, edit, write].some(pattern => pattern.test(script)), script);
  }
});

test('Previous fixtures are retained, with in-place edits and named reads decided by path', async () => {
  const cases = current('cases.json');
  assert.deepEqual(cases, await sedEditsCases());
  const old = previous('cases.json').cases;
  const changed = cases.cases.slice(0, old.length).filter((fixture, index) => fixture.expected !== old[index].expected);
  assert.deepEqual(changed.map(fixture => fixture.name).sort(), [
    'usable-sed-in-place-loose', 'usable-sed-in-place-recommended',
    'usable-sed-read-file-loose', 'usable-sed-read-file-recommended', 'usable-sed-read-file-strict',
  ]);
  assert.deepEqual(cases.cases.slice(0, old.length).map(({expected, ...rest}) => rest),
    old.map(({expected, ...rest}) => rest));
  assert.equal(cases.cases.length, 648);
});

test('Production evaluator decides every fixture', {skip: !process.env.SHIELD_BINARY}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', new URL('cases.json', destination).pathname], {encoding: 'utf8', timeout: 120000});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).passed, true);
});

test('Both native adapters enforce Baseline 0.4.0 with Git 0.6.1 in every profile',
  {skip: !process.env.SHIELD_BINARY || process.platform === 'win32', timeout: 180000}, () => {
    const result = spawnSync('python3', [new URL('usable-native.py', import.meta.url).pathname, process.env.SHIELD_BINARY,
      new URL('pack.yml', destination).pathname, new URL('../packs/canonic/git/0.6.1/pack.yml', import.meta.url).pathname],
      {encoding: 'utf8', timeout: 170000, maxBuffer: 2 * 1024 * 1024});
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, 261);
  });

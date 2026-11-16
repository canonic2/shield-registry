import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {baselinePreviewCases, shieldVersion} from './baseline-preview.mjs';

const pack = new URL('../packs/canonic/baseline/0.10.0/pack.yml', import.meta.url);
const historical = JSON.parse(readFileSync(new URL('cases.json', pack))).cases;

test('Shield 0.33 ripgrep expectations change only the nine reviewed historical forms in every profile', () => {
  const cases = JSON.parse(readFileSync(new URL('../packs/canonic/baseline/0.8.1/cases.json', import.meta.url))).cases;
  const before = structuredClone(cases);
  const current = baselinePreviewCases(cases, '0.33.0');
  const changed = current.filter((fixture, index) => fixture.expected !== cases[index].expected);
  assert.equal(changed.length, 27);
  assert.deepEqual(new Set(changed.map(fixture => fixture.name.replace(/-(loose|recommended|strict)$/, ''))),
    new Set(['rg-trailing-config', 'rg-hidden-tree', 'usable-hidden-content', 'usable-hidden-content-names',
      'usable-hidden-content-no-ignore', 'usable-hidden-listing-late-option', 'usable-hidden-listing-no-mode',
      'usable-hidden-listing-mode-as-value', 'usable-hidden-listing-mode-as-operand']));
  for (const [index, fixture] of current.entries())
    assert.deepEqual(fixture, changed.includes(fixture) ? {...cases[index], expected: 'allow'} : cases[index]);
  assert.deepEqual(cases, before);
  assert.deepEqual(baselinePreviewCases(cases, '0.32.0'), cases);
  assert.deepEqual(baselinePreviewCases(current, '0.33.0'), current);
  const altered = structuredClone(changed[0]);
  altered.argv.push('.aws/credentials');
  assert.throws(() => baselinePreviewCases([altered], '0.33.0'), /explicit review/);
});

test('Shield 0.36 grep expectations change only the reviewed recursive search without a path', () => {
  const cases = JSON.parse(readFileSync(new URL('../packs/canonic/baseline/0.14.0/cases.json', import.meta.url))).cases;
  const before = structuredClone(cases);
  const current = baselinePreviewCases(cases, '0.36.0');
  const changed = current.filter((fixture, index) => fixture.expected !== cases[index].expected);
  assert.deepEqual(changed.map(fixture => [fixture.name, fixture.expected]), [['grep-recursive-without-path-recommended', 'allow']]);
  assert.deepEqual(cases, before);
  assert.deepEqual(baselinePreviewCases(cases, '0.35.0'), cases);
  const altered = {...cases.find(fixture => fixture.name === 'grep-recursive-without-path-recommended')};
  altered.argv = [...altered.argv, '/etc'];
  assert.throws(() => baselinePreviewCases([altered], '0.36.0'), /explicit review/);
});

test('Current Baseline preview expectations preserve every historical case except the nine reviewed sed forms', () => {
  const before = structuredClone(historical);
  const current = baselinePreviewCases(historical, '0.10.0');
  const changed = current.filter((fixture, index) => fixture.expected !== historical[index].expected);
  assert.equal(changed.length, 9);
  assert.deepEqual(new Set(changed.map(fixture => fixture.name.replace(/-(loose|recommended|strict)$/, ''))),
    new Set(['usable-sed-in-place', 'usable-sed-edit-bsd', 'usable-sed-edit-extended']));
  assert.ok(changed.every(fixture => fixture.expected === 'deny'));
  assert.deepEqual(historical, before);
  assert.equal(current.length, historical.length);
  assert.deepEqual(baselinePreviewCases(historical, '0.9.0'), historical);
  assert.deepEqual(baselinePreviewCases(historical, '0.20.0'), current);
  assert.deepEqual(baselinePreviewCases(historical, '0.21.0'), historical);
  const altered = structuredClone(changed[0]);
  altered.argv.push('another-file');
  assert.throws(() => baselinePreviewCases([altered], '0.10.0'), /explicit review/);
});

test('Shield sed previews enforce the versioned target-evidence contract',
  {skip: !process.env.SHIELD_BINARY}, t => {
    const [major, minor] = shieldVersion().split('.').map(Number);
    if (major === 0 && minor < 10) return t.skip('This preview contract starts with Shield 0.10');
    const conservative = major === 0 && minor < 21;
    const names = new Set(baselinePreviewCases(historical, '0.10.0')
      .filter((fixture, index) => fixture.expected !== historical[index].expected).map(fixture => fixture.name));
    const cases = baselinePreviewCases(historical.filter(fixture => names.has(fixture.name)));
    const owner = mkdtempSync(join(tmpdir(), 'shield-sed-preview-'));
    t.after(() => rmSync(owner, {recursive: true, force: true}));
    const path = join(owner, 'cases.json');
    writeFileSync(path, JSON.stringify({schema_version: 1, cases}));
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', pack.pathname,
      '--cases', path, '--details'], {encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024});
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, 9);
    for (const fixture of report.cases) {
      const checks = conservative ? fixture.evaluation.requirement_checks
        : fixture.evaluation.matches.find(match => match.applied && match.rule_id === 'edit-sed').requirement_checks;
      assert.ok(checks.length > 0);
      assert.ok(checks.every(check => check.code === (conservative ? 'evidence_unavailable' : 'requirement_met')
        && check.predicate_path === '/requirements/targets' && check.rule_ref.rule_id === 'edit-sed'));
    }
  });

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {baselinePreviewCases, shieldVersion} from './baseline-preview.mjs';

const pack = new URL('../packs/canonic/baseline/0.10.0/pack.yml', import.meta.url);
const historical = JSON.parse(readFileSync(new URL('cases.json', pack))).cases;

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
  const altered = structuredClone(changed[0]);
  altered.argv.push('another-file');
  assert.throws(() => baselinePreviewCases([altered], '0.10.0'), /explicit review/);
});

test('Current Shield denies preview sed edits specifically because target evidence is unavailable',
  {skip: !process.env.SHIELD_BINARY}, t => {
    const [major, minor] = shieldVersion().split('.').map(Number);
    if (major === 0 && minor < 10) return t.skip('This preview contract starts with Shield 0.10');
    const cases = baselinePreviewCases(historical).filter((fixture, index) => fixture.expected !== historical[index].expected);
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
      const checks = fixture.evaluation.requirement_checks;
      assert.ok(checks.length > 0);
      assert.ok(checks.every(check => check.code === 'evidence_unavailable'
        && check.predicate_path === '/requirements/targets' && check.rule_ref.rule_id === 'edit-sed'));
    }
  });

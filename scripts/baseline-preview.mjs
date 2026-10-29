// Published Baseline fixtures are immutable. Shield 0.10 previews conservatively
// join GNU/BSD sed footprints; native working-file evidence is tested separately.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

let selectedVersion;
export function shieldVersion() {
  if (selectedVersion) return selectedVersion;
  const result = spawnSync(process.env.SHIELD_BINARY, ['--version'], {encoding: 'utf8', timeout: 10000});
  assert.equal(result.status, 0, result.stderr || String(result.error ?? 'Shield version failed'));
  selectedVersion = /^shield (\d+\.\d+\.\d+)\b/.exec(result.stdout)?.[1];
  assert.ok(selectedVersion, 'Shield must report its version');
  return selectedVersion;
}

const forms = new Map([
  ['usable-sed-in-place', ['sed', '-i', '', '1p', 'README.md']],
  ['usable-sed-edit-bsd', ['sed', '-i', '', 's/acme/example/', 'README.md']],
  ['usable-sed-edit-extended', ['sed', '-E', '-i', '', 's/(acme)/\\1-example/', 'README.md']],
]);

export function baselinePreviewCases(cases, version = shieldVersion()) {
  const [major, minor] = version.split('.').map(Number);
  if (major === 0 && minor < 10) return cases;
  return cases.map(fixture => {
    const argv = forms.get(fixture.name.replace(/-(loose|recommended|strict)$/, ''));
    if (!argv) return fixture;
    assert.deepEqual(fixture.argv, argv, 'A changed historical fixture needs explicit review');
    assert.equal(fixture.expected, fixture.profile === 'strict' ? 'ask' : 'allow');
    return {...fixture, expected: 'deny'};
  });
}

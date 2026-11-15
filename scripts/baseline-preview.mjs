// Published Baseline fixtures are immutable. Shield 0.10–0.20 previews lack
// complete GNU/BSD sed footprints; Shield 0.21 models both readings. Shield
// 0.33 parses trailing ripgrep options and checks hidden walks against existing
// entries. These fixture projects contain no protected hidden descendants.
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

const ripgrepForms = new Map([
  ['rg-trailing-config', ['rg', 'Acme', '--no-config', 'README.md']],
  ['rg-hidden-tree', ['rg', '--no-config', '--no-ignore', '--hidden', 'Acme', '.']],
  ['usable-hidden-content', ['rg', '--hidden', 'Acme', '.']],
  ['usable-hidden-content-names', ['rg', '--hidden', '--files-with-matches', 'Acme', '.']],
  ['usable-hidden-content-no-ignore', ['rg', '--no-ignore', '--hidden', 'Acme', '.']],
  ['usable-hidden-listing-late-option', ['rg', '--files', '.', '--hidden']],
  // In both forms '.' is the search pattern, with an implicit cwd operand.
  // In the latter, '--files' is a glob value rather than a listing flag.
  ['usable-hidden-listing-no-mode', ['rg', '--hidden', '.']],
  ['usable-hidden-listing-mode-as-value', ['rg', '--hidden', '-g', '--files', '.']],
  // After '--', '--files' is a literal search pattern, not an option.
  ['usable-hidden-listing-mode-as-operand', ['rg', '--hidden', '--', '--files']],
]);

export function baselinePreviewCases(cases, version = shieldVersion()) {
  const [major, minor] = version.split('.').map(Number);
  if (major === 0 && minor >= 33) return cases.map(fixture => {
    const argv = ripgrepForms.get(fixture.name.replace(/-(loose|recommended|strict)$/, ''));
    if (!argv) return fixture;
    assert.deepEqual(fixture.argv, argv, 'A changed historical fixture needs explicit review');
    assert.ok(['deny', 'allow'].includes(fixture.expected), 'A changed historical decision needs explicit review');
    return fixture.expected === 'deny' ? {...fixture, expected: 'allow'} : fixture;
  });
  if (major !== 0 || minor < 10 || minor >= 21) return cases;
  return cases.map(fixture => {
    const argv = forms.get(fixture.name.replace(/-(loose|recommended|strict)$/, ''));
    if (!argv) return fixture;
    assert.deepEqual(fixture.argv, argv, 'A changed historical fixture needs explicit review');
    assert.equal(fixture.expected, fixture.profile === 'strict' ? 'ask' : 'allow');
    return {...fixture, expected: 'deny'};
  });
}

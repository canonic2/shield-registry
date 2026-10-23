import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rustPack, destination, commandNames} from './build-rust-pack.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {checkCommands} from './registry-release.mjs';
import {compatibleDirectory} from './pack-formats.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, destination)));
test('Rust source policy and independent cases admit with complete command inventory', () => {
  const pack = read('pack.yml');
  assert.ok(readFileSync(new URL('pack.yml', destination)).length <= 1_048_576, 'Rust policy must fit the registry acquisition bound');
  assert.deepEqual(pack, rustPack());
  const validate = schemaValidator(schema);
  for (const document of [pack, read('cases.json')]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  assert.deepEqual(read('commands.json').commands.map(row => row.name), commandNames);
  for (const {name, rule_ids} of read('commands.json').commands) {
    assert.ok(rule_ids.length);
    assert.deepEqual(rule_ids, pack.rules.filter(rule => rule.conditions.executable.one_of?.includes(name)).map(rule => rule.id));
  }
  const release = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.ok(release.packs.includes('packs/canonic/rust/0.1.0/pack.yml'));
  assert.deepEqual(release.commands['canonic/rust'], commandNames);
  checkCommands({'canonic/rust': commandNames}, [{id: 'canonic/rust', version: '0.1.0'}]);
});

test('Rust profile decisions, paths and Baseline/Node composition use production evaluation', {skip: !process.env.SHIELD_BINARY, timeout: 120000}, t => {
  const evaluated = compatibleDirectory([destination, new URL('../packs/canonic/rust/0.1.1/', import.meta.url)]);
  assert.ok(evaluated, 'A current Rust release must admit on the selected Shield.');
  const owner = mkdtempSync(join(tmpdir(), 'shield-rust-cases-'));
  t.after(() => rmSync(owner, {recursive: true, force: true}));
  const project = join(owner, 'project');
  const outside = join(owner, 'outside');
  for (const directory of [project, outside, join(project, 'src'), join(project, '.shield'), join(project, '.git')]) mkdirSync(directory, {recursive: true});
  writeFileSync(join(project, 'Cargo.toml'), '[package]\nname = "acme"\nversion = "0.1.0"\n');
  writeFileSync(join(project, 'src/lib.rs'), 'pub fn acme() {}\n');
  writeFileSync(join(project, 'target.json'), '{}\n');
  writeFileSync(join(outside, 'target.json'), '{}\n');
  writeFileSync(join(project, '.shield/target.json'), '{}\n');
  if (process.platform !== 'win32') symlinkSync(outside, join(project, 'escape'));
  const run = (cases, extra = []) => {
    const casePath = join(owner, 'cases.json');
    writeFileSync(casePath, JSON.stringify(cases));
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', evaluated).pathname, '--cases', casePath, ...extra],
      {cwd: project, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
  };
  const cases = read('cases.json');
  const scenarios = [
    ['manifest', ['cargo', 'build', '--manifest-path', 'Cargo.toml'], ['allow', 'allow', 'ask']],
    ['output', ['cargo', 'build', '--target-dir', 'artifacts'], ['allow', 'allow', 'ask']],
    ['fmt-source', ['rustfmt', '--check', 'src/lib.rs'], ['allow', 'allow', 'ask']],
    ['compiler-source', ['rustc', 'src/lib.rs', '--crate-type', 'lib', '-o', 'artifacts/acme.rlib'], ['allow', 'allow', 'ask']],
    ['vendor', ['cargo', 'vendor', 'third-party'], ['allow', 'allow', 'deny']],
    ['archive', ['cargo', 'nextest', 'archive', '--archive-file', 'artifacts/tests.tar.zst'], ['allow', 'allow', 'ask']],
    ['report', ['cargo', 'llvm-cov', 'report', '--output-path', 'artifacts/coverage.json', '--json'], ['allow', 'allow', 'ask']],
    ['fmt-print', ['rustfmt', '--print-config', 'default', 'rustfmt.toml'], ['ask', 'ask', 'deny']],
    ['manifest-outside', ['cargo', 'build', '--manifest-path', '../outside/Cargo.toml'], ['deny', 'deny', 'deny']],
    ['output-outside', ['cargo', 'build', '--target-dir', outside], ['deny', 'deny', 'deny']],
    ['output-protected', ['cargo', 'build', '--target-dir', '.shield/cache'], ['deny', 'deny', 'deny']],
    ['output-parent', ['cargo', 'build', '--target-dir', '.'], ['deny', 'deny', 'deny']],
    ['duplicate-manifest', ['cargo', 'build', '--manifest-path', 'Cargo.toml', '--manifest-path', '../outside/Cargo.toml'], ['deny', 'deny', 'deny']],
    ['fmt-outside', ['rustfmt', '../outside/lib.rs'], ['deny', 'deny', 'deny']],
    ['compiler-outside', ['rustc', 'src/lib.rs', '-o', '../outside/acme'], ['deny', 'deny', 'deny']],
    ['custom-target', ['cargo', 'build', '--target', 'target.json'], ['allow', 'allow', 'ask']],
    ['custom-target-compiler', ['rustc', 'src/lib.rs', '--crate-type', 'lib', '--target=target.json'], ['allow', 'allow', 'ask']],
    ['custom-target-outside', ['cargo', 'build', '--target', join(outside, 'target.json')], ['deny', 'deny', 'deny']],
    ['custom-target-compiler-outside', ['rustc', 'src/lib.rs', '--target=../outside/target.json'], ['deny', 'deny', 'deny']],
    ['custom-target-protected', ['cargo', 'build', '--target=.shield/target.json'], ['deny', 'deny', 'deny']],
    ['custom-target-repeated', ['cargo', 'build', '--target', 'target.json', '--target', '../outside/target.json'], ['deny', 'deny', 'deny']],
    ['custom-target-wrapped', ['rustup', 'run', 'stable', 'cargo', 'build', '--target', '../outside/target.json'], ['deny', 'deny', 'deny']],
    ['custom-target-toolchain', ['cargo', '+stable', 'build', '--target', '.shield/target.json'], ['deny', 'deny', 'deny']],
    ['custom-target-fetch', ['cargo', 'fetch', '--target', '../outside/target.json'], ['deny', 'deny', 'deny']],
    ['custom-target-mixed', ['cargo', 'build', '--target', 'target.json', '--target', 'x86_64-unknown-linux-gnu'], ['ask', 'ask', 'deny']],
  ];
  if (process.platform !== 'win32') scenarios.push(
    ['symlink-output', ['cargo', 'build', '--target-dir', 'escape/new'], ['deny', 'deny', 'deny']],
    ['symlink-target', ['cargo', 'build', '--target', 'escape/target.json'], ['deny', 'deny', 'deny']],
  );
  for (const [name, argv, decisions] of scenarios) for (const [index, profile] of ['loose', 'recommended', 'strict'].entries()) {
    cases.cases.push({name: `paths-${name}-${profile}`, profile, argv, expected: decisions[index]});
  }
  run(cases);
  const baselineDirectory = compatibleDirectory(['0.7.0', '0.8.0'].map(version => new URL(`../packs/canonic/baseline/${version}/`, import.meta.url)));
  assert.ok(baselineDirectory, 'A script-review Baseline release must admit on the selected Shield.');
  const baseline = new URL('pack.yml', baselineDirectory).pathname;
  // Baseline's concrete Strict build rule asks even for Cargo metadata/tree.
  // Another pack cannot lower that owner's chosen restriction.
  const composed = structuredClone(cases);
  for (const fixture of composed.cases) {
    if (['metadata-strict', 'tree-strict'].includes(fixture.name)) fixture.expected = 'ask';
  }
  run(composed, ['--with-pack', baseline]);
  const nodeDirectory = compatibleDirectory(['0.1.0', '0.1.1'].map(version => new URL(`../packs/canonic/node/${version}/`, import.meta.url)));
  assert.ok(nodeDirectory, 'A current Node release must admit on the selected Shield.');
  const node = new URL('pack.yml', nodeDirectory).pathname;
  run(composed, ['--with-pack', baseline, '--with-pack', node]);
});

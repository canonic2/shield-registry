import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {candidate, nodeEcosystemRelease} from './build-node-ecosystem.mjs';
import {nodePlaywrightCases} from './node-playwright-cases.mjs';
import {playwrightTools} from './node-playwright-policy.mjs';
import {splitCaseFiles} from './fixture-files.mjs';

test('every reviewed Playwright operation has independent fixtures in all profiles', async () => {
  const {pack, cases, commands} = await nodeEcosystemRelease();
  assert.equal(new Set(nodePlaywrightCases.map(row => row.name)).size, nodePlaywrightCases.length);
  for (const [name, tool] of Object.entries(playwrightTools)) {
    const inventory = commands.commands.find(row => row.name === name);
    assert.ok(inventory?.rule_ids.length > 0, name);
    for (const [operation] of tool.operations) for (const profile of ['loose', 'recommended', 'strict']) {
      const prefix = [name, ...operation.split(' ')];
      assert.ok(nodePlaywrightCases.some(row => row.profile === profile && prefix.every((word, index) => row.argv?.[index] === word)),
        `${profile}: ${prefix.join(' ')}`);
    }
  }
  assert.deepEqual(cases.cases.slice(-nodePlaywrightCases.length), nodePlaywrightCases);
  // Browser work never acquires a metadata allowance merely because another
  // pack or manager supplies a broad development-loop permission.
  const ids = pack.rules.filter(row => row.id.startsWith('playwright-') && row.id.endsWith('-review'));
  assert.equal(ids.length, 4);
  assert.ok(ids.every(row => !row.fallback && row.decision === 'ask'));
  const disk = JSON.parse(await readFile(new URL('pack.yml', candidate)));
  assert.deepEqual(disk, pack);
});

test('production Shield evaluates Playwright decisions alone and with Baseline', {skip: !process.env.SHIELD_BINARY}, async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'shield-node-playwright-'));
  t.after(() => rm(temporary, {recursive: true, force: true}));
  for (const [name, document] of splitCaseFiles({schema_version: 1, cases: nodePlaywrightCases})) {
    const path = join(temporary, name);
    await writeFile(path, JSON.stringify(document));
    for (const combined of [false, true]) {
      const args = ['__internal', 'test-pack', '--pack', fileURLToPath(new URL('pack.yml', candidate)), '--cases', path, '--json'];
      if (combined) args.push('--with-pack', fileURLToPath(new URL('../packs/canonic/baseline/0.17.0/pack.yml', import.meta.url)));
      const result = spawnSync(process.env.SHIELD_BINARY, args, {encoding: 'utf8', timeout: 60_000, maxBuffer: 8_000_000});
      const report = JSON.parse(result.stdout || '{}');
      assert.equal(result.status, 0, result.stderr + JSON.stringify(report.cases?.filter(row => !row.passed).slice(0, 20) ?? report));
      assert.equal(report.cases.length, document.cases.length);
    }
  }
  t.diagnostic(`Evaluated ${nodePlaywrightCases.length} Playwright decisions alone and with Baseline.`);
});

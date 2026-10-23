// One serial test worker shares schema compilation. All test files still run.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export function runTests(shield, paths = ['scripts/*.test.mjs']) {
  const rg = spawnSync('which', ['rg'], { encoding: 'utf8' }).stdout?.trim();
  const result = spawnSync(process.execPath, ['--test', '--test-isolation=none', '--test-concurrency=1', ...paths], {
    cwd: resolve(import.meta.dirname, '..'), stdio: 'inherit',
    env: { ...process.env, ...(shield ? { SHIELD_BINARY: shield } : {}), ...(rg ? { RG_BINARY: rg } : {}) },
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values, positionals } = parseArgs({ allowPositionals: true,
    options: { shield: { type: 'string' }, native: { type: 'boolean' } } });
  if (values.native && !(values.shield || process.env.SHIELD_BINARY)) throw Error('Native acceptance requires --shield PATH');
  process.exitCode = runTests(values.shield, positionals.length ? positionals : values.native ? ['scripts/native/*.test.mjs'] : undefined);
}

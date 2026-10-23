// Each published release keeps the document format it was published in.
// Releases for Shield 0.1.12 and earlier declare a single `engine` range;
// later releases declare `engines: {shield: RANGE}`, which Shield 0.1.13 and
// later require. Older releases were checked with a compatible Shield when
// they were published, so the current Shield does not evaluate them again.
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { schemaValidator } from './schema-validation.mjs';
import { schema } from './policy-schema.mjs';

const previous = JSON.parse(readFileSync(new URL('../schemas/policy-shield-0.1.12.schema.json', import.meta.url)));

/** Whether a pack uses the format read by Shield 0.1.12 and earlier. */
export const singleEngine = pack => Object.hasOwn(pack, 'engine');

/** The schema validator for the format a pack, or its fixtures, were published in. */
export const validatorFor = pack => schemaValidator(singleEngine(pack) ? previous : schema);

/** The configured Shield binary when it can evaluate this pack; otherwise undefined. */
export function shieldFor(pack) {
  if (singleEngine(pack) || !process.env.SHIELD_BINARY) return undefined;
  const owner = mkdtempSync(join(tmpdir(), 'shield-admission-'));
  try {
    const path = join(owner, 'pack.json');
    writeFileSync(path, JSON.stringify(pack));
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'validate', '--pack', path],
      { encoding: 'utf8', timeout: 120000 });
    if (result.status === 0) return process.env.SHIELD_BINARY;
    const output = JSON.parse(result.stdout || '{}');
    if (result.status === 2 && output.error?.code === 'invalid-contract'
      && output.error.message === 'invalid policy: pack requires a different Shield version') return undefined;
    throw Error(`Shield admission failed: ${result.error || result.stderr || result.stdout}`);
  } finally { rmSync(owner, { recursive: true, force: true }); }
}

/** Select an actually admitted source release for current-engine composition tests. */
export function compatibleDirectory(directories) {
  return directories.find(directory => shieldFor(JSON.parse(readFileSync(new URL('pack.yml', directory)))));
}

/** A copy of a pack in the current format, keeping its Shield version range. */
export function currentFormat(pack) {
  if (!singleEngine(pack)) return pack;
  const { engine, ...rest } = pack;
  const converted = {};
  for (const [key, value] of Object.entries(rest)) {
    converted[key] = value;
    if (key === 'maintainers') converted.engines = { shield: engine };
  }
  return converted;
}

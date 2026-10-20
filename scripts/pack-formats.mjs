// Each published release keeps the document format it was published in.
// Releases for Shield 0.1.12 and earlier declare a single `engine` range;
// later releases declare `engines: {shield: RANGE}`, which Shield 0.1.13 and
// later require. Older releases were checked with a compatible Shield when
// they were published, so the current Shield does not evaluate them again.
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import { schema } from './policy-schema.mjs';

const compile = value => new Ajv({ strict: false, allErrors: true }).compile(value);
const current = compile(schema);
const previous = compile(JSON.parse(readFileSync(new URL('../schemas/policy-shield-0.1.12.schema.json', import.meta.url))));

/** Whether a pack uses the format read by Shield 0.1.12 and earlier. */
export const singleEngine = pack => Object.hasOwn(pack, 'engine');

/** The schema validator for the format a pack, or its fixtures, were published in. */
export const validatorFor = pack => (singleEngine(pack) ? previous : current);

/** The configured Shield binary when it can evaluate this pack; otherwise undefined. */
export const shieldFor = pack => (singleEngine(pack) ? undefined : process.env.SHIELD_BINARY);

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

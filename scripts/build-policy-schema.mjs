import { writeFile } from 'node:fs/promises';
import { schema } from './policy-schema.mjs';
await writeFile(new URL('../schemas/policy.schema.json', import.meta.url), JSON.stringify(schema) + '\n');

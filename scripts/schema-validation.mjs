// Reuse compiled schema code by schema contents, never by a mutable file path.
import Ajv from 'ajv/dist/2020.js';

const validators = new Map();
export function schemaValidator(schema) {
  const key = JSON.stringify(schema);
  // Admission needs one actionable error, not errors from every rejected oneOf
  // branch for every rule in a large valid pack. Validity is unchanged.
  if (!validators.has(key)) validators.set(key, new Ajv({ strict: false, allErrors: false }).compile(schema));
  return validators.get(key);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rustPack, destination} from './build-rust-executables.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

test('Rust executable discovery keeps the published operation rules and fixtures', async () => {
  const previous = JSON.parse(readFileSync(new URL('../packs/canonic/rust/0.2.0/pack.yml', import.meta.url)));
  const pack = await rustPack();
  assert.deepEqual(pack.rules, previous.rules);
  assert.deepEqual(pack, JSON.parse(readFileSync(new URL('pack.yml', destination))));
  const validate = schemaValidator(schema);
  assert.ok(validate(pack), JSON.stringify(validate.errors));
  for (const name of ['cargo', 'rustc', 'rustdoc', 'rustfmt', 'rustup']) {
    const declaration = pack.variables[`${name}_executable`];
    assert.equal(declaration.layer, 'local');
    assert.deepEqual(declaration.discover, [{env:'CARGO_HOME', path:`bin/${name}`}, {home:`.cargo/bin/${name}`}]);
  }
  assert.equal(readFileSync(new URL('cases.json', destination), 'utf8'),
    readFileSync(new URL('../packs/canonic/rust/0.2.0/cases.json', import.meta.url), 'utf8'));
});

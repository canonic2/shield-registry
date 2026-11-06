import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {destination,graphqlGithubPack} from './build-github-graphql-pack.mjs';
import {graphqlGithubCases} from './build-github-graphql-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

const read = name => JSON.parse(readFileSync(new URL(name,destination)));
test('GitHub GraphQL artifacts reproduce and satisfy the source schema',()=>{
  assert.deepEqual(read('pack.yml'),graphqlGithubPack());
  assert.deepEqual(read('cases.json'),{schema_version:1,cases:graphqlGithubCases()});
  const validate=schemaValidator(schema);
  for (const document of [read('pack.yml'),read('cases.json')]) assert.equal(validate(document),true,JSON.stringify(validate.errors));
});
for (const baseline of [false,true]) test(`GitHub GraphQL reads preserve targets, profiles and unsupported-input boundaries${baseline?' with Baseline':''}`, {skip:!process.env.SHIELD_BINARY},()=>{
  const companions=baseline?['--with-pack',new URL('../packs/canonic/baseline/0.11.1/pack.yml',import.meta.url).pathname]:[];
  const result=spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack','--pack',new URL('pack.yml',destination).pathname,'--cases',new URL('cases.json',destination).pathname,...companions],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
  const report=JSON.parse(result.stdout||'{}');
  assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row=>!row.passed)??report)+result.stderr);
});

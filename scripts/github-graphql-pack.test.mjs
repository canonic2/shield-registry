import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {destination,currentDestination,graphqlGithubPack,currentGithubPack} from './build-github-graphql-pack.mjs';
import {graphqlGithubCases,currentGithubCases} from './build-github-graphql-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

const releases = [['0.4.0',destination,graphqlGithubPack,graphqlGithubCases],['0.5.0',currentDestination,currentGithubPack,currentGithubCases]];
const run = (root,extra=[]) => {
  const result=spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack','--pack',new URL('pack.yml',root).pathname,'--cases',new URL('cases.json',root).pathname,...extra],{encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
  return {result,report:JSON.parse(result.stdout||'{}')};
};
for (const [version,root,pack,cases] of releases) {
  const read = name => JSON.parse(readFileSync(new URL(name,root)));
  test(`GitHub GraphQL ${version} artifacts reproduce and satisfy the source schema`,()=>{
    assert.deepEqual(read('pack.yml'),pack());
    assert.deepEqual(read('cases.json'),{schema_version:1,cases:cases()});
    const validate=schemaValidator(schema);
    for (const document of [read('pack.yml'),read('cases.json')]) assert.equal(validate(document),true,JSON.stringify(validate.errors));
  });
  for (const baseline of [false,true]) test(`GitHub GraphQL ${version} reads preserve targets, profiles and unsupported-input boundaries${baseline?' with Baseline':''}`, {skip:!process.env.SHIELD_BINARY},()=>{
    const companions=baseline?['--with-pack',new URL('../packs/canonic/baseline/0.11.1/pack.yml',import.meta.url).pathname]:[];
    const {result,report}=run(root,companions);
    assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row=>!row.passed)??report)+result.stderr);
  });
}
// A scoped refusal names one gate: GraphQL selections for decoded inline queries,
// the literal path for REST reads of the repository, the API boundary otherwise.
test('GitHub 0.5.0 scoped gh api refusals carry exactly one gate message', {skip:!process.env.SHIELD_BINARY},()=>{
  const {result,report}=run(currentDestination,['--details']);
  assert.equal(result.status,0,result.stderr);
  const gates=new Map();
  const api=new Set(currentGithubCases().filter(row=>row.argv?.[1]==='api').map(row=>row.name));
  for (const row of report.cases.filter(row=>row.variables && row.actual==='deny' && api.has(row.name))) {
    const ids=row.evaluation.guidance.map(item=>item.rule_ref.rule_id);
    assert.equal(ids.length,1,`${row.name}: ${ids}`);
    gates.set(row.name.replace(/-(loose|recommended|strict)$/,''),ids[0]);
  }
  for (const name of ['rest-field-post','rest-full-url','rest-placeholders','rest-sibling-name','rest-jq','graphql-review-lines-mutation','graphql-input-only','api-bare'])
    assert.equal(gates.get(`scoped-${name}`),'cli-api-scope',name);
  for (const name of ['rest-dot-segments','rest-percent-escape','rest-inner-placeholder'])
    assert.equal(gates.get(`scoped-${name}`),'cli-api-path',name);
  for (const name of ['graphql-review-lines-unlisted-field','graphql-review-lines-comment-repository','graphql-review-lines-other-owner','graphql-outside'])
    assert.equal(gates.get(`scoped-${name}`),'cli-graphql-scope',name);
});

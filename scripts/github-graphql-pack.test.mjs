import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {destination,currentDestination,nextDestination,destination070,destination071,graphqlGithubPack,currentGithubPack,nextGithubPack,githubPack070,githubPack071} from './build-github-graphql-pack.mjs';
import {graphqlGithubCases,currentGithubCases,nextGithubCases,githubCases070,githubCases071} from './build-github-graphql-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {splitCaseFiles} from './fixture-files.mjs';

const releases = [['0.4.0',destination,graphqlGithubPack,graphqlGithubCases],['0.5.0',currentDestination,currentGithubPack,currentGithubCases],['0.6.0',nextDestination,nextGithubPack,nextGithubCases],['0.7.0',destination070,githubPack070,githubCases070],['0.7.1',destination071,githubPack071,githubCases071]];
const files = cases => splitCaseFiles({schema_version:1,cases:cases()});
const releaseCases = new Map(releases.map(([,root,,cases])=>[root.href,cases]));
// Run every fixture file of a release and combine their case reports.
const run = (root,extra=[]) => {
  const reports=files(releaseCases.get(root.href)).map(([name])=>{
    const result=spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack','--pack',new URL('pack.yml',root).pathname,'--cases',new URL(name,root).pathname,...extra],{encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
    return {result,report:JSON.parse(result.stdout||'{}')};
  });
  const failed=reports.find(({result})=>result.status!==0);
  return {result:failed?.result??reports[0].result,report:failed?.report??{cases:reports.flatMap(({report})=>report.cases??[])}};
};
for (const [version,root,pack,cases] of releases) {
  const read = name => JSON.parse(readFileSync(new URL(name,root)));
  test(`GitHub GraphQL ${version} artifacts reproduce and satisfy the source schema`,()=>{
    assert.deepEqual(read('pack.yml'),pack());
    const validate=schemaValidator(schema);
    assert.equal(validate(read('pack.yml')),true,JSON.stringify(validate.errors));
    for (const [name,document] of files(cases)) {
      assert.deepEqual(read(name),document,name);
      assert.equal(validate(read(name)),true,JSON.stringify(validate.errors));
    }
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
// With the right repository, an unsupported option or operand names only the
// command shape; a wrong -R/--repo also names the repository refusal.
test('GitHub 0.6.0 scoped CLI refusals name the shape or the repository', {skip:!process.env.SHIELD_BINARY},()=>{
  const {result,report}=run(nextDestination,['--details']);
  assert.equal(result.status,0,result.stderr);
  const cli=new Set(nextGithubCases().slice(currentGithubCases().length).map(row=>row.name));
  const gates=new Map(report.cases.filter(row=>row.variables && row.actual==='deny' && cli.has(row.name))
    .map(row=>[row.name.replace(/-(loose|recommended|strict)$/,''),row.evaluation.guidance.map(item=>item.rule_ref.rule_id).sort().join(',')]));
  for (const name of ['search-or','search-repo-qualifier','search-parentheses','pr-view-url','pr-view-fork-head','pr-view-branch-web','pr-view-missing-repository'])
    assert.equal(gates.get(`scoped-${name}`),'cli-scope',name);
  for (const name of ['search-other-repository','pr-view-branch-other-repository'])
    assert.equal(gates.get(`scoped-${name}`),'cli-repository,cli-scope',name);
});
// A scoped refusal names its one cause: the target or option shape, a wrong
// -R/--repo value, or a missing -R/--repo.
test('GitHub 0.7.0 scoped CLI refusals name the target shape or the repository', {skip:!process.env.SHIELD_BINARY},()=>{
  const {result,report}=run(destination070,['--details']);
  assert.equal(result.status,0,result.stderr);
  const gates=new Map(report.cases.filter(row=>row.variables && row.actual==='deny' && row.evaluation.guidance)
    .map(row=>[row.name.replace(/-(loose|recommended|strict)$/,''),row.evaluation.guidance.map(item=>item.rule_ref.rule_id).sort().join(',')]));
  for (const name of ['search-or','search-repo-qualifier','pr-view-url','pr-view-fork-head','pr-view-url-web','pr-view-repository-hash','issue-comment-url','pr-list-unlisted-search-or','leading-repository-unlisted','workflow-view'])
    assert.equal(gates.get(`scoped-${name}`),'cli-scope',name);
  for (const name of ['pr-view-unlisted-other-repository','pr-edit-unlisted-other-repository'])
    assert.equal(gates.get(`scoped-${name}`),'cli-repository',name);
  for (const name of ['pr-view-missing-repository','pr-view-unlisted-missing-repository'])
    assert.equal(gates.get(`scoped-${name}`),'cli-repository-required',name);
});
// Unlisted or malformed mutations refuse at the API boundary, whose message names
// listed mutations; a listed mutation's Ask comes from the unverified-target rule.
test('GitHub 0.6.0 scoped mutations ask for the unverified target or refuse at the API gate', {skip:!process.env.SHIELD_BINARY},()=>{
  const {result,report}=run(nextDestination,['--details']);
  assert.equal(result.status,0,result.stderr);
  const rows=new Map(report.cases.map(row=>[row.name,row]));
  for (const name of ['mutation-unlisted','mutation-listed-and-unlisted','mutation-duplicate-input-key','mutation-payload-repository','mutation-paginate']) {
    const ids=rows.get(`scoped-${name}-recommended`).evaluation.guidance.map(item=>item.rule_ref.rule_id);
    assert.deepEqual(ids,['cli-api-scope'],name);
  }
  for (const [name,rule] of [['scoped-mutation-resolve-threads-loose','graphql-mutation-unverified-target'],['scoped-ask-mutation-resolve-threads-loose','graphql-mutation-unverified-target-ask'],['scoped-profile-mutation-resolve-threads-loose','graphql-mutation-routine']])
    assert.equal(JSON.stringify(rows.get(name).evaluation).includes(`"rule_id":"${rule}"`),true,name);
});

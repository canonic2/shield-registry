// Versioned GraphQL reads; published artifacts remain immutable.
import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {usableGithubPack} from './build-github-usable-pack.mjs';

export const destination = new URL('../packs/canonic/github/0.4.0/', import.meta.url);
const leaf = names => Object.fromEntries(names.split(' ').map(name => [name, {leaf: true}]));
const select = (name, arguments_) => ({select: name, ...(arguments_ ? {arguments: arguments_} : {})});
const scalar = type => ({match: {scalar: type}});
const required = text => ({required: true, match: {text}});
const page = {first: scalar('integer'), last: scalar('integer'),
  after: {...scalar('string'), nullable: true, cursor: true},
  before: {...scalar('string'), nullable: true, cursor: true}};
const state = (types, fields) => ({types: types.split(' '), fields});

export function repositoryModel() {
  const states = {
    query: state('Query', {repository: select('repository', {
      owner: required({var: 'repository', split: {separator: '/', index: 0}}),
      name: required({var: 'repository', split: {separator: '/', index: 1}}),
    })}),
    repository: state('Repository', {...leaf('__typename id name nameWithOwner url description'),
      pullRequest: select('pullRequest', {number: {...scalar('integer'), required: true}}),
      issue: select('issue', {number: {...scalar('integer'), required: true}}),
      pullRequests: select('pullRequests', {...page, baseRefName: scalar('string'), headRefName: scalar('string')}),
      issues: select('issues', page)}),
    pullRequest: state('PullRequest', {...leaf('__typename id number title body url state createdAt updatedAt closed merged isDraft'),
      author: select('actor'), comments: select('comments', page), reviews: select('reviews', page), reviewThreads: select('threads', page)}),
    issue: state('Issue', {...leaf('__typename id number title body url state createdAt updatedAt closed'),
      author: select('actor'), comments: select('comments', page)}),
    actor: state('Actor User Bot Organization Mannequin EnterpriseUserAccount', leaf('__typename login')),
    commit: state('Commit', leaf('__typename oid')),
    pageInfo: state('PageInfo', leaf('__typename hasNextPage endCursor hasPreviousPage startCursor')),
    thread: state('PullRequestReviewThread', {...leaf('__typename id isResolved isOutdated path line diffSide startLine startDiffSide'), comments: select('reviewComments', page)}),
    reviewComment: state('PullRequestReviewComment', {...leaf('__typename id databaseId url body createdAt updatedAt'), author: select('actor'), originalCommit: select('commit'), commit: select('commit')}),
    review: state('PullRequestReview', {...leaf('__typename id databaseId url body state createdAt submittedAt'), author: select('actor'), commit: select('commit'), comments: select('reviewComments', page)}),
    comment: state('IssueComment', {...leaf('__typename id databaseId url body createdAt updatedAt'), author: select('actor')}),
  };
  for (const [name, type, node] of [
    ['pullRequests', 'PullRequest', 'pullRequest'], ['issues', 'Issue', 'issue'],
    ['comments', 'IssueComment', 'comment'], ['reviews', 'PullRequestReview', 'review'],
    ['threads', 'PullRequestReviewThread', 'thread'], ['reviewComments', 'PullRequestReviewComment', 'reviewComment'],
  ]) {
    states[name] = state(`${type}Connection`, {...leaf('__typename totalCount'), nodes: select(node), edges: select(`${name}Edge`), pageInfo: select('pageInfo')});
    states[`${name}Edge`] = state(`${type}Edge`, {...leaf('__typename cursor'), node: select(node)});
  }
  return {root: 'query', states};
}
export function graphqlGithubPack() {
  const pack = usableGithubPack();
  pack.version = '0.4.0';
  pack.engines.shield = '>=0.22.0, <1.0.0';
  pack.capabilities.push('graphql-v1');
  pack.variables.repository.description = 'Optional exact OWNER/REPO for CLI and MCP. Listed CLI commands use -R/--repo; supported inline GraphQL reads verify their repository selections. Unknown targets deny.';
  const api = {kind: 'prefix', values: ['api']};
  const target = pack.rules.find(rule => rule.id === 'review-api').conditions.executable;
  pack.preconditions.find(gate => gate.id === 'cli-scope').requires_any.push({arguments: api});
  pack.preconditions.push({id: 'cli-graphql-scope', when: [{var:'repository',set:true}],
    conditions:{domain:'argv',executable:target,arguments:api},
    requires_any:[{graphql:{carrier:'gh-api',operation:'query',selection:repositoryModel()}}],
    on_unmet:{decision:'deny',message:'The GraphQL selections are outside the configured repository or their scope cannot be verified.'}});
  for (const [index,executable] of target.one_of.entries()) pack.rules.push({id: `graphql-read-${index}`,
    conditions:{domain:'argv',executable,arguments:api,graphql:{carrier:'gh-api',operation:'query'}},
    decision:{loose:'allow',recommended:'allow',strict:'allow'},
    reason:'Read GitHub through a verified inline GraphQL query; the repository scope gate verifies every selected traversal when configured.'});
  return pack;
}
export async function buildGraphqlGithubPack() {
  const pack = graphqlGithubPack();
  await mkdir(destination, {recursive: true});
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('commands.json', destination), JSON.stringify({schema_version: 1, commands: [{name: 'gh', rule_ids: pack.rules.filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]}, null, 2) + '\n');
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', destination));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildGraphqlGithubPack();

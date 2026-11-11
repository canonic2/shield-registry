// Versioned GraphQL reads; published artifacts remain immutable.
// Field leaves follow https://docs.github.com/en/graphql/reference/objects.
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
// 0.5.0: review-line scalars, and a separate refusal for gh api requests that are
// not inline GraphQL queries, so each scoped refusal names the change to make.
export const currentDestination = new URL('../packs/canonic/github/0.5.0/', import.meta.url);
export function currentRepositoryModel() {
  const model = repositoryModel();
  // Read-only scalars of the PR diff position (GitHub GraphQL schema); none traverses.
  Object.assign(model.states.thread.fields, leaf('originalLine originalStartLine'));
  Object.assign(model.states.reviewComment.fields, leaf('path diffHunk line originalLine startLine originalStartLine'));
  return model;
}
// A plain REST GET of one path under the configured repository. Every other gh
// api option fails the grammar: fields and --input switch to POST or send a body,
// -H and --hostname change the request, and --jq/--template can print $ENV.
export function restRead(path) {
  return {kind: 'options', prefix: ['api'],
    flags: ['--paginate', '--slurp', '-i', '--include', '--silent', '--verbose'],
    values: [{name: '-X', match: 'GET'}, {name: '--method', match: 'GET'}],
    operands: {match: path, min: 1, max: 1}};
}
// The literal separator keeps repos/acme/web-other/ outside acme/web.
const repositoryPath = {prefix: ['repos/', {var: 'repository'}, '/']};
// No dot segment, percent escape, placeholder, backslash or whitespace after it.
const pathCharacter = '[^.%{}\\\\\\s]';
const literalPath = {regex: `repos/(?:${pathCharacter}|\\.${pathCharacter})*\\.?`};
export function currentGithubPack() {
  const pack = graphqlGithubPack();
  pack.version = '0.5.0';
  pack.capabilities.push('templates-v1', 'variable-prefixes-v1');
  pack.variables.repository.description = 'Optional exact OWNER/REPO for CLI and MCP. Listed CLI commands use -R/--repo; gh api accepts inline GraphQL reads rooted at this repository and plain GETs of repos/OWNER/REPO/ paths. Unknown targets deny.';
  const query = {carrier: 'gh-api', operation: 'query'};
  const graphql = pack.preconditions.find(gate => gate.id === 'cli-graphql-scope');
  const {conditions, when} = graphql;
  // The gates are disjoint: GraphQL applies to decoded inline queries, the path
  // gate to REST reads of the repository, and the API gate to everything else.
  graphql.conditions = {...conditions, graphql: query};
  graphql.requires_any = [{graphql: {...query, selection: currentRepositoryModel()}}];
  graphql.on_unmet.message = 'This GraphQL query selects a root, repository or field outside the reviewed model for {{repository}}. Start every selection at repository(owner, name) for {{repository}}, remove other roots and unlisted fields, then retry.';
  pack.preconditions.push(
    {id: 'cli-api-scope', when, conditions, requires_any: [{graphql: query}, {arguments: restRead(repositoryPath)}],
      on_unmet: {decision: 'deny', message: 'With the repository setting, gh api accepts inline GraphQL query reads rooted at {{repository}} and plain GETs of repos/{{repository}}/... paths, with only --paginate, --slurp, --include, --silent, --verbose or -X GET. Remove fields, --input, headers, other hosts and --jq/--template, then retry.'}},
    {id: 'cli-api-path', when, conditions: {...conditions, arguments: restRead(repositoryPath)},
      requires_any: [{arguments: restRead(literalPath)}],
      on_unmet: {decision: 'deny', message: 'Write the REST path literally as repos/{{repository}}/...: dot segments, percent escapes, {owner}/{repo} placeholders, backslashes and spaces are refused.'}});
  for (const [index, executable] of conditions.executable.one_of.entries()) pack.rules.push({id: `repository-rest-read-${index}`, when,
    conditions: {domain: 'argv', executable, arguments: restRead(repositoryPath)},
    decision: {loose: 'allow', recommended: 'allow', strict: 'allow'},
    reason: 'Read the configured repository through a plain REST GET; the path gate refuses traversal and placeholders.'});
  return pack;
}
const writePack = async (pack, output) => {
  await mkdir(output, {recursive: true});
  await writeFile(new URL('pack.yml', output), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('commands.json', output), JSON.stringify({schema_version: 1, commands: [{name: 'gh', rule_ids: pack.rules.filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]}, null, 2) + '\n');
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', output));
};
export const buildGraphqlGithubPack = () => writePack(graphqlGithubPack(), destination);
export const buildCurrentGithubPack = () => writePack(currentGithubPack(), currentDestination);
// Default: the current candidate. Pass 0.4.0 to reproduce the published release.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await (process.argv[2] === '0.4.0' ? buildGraphqlGithubPack() : buildCurrentGithubPack());

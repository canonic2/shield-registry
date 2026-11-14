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
// 0.6.0: plain --search/-S terms and branch selectors under the repository
// setting, and a separate refusal naming a wrong -R/--repo value.
export const nextDestination = new URL('../packs/canonic/github/0.6.0/', import.meta.url);
// gh resolves a URL operand's own repository and ignores -R, and OWNER/REPO#N
// or owner:branch forms name other targets, so a branch excludes ':' and '#'.
const branch = '[A-Za-z0-9_][A-Za-z0-9._/+-]*';
// GitHub search applies qualifiers (repo:, org:, -repo:), parentheses and
// boolean operators across the query gh scopes with repo:OWNER/REPO, so either
// could widen it. Plain terms exclude ':', '(', ')' and '"', and the words OR,
// AND and NOT in either case.
const c = except => `[^${except}\\s:()"]`;
const term = [`${c('')}{4,}`, c(''), `${c('Oo')}${c('')}`, `[Oo]${c('Rr')}`,
  `${c('AaNn')}${c('')}{2}`, `[Aa]${c('Nn')}${c('')}`, `[Aa][Nn]${c('Dd')}`,
  `[Nn]${c('Oo')}${c('')}`, `[Nn][Oo]${c('Tt')}`].join('|');
export const plainSearch = {regex: `\\s*(?:${term})(?:\\s+(?:${term}))*\\s*`};
const sameWords = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export function nextGithubPack() {
  const pack = currentGithubPack();
  pack.version = '0.6.0';
  pack.variables.repository.description = 'Optional exact OWNER/REPO for CLI and MCP. Listed CLI commands use -R/--repo, list --search/-S takes plain terms without qualifiers or boolean operators, and gh api accepts inline GraphQL reads rooted at this repository and plain GETs of repos/OWNER/REPO/ paths. Unknown targets deny.';
  const selector = {regex: `[1-9][0-9]*|${branch}`};
  const listPrefix = [{one_of: ['issue', 'pr']}, 'list'];
  const viewPrefix = [{one_of: ['issue', 'pr']}, 'view'];
  const diffPrefix = ['pr', {one_of: ['diff', 'checks']}];
  const scope = pack.preconditions.find(gate => gate.id === 'cli-scope');
  const gateBranch = prefix => scope.requires_any.find(alternative => sameWords(alternative.arguments?.prefix, prefix)).arguments;
  const rule = id => pack.rules.find(item => item.id === id);
  // Unscoped lists accept -S like --search; scoped lists accept only plain terms.
  rule('issue-pr-list').conditions.arguments.values.splice(rule('issue-pr-list').conditions.arguments.values.indexOf('--search') + 1, 0, '-S');
  gateBranch(listPrefix).values.splice(2, 0, {name: '--search', match: plainSearch}, {name: '-S', match: plainSearch});
  // cli-scope is at Shield's 16-alternative limit, so issue view shares the
  // widened selector there; its allow rule keeps numbers, leaving branches unlisted.
  gateBranch(viewPrefix).operands.match = selector;
  gateBranch(diffPrefix).operands.match = selector;
  rule('pr-diff-checks').conditions.arguments.operands.match = selector;
  const view = rule('issue-pr-view');
  const index = pack.rules.indexOf(view);
  pack.rules.splice(index + 1, 0, {...structuredClone(view), id: 'pr-view-branch',
    conditions: {...structuredClone(view.conditions), arguments: {...structuredClone(view.conditions.arguments),
      prefix: ['pr', 'view'], operands: {match: {regex: branch}, min: 1, max: 1}}},
    reason: 'Read the pull request whose head is this branch using listed options.'});
  scope.on_unmet.message = 'With the repository setting, gh runs only the listed commands and options, with -R {{repository}}. pr view, diff and checks take a PR number or branch name, not a URL; issue view takes a number. list --search/-S takes plain terms: no qualifiers such as repo:, no OR/AND/NOT and no parentheses. Remove unlisted options or operands, then retry.';
  // An additional refusal only: cli-scope still requires the exact repository.
  const repositoryOptions = values => ({kind: 'options', prefix: [], flags: [], values, operands: true,
    unknown_options: 'skip', require_any: ['-R', '--repo']});
  pack.preconditions.splice(pack.preconditions.indexOf(scope) + 1, 0, {id: 'cli-repository', when: scope.when,
    conditions: {domain: 'argv', executable: scope.conditions.executable, arguments: repositoryOptions(['-R', '--repo'])},
    requires_any: [{arguments: repositoryOptions(['-R', '--repo'].map(name => ({name, match: {var: 'repository'}})))}],
    on_unmet: {decision: 'deny', message: '-R/--repo must name {{repository}}; the project\'s GitHub setting allows no other repository. Use -R {{repository}}, then retry.'}});
  return addMutations(pack);
}
// 0.6.0 also adds reviewed GraphQL mutations (graphql-mutations-v1). Mutations
// name their targets by opaque node IDs, which Shield cannot attribute to a
// repository, so each listed mutation takes the profile row of its CLI equivalent
// and, with the repository setting, asks unless repository_writes is profile.
// Inputs and payloads follow https://docs.github.com/en/graphql/reference/mutations.
const profiles = (loose, recommended = loose, strict = recommended) => ({loose, recommended, strict});
const input = fields => ({input: {required: true, match: {object: {...fields, clientMutationId: scalar('string')}}}});
const id = {...scalar('string'), required: true};
const body = {...scalar('string'), required: true};
const merge = {pullRequestId: id, mergeMethod: scalar('enum'), commitHeadline: scalar('string'),
  commitBody: scalar('string'), expectedHeadOid: scalar('string'), authorEmail: scalar('string')};
// Each class reuses the decisions of the matching CLI rows: issue-pr-change,
// pr-merge and issue-delete.
export const mutationClasses = [
  {id: 'routine', decision: profiles('allow', 'allow', 'ask'),
    reason: 'Resolve review threads, reply, comment or edit comments through a reviewed GraphQL mutation; its target is an unverified node ID.',
    fields: {
      resolveReviewThread: [{threadId: id}, 'threadPayload'],
      unresolveReviewThread: [{threadId: id}, 'threadPayload'],
      addPullRequestReviewThreadReply: [{pullRequestReviewThreadId: id, pullRequestReviewId: scalar('string'), body}, 'replyPayload'],
      addComment: [{subjectId: id, body}, 'addCommentPayload'],
      updateIssueComment: [{id, body}, 'issueCommentPayload'],
      updatePullRequestReviewComment: [{pullRequestReviewCommentId: id, body}, 'reviewCommentPayload'],
    }},
  {id: 'merge', decision: profiles('allow', 'ask', 'ask'),
    reason: 'Merge a pull request or change its auto-merge through a reviewed GraphQL mutation; its target is an unverified node ID.',
    fields: {
      mergePullRequest: [merge, 'pullRequestPayload'],
      enablePullRequestAutoMerge: [merge, 'pullRequestPayload'],
      disablePullRequestAutoMerge: [{pullRequestId: id}, 'pullRequestPayload'],
    }},
  {id: 'destructive', decision: profiles('ask', 'ask', 'deny'),
    reason: 'Delete a comment through a reviewed GraphQL mutation; review the target and consequences.',
    fields: {
      deleteIssueComment: [{id}, 'deletePayload'],
      deletePullRequestReviewComment: [{id}, 'deletePayload'],
    }},
];
export const mutationFields = mutationClasses.flatMap(group => Object.keys(group.fields));
// Payloads return the changed object's own leaves; none reaches a repository,
// owner, viewer or another object's collections.
export function mutationModel() {
  const fields = {};
  for (const group of mutationClasses) for (const [name, [arguments_, payload]] of Object.entries(group.fields))
    fields[name] = select(payload, input(arguments_));
  return {root: 'mutation', states: {
    mutation: state('Mutation', fields),
    threadPayload: state('ResolveReviewThreadPayload UnresolveReviewThreadPayload', {...leaf('__typename clientMutationId'), thread: select('thread')}),
    thread: state('PullRequestReviewThread', leaf('__typename id isResolved isOutdated path line')),
    replyPayload: state('AddPullRequestReviewThreadReplyPayload', {...leaf('__typename clientMutationId'), comment: select('reviewComment')}),
    reviewCommentPayload: state('UpdatePullRequestReviewCommentPayload', {...leaf('__typename clientMutationId'), pullRequestReviewComment: select('reviewComment')}),
    reviewComment: state('PullRequestReviewComment', leaf('__typename id databaseId url body createdAt updatedAt path line')),
    addCommentPayload: state('AddCommentPayload', {...leaf('__typename clientMutationId'), commentEdge: select('commentEdge')}),
    commentEdge: state('IssueCommentEdge', {...leaf('__typename cursor'), node: select('issueComment')}),
    issueCommentPayload: state('UpdateIssueCommentPayload', {...leaf('__typename clientMutationId'), issueComment: select('issueComment')}),
    issueComment: state('IssueComment', leaf('__typename id databaseId url body createdAt updatedAt')),
    pullRequestPayload: state('MergePullRequestPayload EnablePullRequestAutoMergePayload DisablePullRequestAutoMergePayload',
      {...leaf('__typename clientMutationId'), pullRequest: select('pullRequest')}),
    pullRequest: state('PullRequest', leaf('__typename id number url state merged closed')),
    deletePayload: state('DeleteIssueCommentPayload DeletePullRequestReviewCommentPayload', leaf('__typename clientMutationId')),
  }};
}
function addMutations(pack) {
  pack.engines.shield = '>=0.31.0, <1.0.0';
  pack.capabilities.push('graphql-mutations-v1');
  pack.variables.repository.description = 'Optional exact OWNER/REPO for CLI and MCP. Listed CLI commands use -R/--repo, list --search/-S takes plain terms without qualifiers or boolean operators, and gh api accepts inline GraphQL reads rooted at this repository, plain GETs of repos/OWNER/REPO/ paths and listed GraphQL mutations, whose targets it cannot verify. Unknown targets deny.';
  pack.variables.repository_writes = {type: 'choice',
    description: 'With the repository setting, how listed GraphQL mutations are decided. Their node-ID targets cannot be verified as inside the repository: ask (default) asks in every profile; profile uses their profile decision and does not confine writes to the repository.',
    values: ['ask', 'profile'],
    setup: {question: 'Ask before GraphQL writes whose repository cannot be verified?', unset: 'Ask for every listed mutation', ask_when: [{var: 'repository', set: true}]}};
  const model = mutationModel();
  const all = {carrier: 'gh-api', operation: 'mutation', root_fields: mutationFields, selection: model};
  const scope = pack.preconditions.find(gate => gate.id === 'cli-api-scope');
  scope.requires_any.push({graphql: all});
  scope.on_unmet.message = 'With the repository setting, gh api accepts inline GraphQL query reads rooted at {{repository}}, listed GraphQL mutations and plain GETs of repos/{{repository}}/... paths, with only --paginate, --slurp, --include, --silent, --verbose or -X GET. Remove fields, --input, headers, other hosts, --jq/--template and unlisted mutations or fields, then retry.';
  const {executable} = scope.conditions;
  const api = {kind: 'prefix', values: ['api']};
  for (const group of mutationClasses) pack.rules.push({id: `graphql-mutation-${group.id}`,
    conditions: {domain: 'argv', executable, arguments: api,
      graphql: {...all, root_fields: Object.keys(group.fields)}},
    decision: group.decision, reason: group.reason});
  // Equal-rank rules resolve to the strictest decision, so this overlay turns a
  // class's Allow into Ask and leaves a stricter Deny in place.
  const overlay = {conditions: {domain: 'argv', executable, arguments: api, graphql: all},
    decision: profiles('ask'),
    reason: 'With the repository setting, a listed GraphQL mutation names its target by node ID, which cannot be verified as inside {{repository}}. Confirm the target before approving.'};
  pack.rules.push(
    {id: 'graphql-mutation-unverified-target', when: [{var: 'repository', set: true}, {var: 'repository_writes', set: false}], ...overlay},
    {id: 'graphql-mutation-unverified-target-ask', when: [{var: 'repository', set: true}, {var: 'repository_writes', equals: 'ask'}], ...overlay});
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
export const buildNextGithubPack = () => writePack(nextGithubPack(), nextDestination);
// Default: the current candidate. Pass 0.4.0 or 0.5.0 to reproduce a published release.
const builds = {'0.4.0': buildGraphqlGithubPack, '0.5.0': buildCurrentGithubPack};
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await (builds[process.argv[2]] ?? buildNextGithubPack)();

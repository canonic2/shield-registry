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
// 0.7.0: read commands allow options the grammars do not list, and the
// repository setting checks the target instead of every option. Listed rules
// keep Strict exhaustive: their rank-2 Allow outranks the rank-1 read rule.
export const destination070 = new URL('../packs/canonic/github/0.7.0/', import.meta.url);
const readCommands = [{one_of: ['issue', 'pr', 'run', 'workflow', 'release', 'repo']}, {one_of: ['list', 'view', 'diff', 'checks']}];
// gh's --jq runs gojq, which reaches beyond the response only through env and
// $ENV (gh loads no modules); --template has no environment function. Tokens
// naming them ask, including a short cluster such as -qenv, where no word
// boundary separates the option from the expression.
const environmentWord = '(?s:.*(?:\\benv\\b|\\$ENV\\b|\\binclude\\b|\\bimport\\b).*)';
const outputExpressions = [{regex: environmentWord}, {regex: '-[A-Za-z0-9]*[qt](?s:.*(?:env|ENV|include|import).*)'}];
const quietExpression = {not: {regex: environmentWord}};
// Tokens naming another target: a URL (gh ignores -R for it), OWNER/REPO#N and owner:branch.
const otherTarget = '(?i:[a-z][a-z0-9+.-]*://)(?s:.*)|[^\\s#/]+/[^\\s#/]+#(?s:.*)|[^\\s:/-][^\\s:/]*:\\S*';
// List tokens also exclude what GitHub search applies across the query: qualifiers,
// parentheses, quotes and the words OR, AND and NOT.
const searchWidening = '(?s:.*[:()"].*)|(?s:(?:.*\\s)?)(?i:or|and|not)(?s:(?:\\s.*)?)';
const tokens = regex => ({kind: 'each', match: {not: {regex}}});
export function githubPack070() {
  const pack = nextGithubPack();
  pack.version = '0.7.0';
  const executable = pack.rules.find(rule => rule.id === 'issue-pr-view').conditions.executable;
  const index = pack.rules.findIndex(rule => rule.id === 'cli-unlisted');
  pack.rules.splice(index, 0,
    // No leading options: the risk rule's prefix cannot skip them either.
    {id: 'read-options', conditions: {domain: 'argv', executable, arguments: {kind: 'prefix', values: readCommands}},
      decision: {loose: 'allow', recommended: 'allow', strict: 'ask'}, reason: 'Read GitHub metadata with options the listed forms do not name.'},
    {id: 'read-output-expression', conditions: {domain: 'argv', executable, arguments: {kind: 'risk_tokens', prefix: readCommands, any_of: outputExpressions}},
      decision: {loose: 'ask', recommended: 'ask', strict: 'ask'}, reason: 'Review --jq and --template expressions that read environment values.'});
  // Scoped REST reads also accept output expressions that read no environment.
  const expressions = ['-q', '--jq', '-t', '--template'].map(name => ({name, match: quietExpression}));
  const restReads = [...pack.preconditions.flatMap(gate => [gate.conditions.arguments, ...gate.requires_any.map(item => item.arguments)]),
    ...pack.rules.filter(rule => rule.id.startsWith('repository-rest-read-')).map(rule => rule.conditions.arguments)]
    .filter(grammar => grammar?.kind === 'options' && sameWords(grammar.prefix, ['api']));
  for (const grammar of restReads) grammar.values.push(...expressions);
  const api = pack.preconditions.find(gate => gate.id === 'cli-api-scope');
  api.on_unmet.message = api.on_unmet.message.replace('--jq/--template', '--jq/--template expressions that read env or $ENV');
  const scope = pack.preconditions.find(gate => gate.id === 'cli-scope');
  // Merge the three local forms into one alternative to stay within 16.
  const local = ['--version', '--help', 'help'];
  scope.requires_any = scope.requires_any.filter(item => !(item.arguments?.kind === 'exact' && local.includes(item.arguments.values[0])));
  scope.requires_any.unshift({arguments: {kind: 'sequence', prefix: [{one_of: local}], rest: {kind: 'none'}}});
  scope.requires_any.push(
    {arguments: {kind: 'sequence', prefix: [{one_of: ['issue', 'pr', 'run', 'workflow', 'release']}, 'list'], rest: tokens(`${searchWidening}|${otherTarget}`)}},
    {arguments: {kind: 'sequence', prefix: [{one_of: ['issue', 'pr', 'run']}, {one_of: ['view', 'diff', 'checks', 'create', 'comment', 'edit', 'close', 'reopen', 'merge']}], rest: tokens(otherTarget)}});
  scope.on_unmet.message = 'With the repository setting, gh runs issue, pr and run commands with -R {{repository}}. Selectors are a PR number or branch name: URLs, OWNER/REPO#N and owner:branch name other targets. list --search/-S takes plain terms: no qualifiers such as repo:, no OR/AND/NOT, parentheses or quotes. Other commands take listed options only. Change the request, then retry.';
  // The loose alternatives cannot require -R, so this gate does; cli-repository checks its value.
  const present = {kind: 'options', prefix: [], flags: [], values: ['-R', '--repo'], operands: true, unknown_options: 'skip', require_any: ['-R', '--repo']};
  pack.preconditions.splice(pack.preconditions.findIndex(gate => gate.id === 'cli-repository') + 1, 0, {id: 'cli-repository-required', when: scope.when,
    conditions: {domain: 'argv', executable, arguments: {kind: 'sequence', prefix: [{one_of: ['issue', 'pr', 'run', 'workflow', 'release']},
      {one_of: ['list', 'view', 'diff', 'checks', 'create', 'comment', 'edit', 'close', 'reopen', 'merge']}], rest: {kind: 'any'}}},
    requires_any: [{arguments: present}],
    on_unmet: {decision: 'deny', message: 'Add -R {{repository}}: without it gh chooses the repository from the local checkout. Then retry.'}});
  return pack;
}
// REST scope checks parse the API interface independently of its permission.
// Body, method and output options do not turn a known repository into an
// unknown target. Unsupported effects still reach cli-unlisted's Ask.
export const destination071 = new URL('../packs/canonic/github/0.7.1/', import.meta.url);
function restRequest(path) {
  return {kind: 'options', prefix: ['api'],
    flags: ['--allow-escape-sequences', '-i', '--include', '--paginate', '--silent', '--slurp', '--verbose', '--help'],
    values: ['--cache', '-F', '--field', '-H', '--header', '--input', '-q', '--jq', '-X', '--method', '-p', '--preview', '-f', '--raw-field', '-t', '--template',
      {name: '--hostname', match: 'github.com'}],
    operands: {match: path, min: 1, max: 1}};
}
export function githubPack071() {
  const pack = githubPack070();
  pack.version = '0.7.1';
  pack.variables.repository.description = 'Optional exact OWNER/REPO for CLI and MCP. Listed CLI commands use -R/--repo; inline GraphQL reads verify selections, listed mutations ask for unverified targets, and literal REST requests under repos/OWNER/REPO/ pass the target boundary. Plain REST GETs allow; bodies and other unreviewed effects ask. Unknown targets deny.';
  const scope = pack.preconditions.find(gate => gate.id === 'cli-api-scope');
  scope.requires_any.push({arguments: restRequest(repositoryPath)});
  scope.on_unmet.message = 'With the repository setting, use one literal REST endpoint under repos/{{repository}}/... on github.com, or a supported inline GraphQL request. Other repositories, hosts and unresolved targets are refused. REST requests with bodies, custom headers or other unreviewed effects require approval.';
  const path = pack.preconditions.find(gate => gate.id === 'cli-api-path');
  path.conditions.arguments = restRequest(repositoryPath);
  path.requires_any = [{arguments: restRequest(literalPath)}];
  return pack;
}
export const destination080 = new URL('../packs/canonic/github/0.8.0/', import.meta.url);
export function githubPack080() {
  const pack = githubPack071();
  pack.version = '0.8.0';
  pack.description = 'GitHub CLI and official MCP permissions. Optional OWNER/REPO target setting; GraphQL query roots must match it, with unrestricted nested reads. Mutations retain separate reviewed permissions.';
  pack.engines.shield = '>=0.39.0, <1.0.0';
  pack.capabilities.push('graphql-subtree-v1');
  pack.variables.repository.description = 'Optional exact OWNER/REPO for CLI and MCP. GraphQL queries must start every root at that repository; all nested reads, including related repositories and owners, are allowed. Listed mutations retain their separate target-review policy. REST requests require a literal repos/OWNER/REPO/ endpoint.';
  const root = repositoryModel().states.query;
  root.fields.repository = {arguments: root.fields.repository.arguments, subtree: true};
  const gate = pack.preconditions.find(gate => gate.id === 'cli-graphql-scope');
  gate.requires_any = [{graphql: {carrier:'gh-api', operation:'query', selection:{root:'query', states:{query:root}}}}];
  gate.on_unmet.message = 'Start every GraphQL query root at repository(owner, name) for {{repository}}. Other roots and repository targets are refused. Nested selections beneath a matching root are unrestricted; use a supported inline query with verified root arguments.';
  return pack;
}
// 0.8.1: github.com is the default and the only accepted host, so naming it
// explicitly leaves a plain REST GET a read. Other hosts still fail the grammar.
export const destination081 = new URL('../packs/canonic/github/0.8.1/', import.meta.url);
export function githubPack081() {
  const pack = githubPack080();
  pack.version = '0.8.1';
  const plainGet = grammar => grammar?.kind === 'options' && sameWords(grammar.prefix, ['api'])
    && grammar.values.some(value => value.name === '-X' && value.match === 'GET');
  const grammars = [...pack.preconditions.flatMap(gate => [gate.conditions.arguments, ...gate.requires_any.map(item => item.arguments)]),
    ...pack.rules.map(rule => rule.conditions.arguments)].filter(plainGet);
  for (const grammar of new Set(grammars)) grammar.values.push({name: '--hostname', match: 'github.com'});
  const api = pack.preconditions.find(gate => gate.id === 'cli-api-scope');
  api.on_unmet.message = 'With the repository setting, use one literal REST endpoint under repos/{{repository}}/... on github.com, or a supported inline GraphQL request. Other repositories, hosts and unresolved targets are refused. Plain GETs allow, including with --hostname github.com; REST requests with bodies, custom headers or other unreviewed effects require approval.';
  return pack;
}
// 0.9.0: the repository setting lists several OWNER/REPO values, such as a fork
// and its upstream. Plain -R/--repo matches take any listed value; split owner
// and name fields and joined repos/OWNER/REPO/ prefixes sit in requires_any
// branches, which Shield repeats per value (variable-list-branches-v1) so an
// owner and a name always come from the same value. A bound string from earlier
// releases reads as a one-item list, so existing settings keep their meaning.
export const destination090 = new URL('../packs/canonic/github/0.9.0/', import.meta.url);
// cli-api-scope keeps two GraphQL alternatives beside one repeated REST branch,
// and Shield allows 16 alternatives.
export const maxRepositories = 8;
// Messages are capped at 512 bytes, which a full list may not fit, so they name
// the setting instead of rendering it; rule reasons render it.
const listed = 'a repository listed in the project\'s GitHub repository setting';
export function githubPack090() {
  const pack = githubPack081();
  pack.version = '0.9.0';
  pack.description = 'GitHub CLI and official MCP permissions. Optional list of OWNER/REPO targets; GraphQL query roots must match one of them, with unrestricted nested reads. Mutations retain separate reviewed permissions.';
  // variable-list-branches-v1 first shipped in Shield 0.47.0.
  pack.engines.shield = '>=0.47.0, <1.0.0';
  pack.capabilities.push('variable-list-branches-v1');
  const {match, max_length} = pack.variables.repository;
  pack.variables.repository = {type: 'list',
    description: 'Optional exact OWNER/REPO values for CLI and MCP, such as a fork and its upstream. Requests must name one listed repository. GraphQL queries must start every root at the same listed repository; all nested reads, including related repositories and owners, are allowed. Listed mutations retain their separate target-review policy. REST requests require a literal repos/OWNER/REPO/ endpoint.',
    items: {type: 'string', match, max_length}, max_items: maxRepositories,
    setup: {question: 'Limit GitHub operations to these repositories?', unset: 'Any repository (no scope check)',
      value: 'Only these repositories', placeholder: 'acme/web, acme-forks/web'}};
  const gate = id => pack.preconditions.find(item => item.id === id);
  const plainGet = grammar => grammar?.values.some(value => value.name === '-X' && value.match === 'GET');
  const repos = {prefix: 'repos/'};
  // The REST request branch admits every plain GET the read branch did.
  const api = gate('cli-api-scope');
  api.requires_any = api.requires_any.filter(item => !plainGet(item.arguments));
  api.on_unmet.message = `With the repository setting, use one literal REST endpoint repos/OWNER/REPO/... on github.com for ${listed}, or a supported inline GraphQL request. Other repositories, hosts and unresolved targets are refused. Plain GETs allow, including with --hostname github.com; REST requests with bodies, custom headers or other unreviewed effects require approval.`;
  // Rules and conditions cannot repeat per value, so they recognize every
  // repos/ path; cli-api-scope confines the repository and cli-api-path the spelling.
  const path = gate('cli-api-path');
  path.conditions.arguments = {...structuredClone(path.conditions.arguments), operands: {...path.conditions.arguments.operands, match: repos}};
  path.on_unmet.message = 'Write the REST path literally as repos/OWNER/REPO/...: dot segments, percent escapes, {owner}/{repo} placeholders, backslashes and spaces are refused.';
  for (const rule of pack.rules.filter(rule => rule.id.startsWith('repository-rest-read-'))) {
    rule.conditions.arguments.operands = {...rule.conditions.arguments.operands, match: repos};
    rule.reason = 'Read a configured repository through a plain REST GET; the scope gate confines the repository and the path gate refuses traversal and placeholders.';
  }
  gate('cli-scope').on_unmet.message = `With the repository setting, gh runs issue, pr and run commands with -R naming ${listed}. Selectors are a PR number or branch name: URLs, OWNER/REPO#N and owner:branch name other targets. list --search/-S takes plain terms: no qualifiers such as repo:, no OR/AND/NOT, parentheses or quotes. Other commands take listed options only. Change the request, then retry.`;
  gate('cli-repository').on_unmet.message = `-R/--repo must name ${listed}; no other repository is allowed. Use a listed repository, then retry.`;
  gate('cli-repository-required').on_unmet.message = `Add -R naming ${listed}: without it gh chooses the repository from the local checkout. Then retry.`;
  gate('cli-graphql-scope').on_unmet.message = `Start every GraphQL query root at repository(owner, name) for ${listed}, all roots naming the same one. Other roots and repository targets are refused; send one query per repository. Nested selections beneath a matching root are unrestricted.`;
  for (const rule of pack.rules.filter(rule => rule.id.startsWith('graphql-mutation-unverified-target')))
    rule.reason = 'With the repository setting, a listed GraphQL mutation names its target by node ID, which cannot be verified as inside one of {{repository}}. Confirm the target before approving.';
  return pack;
}
export const destination0100 = new URL('../packs/canonic/github/0.10.0/', import.meta.url);

// gh appends the visibility flag's is:public to the keywords. The search
// service can OR repeated is: qualifiers, so the flag alone is insufficient.
const publicSearchTerm = {not: {regex: '(?s:.*(?:(?i:\\b(?:is|visibility)\\s*[:：])|["()\\\\\\p{Cc}\\p{Cf}]).*)|(?:.*\\s)?(?:OR|AND|NOT)(?:\\s.*)?'}};
const repositorySearch = ['search', 'repos'];
const publicRepositorySearch = {
  kind: 'options', prefix: repositorySearch, flags: ['--help', '--web', '-w'],
  optional_values: ['--archived'],
  values: [
    {name: '--visibility', match: 'public'},
    ...['--created', '--followers', '--forks', '--good-first-issues', '--help-wanted-issues',
      '--include-forks', '--language', '--license', '--match', '--number-topics', '--owner',
      '--size', '--stars', '--topic', '--updated'].map(name => ({name, match: publicSearchTerm})),
    '--json', '--limit', '-L', '--order', '--sort',
    ...['--jq', '-q', '--template', '-t'].map(name => ({name, match: quietExpression})),
  ],
  operands: {match: publicSearchTerm}, require_all: ['--visibility'],
  short_attached: true, short_clusters: true,
};

export function githubPack0100() {
  const pack = githubPack090();
  pack.version = '0.10.0';
  pack.description += ' Public repository searches allow; other repository searches require review.';
  pack.variables.repository.description = pack.variables.repository.description.replace(
    'Requests must name one listed repository.',
    'Repository-scoped requests must name one listed repository. Public repository searches allow and other repository searches require review.');
  const scope = pack.preconditions.find(gate => gate.id === 'cli-scope');
  const {executable} = scope.conditions;
  const api = scope.requires_any.findIndex(({arguments: args}) =>
    args?.kind === 'prefix' && sameWords(args.values, ['api']));
  scope.requires_any[api] = {arguments: {kind: 'prefix', values: [{one_of: ['api', 'search']}]}};
  const prefix = values => ({domain: 'argv', executable, arguments: {kind: 'prefix', values}});
  pack.preconditions.push(
    {id: 'cli-search-scope', when: scope.when, conditions: prefix(['search']),
      requires_any: [{arguments: {kind: 'prefix', values: repositorySearch}}],
      on_unmet: {decision: 'deny', message: 'With the repository setting, only gh search repos is supported for global search.'}},
    {id: 'cli-public-repository-search', conditions: prefix(repositorySearch),
      requires_any: [{arguments: publicRepositorySearch}],
      on_unmet: {decision: 'ask', message: 'Review repository searches whose public-only scope or options cannot be verified. For public discovery, use gh search repos --visibility=public with ordinary search terms and avoid adding visibility qualifiers to the query.'}},
  );
  const index = pack.rules.findIndex(rule => rule.id === 'cli-unlisted');
  pack.rules.splice(index, 0, {id: 'repository-search-public', conditions: prefix(repositorySearch),
    decision: 'allow', reason: 'Search public repositories with reviewed query and output arguments.'});
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
export const buildGithubPack070 = () => writePack(githubPack070(), destination070);
export const buildGithubPack071 = () => writePack(githubPack071(), destination071);
export const buildGithubPack080 = () => writePack(githubPack080(), destination080);
export const buildGithubPack081 = () => writePack(githubPack081(), destination081);
export const buildGithubPack090 = () => writePack(githubPack090(), destination090);
export const buildGithubPack0100 = () => writePack(githubPack0100(), destination0100);
// Default: the current candidate. A version argument reproduces a published release.
const builds = {'0.4.0': buildGraphqlGithubPack, '0.5.0': buildCurrentGithubPack, '0.6.0': buildNextGithubPack, '0.7.0': buildGithubPack070, '0.7.1': buildGithubPack071, '0.8.0': buildGithubPack080, '0.8.1': buildGithubPack081, '0.9.0': buildGithubPack090};
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await (builds[process.argv[2]] ?? buildGithubPack0100)();

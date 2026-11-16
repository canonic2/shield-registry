import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {usableGithubCases} from './build-github-usable-cases.mjs';
import {destination, currentDestination, nextDestination, destination070, destination071} from './build-github-graphql-pack.mjs';
import {splitCaseFiles} from './fixture-files.mjs';

export const reviewQuery = `query { repository(owner:"acme", name:"web") { pullRequest(number:12) {
  reviewThreads(first:100) { pageInfo { hasNextPage endCursor } nodes {
    id isResolved isOutdated path line diffSide comments(first:100) {
      pageInfo { hasNextPage endCursor } nodes { id databaseId url author { login } body createdAt originalCommit { oid } }
    }
  } }
  reviews(first:100) { pageInfo { hasNextPage endCursor } nodes { id author { login } body state commit { oid } } }
  comments(first:100) { pageInfo { hasNextPage endCursor } nodes { id url author { login } body } }
} } }`;
export function graphqlGithubCases() {
  const cases = usableGithubCases().map(row => row.name.startsWith('unscoped-api-') ? {...row, expected: 'allow'} : row);
  const read = '{ repository(owner:"acme",name:"web") { nameWithOwner } }';
  const variable = 'query Read($owner:String!="acme",$endCursor:String) { repository(owner:$owner,name:"web") { issues(first:10,after:$endCursor) { pageInfo { hasNextPage endCursor } nodes { title } } } }';
  const inputs = [
    ['review', reviewQuery, [], true, true],
    ['read', read, [], true, true],
    ['escaped', read.replace('acme', 'a\\u0063me'), [], true, true],
    ['variables', variable, [], true, true],
    ['paginate', variable, ['--paginate'], true, true],
    ['named-read', `query Read ${read} mutation Write { field }`, ['-f', 'operationName=Read'], true, true],
    ['named-write', `query Read ${read} mutation Write { field }`, ['-f', 'operationName=Write'], false, false],
    ['fragment', '{ repository(owner:"acme",name:"web") { ...R } } fragment R on Repository { nameWithOwner }', [], true, true],
    ['outside', read.replace('acme', 'other'), [], true, false],
    ['sibling', read.replace(' } }', ' } other:repository(owner:"other",name:"web"){nameWithOwner} }'), [], true, false],
    ['parent', '{repository(owner:"acme",name:"web"){parent{nameWithOwner}}}', [], true, false],
    ['head-repository', '{repository(owner:"acme",name:"web"){pullRequest(number:12){headRepository{nameWithOwner}}}}', [], true, false],
    ['actor-escape', '{repository(owner:"acme",name:"web"){pullRequest(number:12){author{... on User {repositories(first:1){nodes{nameWithOwner}}}}}}}', [], true, false],
    ['alias', '{repository:viewer{login}}', [], true, false],
    ['opaque-node', '{node(id:"example"){id}}', [], true, false],
    ['mutation', 'mutation { resolveReviewThread(input:{threadId:"example"}){thread{id}} }', [], false, false],
    ['duplicate-argument', '{repository(owner:"acme",owner:"other",name:"web"){nameWithOwner}}', [], false, false],
    ['cycle', '{...A} fragment A on Query {...A}', [], false, false],
    ['missing-fragment', '{...Missing}', [], false, false],
    ['unknown-directive', '{viewer @future {login}}', [], false, false],
    ['conditional-escape', '{repository(owner:"acme",name:"web"){parent @skip(if:true){nameWithOwner}}}', [], true, false],
    ['cursor-escape', variable.replace('owner:$owner', 'owner:$endCursor'), ['--paginate'], false, false],
    ['duplicate-query', read, ['-f', 'query={viewer{login}}'], false, false],
    ['file-input', read, ['--input', 'request.json'], false, false],
    ['other-host', read, ['--hostname', 'example.com'], false, false],
    ['output-expression', read, ['--jq', '.data'], false, false],
  ];
  for (const scoped of [false, true]) for (const profile of ['loose','recommended','strict']) {
    for (const [name,query,extra,unscoped,inside] of inputs) cases.push({
      name: `${scoped ? 'scoped':'unscoped'}-graphql-${name}-${profile}`, profile,
      ...(scoped ? {variables:{repository:'acme/web'}} : {}),
      argv:['gh','api','graphql','-f',`query=${query}`,...extra],
      expected: scoped ? inside ? 'allow':'deny' : unscoped ? 'allow':'ask',
    });
  }
  return cases;
}
// Observed 2026-11-10: a scoped review read selecting thread and comment diff positions.
export const reviewLinesQuery = `query { repository(owner:"acme", name:"web") { pullRequest(number:12) {
  reviewThreads(first:100) { pageInfo { hasNextPage endCursor } nodes {
    id isResolved isOutdated path line originalLine startLine originalStartLine diffSide comments(first:100) {
      pageInfo { hasNextPage endCursor } nodes { id databaseId url author { login } body diffHunk path line originalLine
        startLine originalStartLine createdAt originalCommit { oid } }
    }
  } }
  reviews(first:100) { pageInfo { hasNextPage endCursor } nodes { id author { login } body state submittedAt
    comments(first:100) { nodes { id body diffHunk path originalLine } } } }
  comments(first:100) { pageInfo { hasNextPage endCursor } nodes { id url author { login } body createdAt } }
} } }`;
// Expected decisions per [unscoped, scoped]; scoped REST allows only plain GETs
// of literal repos/acme/web/ paths.
export function currentGithubCases() {
  const cases = graphqlGithubCases();
  const graphql = query => ['gh', 'api', 'graphql', '-f', `query=${query}`];
  const inputs = [
    ['graphql-review-lines', graphql(reviewLinesQuery), 'allow', 'allow'],
    ['graphql-review-lines-paginate', ['gh', 'api', '--paginate', 'graphql', '-f', `query=${reviewLinesQuery
      .replace('query {', 'query($endCursor: String) {').replace('reviewThreads(first:100)', 'reviewThreads(first:100, after:$endCursor)')}`], 'allow', 'allow'],
    // Without a declared $endCursor, --paginate cannot be verified.
    ['graphql-review-lines-paginate-undeclared', ['gh', 'api', '--paginate', 'graphql', '-f', `query=${reviewLinesQuery}`], 'ask', 'deny'],
    // Real schema fields outside the reviewed model, including a cross-repository traversal.
    ['graphql-review-lines-unlisted-field', graphql(reviewLinesQuery.replace('diffHunk path', 'diffHunk path isMinimized')), 'allow', 'deny'],
    ['graphql-review-lines-comment-repository', graphql(reviewLinesQuery.replace('diffHunk path', 'diffHunk repository { nameWithOwner } path')), 'allow', 'deny'],
    ['graphql-review-lines-other-owner', graphql(reviewLinesQuery.replace('owner:"acme"', 'owner:"other"')), 'allow', 'deny'],
    ['graphql-review-lines-other-name', graphql(reviewLinesQuery.replace('name:"web"', 'name:"site"')), 'allow', 'deny'],
    ['graphql-review-lines-mutation', graphql('mutation { addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:"example",body:"ok"}){comment{id}} }'), 'ask', 'deny'],
    ['graphql-thread-original-line', graphql('{repository(owner:"acme",name:"web"){pullRequest(number:12){reviewThreads(first:10){nodes{originalLine originalStartLine}}}}}'), 'allow', 'allow'],
    ['graphql-input-only', ['gh', 'api', 'graphql', '--input', 'query.json'], 'ask', 'deny'],
    // Observed 2026-11-10: plain REST reads of the configured repository.
    ['rest-pull-comments', ['gh', 'api', 'repos/acme/web/pulls/12/comments', '--paginate'], 'ask', 'allow'],
    ['rest-pull-reviews', ['gh', 'api', 'repos/acme/web/pulls/12/reviews', '--paginate'], 'ask', 'allow'],
    ['rest-issue-comments', ['gh', 'api', 'repos/acme/web/issues/12/comments', '--paginate'], 'ask', 'allow'],
    ['rest-explicit-get', ['gh', 'api', '-X', 'GET', 'repos/acme/web/pulls/12/comments'], 'ask', 'allow'],
    ['rest-method-equals-get', ['gh', 'api', '--method=GET', 'repos/acme/web/pulls/12'], 'ask', 'allow'],
    ['rest-query-and-suffix', ['gh', 'api', '--include', 'repos/acme/web/pulls/12.diff?per_page=100'], 'ask', 'allow'],
    ['rest-leading-slash', ['gh', 'api', '/repos/acme/web/pulls/12'], 'ask', 'deny'],
    ['rest-repository-root', ['gh', 'api', 'repos/acme/web'], 'ask', 'deny'],
    ['rest-sibling-name', ['gh', 'api', 'repos/acme/web-other/pulls'], 'ask', 'deny'],
    ['rest-dot-segments', ['gh', 'api', 'repos/acme/web/../../other/web/pulls'], 'ask', 'deny'],
    ['rest-percent-escape', ['gh', 'api', 'repos/acme/web/%2e%2e/%2e%2e/other/web/pulls'], 'ask', 'deny'],
    ['rest-inner-placeholder', ['gh', 'api', 'repos/acme/web/compare/{branch}'], 'ask', 'deny'],
    ['rest-two-endpoints', ['gh', 'api', 'repos/acme/web/pulls', 'repos/other/web/pulls'], 'ask', 'deny'],
    ['rest-jq', ['gh', 'api', 'repos/acme/web/pulls', '--jq', '.[].title'], 'ask', 'deny'],
    ['rest-method-post', ['gh', 'api', '-X', 'POST', 'repos/acme/web/pulls'], 'ask', 'deny'],
    ['rest-field-post', ['gh', 'api', 'repos/acme/web/issues/12/comments', '-f', 'body=ok'], 'ask', 'deny'],
    ['rest-get-with-field', ['gh', 'api', '-X', 'GET', 'repos/acme/web/pulls', '-f', 'state=open'], 'ask', 'deny'],
    ['rest-method-patch', ['gh', 'api', '-X', 'PATCH', 'repos/acme/web/pulls/12', '-f', 'state=closed'], 'ask', 'deny'],
    ['rest-other-repository', ['gh', 'api', 'repos/other/web/pulls/12/comments'], 'ask', 'deny'],
    ['rest-placeholders', ['gh', 'api', 'repos/{owner}/{repo}/pulls/12/comments'], 'ask', 'deny'],
    ['rest-full-url', ['gh', 'api', 'https://api.github.com/repos/acme/web/pulls/12/comments'], 'ask', 'deny'],
    ['rest-header', ['gh', 'api', '-H', 'Accept: application/vnd.github+json', 'repos/acme/web/pulls/12/comments'], 'ask', 'deny'],
    ['rest-hostname', ['gh', 'api', '--hostname', 'example.com', 'repos/acme/web/pulls/12/comments'], 'ask', 'deny'],
    ['rest-input', ['gh', 'api', 'repos/acme/web/pulls/12/comments', '--input', 'body.json'], 'ask', 'deny'],
    ['api-bare', ['gh', 'api'], 'ask', 'deny'],
  ];
  for (const scoped of [false, true]) for (const profile of ['loose', 'recommended', 'strict'])
    for (const [name, argv, unscoped, inside] of inputs) cases.push({
      name: `${scoped ? 'scoped' : 'unscoped'}-${name}-${profile}`, profile,
      ...(scoped ? {variables: {repository: 'acme/web'}} : {}), argv, expected: scoped ? inside : unscoped,
    });
  return cases;
}
// Observed 2026-11-14: scoped PR lookups by ticket search and by branch name.
// Expected decisions per [unscoped, scoped].
export function nextGithubCases() {
  const cases = currentGithubCases();
  const list = search => ['gh', 'pr', 'list', '-R', 'acme/web', '--state', 'all', '--search', search, '--json', 'number,headRefName,state'];
  const inputs = [
    ['search-ticket', list('FHA-1524'), 'allow', 'allow'],
    ['search-words', list('invoice tags'), 'allow', 'allow'],
    ['search-short', ['gh', 'issue', 'list', '-R', 'acme/web', '-S', 'login bug'], 'allow', 'allow'],
    // Words that only begin with an operator are ordinary terms.
    ['search-operator-prefixes', list('ORACLE ANDROID NOTES or-gate'), 'allow', 'allow'],
    ['search-or', list('FHA-1524 OR FHA-1527'), 'allow', 'deny'],
    ['search-lowercase-or', list('FHA-1524 or FHA-1527'), 'allow', 'deny'],
    ['search-and', list('invoice AND tags'), 'allow', 'deny'],
    ['search-not', list('invoice NOT tags'), 'allow', 'deny'],
    ['search-parentheses', list('(invoice)'), 'allow', 'deny'],
    ['search-quoted', list('"invoice tags"'), 'allow', 'deny'],
    ['search-repo-qualifier', list('repo:other/web'), 'allow', 'deny'],
    ['search-org-qualifier', list('bug org:other'), 'allow', 'deny'],
    ['search-negated-qualifier', list('bug -repo:acme/web'), 'allow', 'deny'],
    ['search-short-qualifier', ['gh', 'pr', 'list', '-R', 'acme/web', '-S', 'repo:other/web'], 'allow', 'deny'],
    ['search-other-repository', ['gh', 'pr', 'list', '-R', 'other/web', '--search', 'FHA-1524'], 'allow', 'deny'],
    ['pr-view-branch', ['gh', 'pr', 'view', 'codex/FHA-1524-invoice-tags', '-R', 'acme/web', '--json', 'number,state,mergedAt'], 'allow', 'allow'],
    ['pr-view-branch-comments', ['gh', 'pr', 'view', 'fix-tags', '--comments', '-R', 'acme/web'], 'allow', 'allow'],
    ['pr-view-number', ['gh', 'pr', 'view', '12', '-R', 'acme/web', '--json', 'number'], 'allow', 'allow'],
    ['pr-diff-branch', ['gh', 'pr', 'diff', 'codex/fix', '-R', 'acme/web', '--name-only'], 'allow', 'allow'],
    ['pr-checks-branch', ['gh', 'pr', 'checks', 'release/1.2', '-R', 'acme/web', '--required'], 'allow', 'allow'],
    ['pr-view-branch-other-repository', ['gh', 'pr', 'view', 'fix', '-R', 'other/web'], 'allow', 'deny'],
    ['pr-view-url', ['gh', 'pr', 'view', 'https://github.com/other/web/pull/1', '-R', 'acme/web'], 'ask', 'deny'],
    ['pr-diff-url', ['gh', 'pr', 'diff', 'https://github.com/other/web/pull/1', '-R', 'acme/web'], 'ask', 'deny'],
    ['pr-view-fork-head', ['gh', 'pr', 'view', 'other:fix', '-R', 'acme/web'], 'ask', 'deny'],
    ['pr-view-hash-number', ['gh', 'pr', 'view', '#12', '-R', 'acme/web'], 'ask', 'deny'],
    ['pr-view-two-selectors', ['gh', 'pr', 'view', 'fix', '12', '-R', 'acme/web'], 'ask', 'deny'],
    ['pr-view-branch-web', ['gh', 'pr', 'view', 'fix', '--web', '-R', 'acme/web'], 'ask', 'deny'],
    // Issues have no branch selector; the scope admits the form but no rule allows it.
    ['issue-view-branch', ['gh', 'issue', 'view', 'fix', '-R', 'acme/web'], 'ask', 'ask'],
    ['issue-view-number', ['gh', 'issue', 'view', '12', '-R', 'acme/web'], 'allow', 'allow'],
    ['pr-view-missing-repository', ['gh', 'pr', 'view', 'fix'], 'allow', 'deny'],
  ];
  for (const scoped of [false, true]) for (const profile of ['loose', 'recommended', 'strict'])
    for (const [name, argv, unscoped, inside] of inputs) cases.push({
      name: `${scoped ? 'scoped' : 'unscoped'}-${name}-${profile}`, profile,
      ...(scoped ? {variables: {repository: 'acme/web'}} : {}), argv, expected: scoped ? inside : unscoped,
    });
  return mutationCases(cases);
}
// Profile rows of the matching CLI operations: comments and edits, merges,
// destructive changes, and unlisted requests.
const row = (loose, recommended, strict) => ({loose, recommended, strict});
const routine = row('allow', 'allow', 'ask'), merging = row('allow', 'ask', 'ask'),
  destructive = row('ask', 'ask', 'deny'), asked = row('ask', 'ask', 'ask'), denied = row('deny', 'deny', 'deny');
// Observed 2026-11-14: resolving two review threads in one aliased mutation.
// Expected decisions per [unscoped, scoped asking (unset or ask), scoped profile].
function mutationCases(cases) {
  const mutation = (query, ...extra) => ['gh', 'api', 'graphql', '-f', `query=${query}`, ...extra];
  const resolve = id => `resolveReviewThread(input:{threadId:"${id}"}){thread{id isResolved}}`;
  const merge = 'mergePullRequest(input:{pullRequestId:"PR_example",mergeMethod:SQUASH}){pullRequest{id merged}}';
  const remove = 'deleteIssueComment(input:{id:"IC_example"}){clientMutationId}';
  const inputs = [
    ['mutation-resolve-threads', mutation(`mutation{a:${resolve('PRRT_a')} b:${resolve('PRRT_b')}}`), routine, asked, routine],
    ['mutation-unresolve-variable', mutation('mutation($id:ID!){unresolveReviewThread(input:{threadId:$id}){thread{id}}}', '-f', 'id=PRRT_a'), routine, asked, routine],
    ['mutation-thread-reply', mutation('mutation{addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:"PRRT_a",body:"Fixed."}){comment{id url}}}'), routine, asked, routine],
    ['mutation-add-comment', mutation('mutation{addComment(input:{subjectId:"PR_example",body:"Thanks"}){commentEdge{node{id url}}}}'), routine, asked, routine],
    ['mutation-edit-comment', mutation('mutation{updateIssueComment(input:{id:"IC_example",body:"Edited"}){issueComment{id body}}}'), routine, asked, routine],
    ['mutation-merge', mutation(`mutation{${merge}}`), merging, asked, merging],
    ['mutation-auto-merge', mutation('mutation{enablePullRequestAutoMerge(input:{pullRequestId:"PR_example"}){clientMutationId}}'), merging, asked, merging],
    ['mutation-delete-comment', mutation(`mutation{${remove}}`), destructive, destructive, destructive],
    // A batch takes its strictest class.
    ['mutation-resolve-and-merge', mutation(`mutation{${resolve('PRRT_a')} ${merge}}`), merging, asked, merging],
    ['mutation-resolve-and-delete', mutation(`mutation{${resolve('PRRT_a')} ${remove}}`), destructive, destructive, destructive],
    // Skipped fields, fragments and operation selection still count; aliases do not rename.
    ['mutation-skipped-merge', mutation(`mutation($skip:Boolean=true){${resolve('PRRT_a')} mergePullRequest(input:{pullRequestId:"PR_example"}) @skip(if:$skip){clientMutationId}}`), merging, asked, merging],
    ['mutation-fragment-delete', mutation(`mutation{...D} fragment D on Mutation{${remove}}`), destructive, destructive, destructive],
    ['mutation-alias-disguise', mutation(`mutation{resolveReviewThread:${merge}}`), merging, asked, merging],
    ['mutation-selected-operation', mutation(`query Read{repository(owner:"acme",name:"web"){nameWithOwner}} mutation Write{${resolve('PRRT_a')}}`, '-f', 'operationName=Write'), routine, asked, routine],
    // Outside the reviewed inventory: unscoped review, scoped refusal.
    ['mutation-unlisted', mutation('mutation{addStar(input:{starrableId:"R_example"}){clientMutationId}}'), asked, denied, denied],
    ['mutation-listed-and-unlisted', mutation(`mutation{${resolve('PRRT_a')} addStar(input:{starrableId:"R_example"}){clientMutationId}}`), asked, denied, denied],
    ['mutation-undeclared-input', mutation('mutation{resolveReviewThread(input:{threadId:"PRRT_a",extra:"x"}){thread{id}}}'), asked, denied, denied],
    ['mutation-missing-input', mutation('mutation{resolveReviewThread(input:{clientMutationId:"c"}){thread{id}}}'), asked, denied, denied],
    ['mutation-duplicate-input-key', mutation('mutation{resolveReviewThread(input:{threadId:"PRRT_a",threadId:"PRRT_b"}){thread{id}}}'), asked, denied, denied],
    ['mutation-list-input', mutation('mutation{resolveReviewThread(input:{threadId:["PRRT_a"]}){thread{id}}}'), asked, denied, denied],
    ['mutation-object-variable', mutation('mutation($input:ResolveReviewThreadInput!){resolveReviewThread(input:$input){thread{id}}}', '-f', 'input=PRRT_a'), asked, denied, denied],
    ['mutation-payload-repository', mutation('mutation{resolveReviewThread(input:{threadId:"PRRT_a"}){thread{id pullRequest{repository{nameWithOwner}}}}}'), asked, denied, denied],
    ['mutation-paginate', mutation(`mutation{${resolve('PRRT_a')}}`, '--paginate'), asked, denied, denied],
  ];
  const modes = [['unscoped', undefined, 1], ['scoped', {repository: 'acme/web'}, 2],
    ['scoped-ask', {repository: 'acme/web', repository_writes: 'ask'}, 2],
    ['scoped-profile', {repository: 'acme/web', repository_writes: 'profile'}, 3]];
  // The earlier fixtures' listed mutations now take the routine row.
  const listedBefore = /^(unscoped|scoped)-graphql-(mutation|review-lines-mutation)-(loose|recommended|strict)$/;
  for (const item of cases) {
    const match = listedBefore.exec(item.name);
    if (match) item.expected = (match[1] === 'scoped' ? asked : routine)[match[3]];
  }
  for (const [mode, variables, column] of modes) for (const profile of ['loose', 'recommended', 'strict'])
    for (const input of inputs) cases.push({
      name: `${mode}-${input[0]}-${profile}`, profile, ...(variables ? {variables} : {}),
      argv: input[1], expected: input[1 + column][profile],
    });
  return cases;
}
// Observed 2026-11-14: `gh pr view BRANCH -R OWNER/REPO --json url` needed a
// one-time approval under 0.5.0. 0.7.0 allows read options the grammars do not
// list, keeps --jq/--template on Ask, and checks only the target when scoped.
// Expected rows per [unscoped, scoped].
const read = row('allow', 'allow', 'ask'), allowed = row('allow', 'allow', 'allow');
export const changedIn070 = {
  // Unlisted read options and selectors: Ask became the read row.
  'unscoped-pr-view-url': read, 'unscoped-pr-diff-url': read, 'unscoped-pr-view-fork-head': read,
  'unscoped-pr-view-hash-number': read, 'unscoped-pr-view-two-selectors': read, 'unscoped-pr-view-branch-web': read,
  'unscoped-issue-view-branch': read, 'unscoped-read-unknown-option': read,
  // The target check admits these in scope; the read rule or the merge row decides them.
  'scoped-read-unknown-option': read, 'scoped-merge-branch': merging, 'scoped-merge-future': merging,
  'scoped-pr-view-branch-web': read, 'scoped-pr-view-hash-number': read, 'scoped-pr-view-two-selectors': read,
  'scoped-issue-view-branch': read,
  // A REST read's --jq over the response reads no environment.
  'scoped-rest-jq': allowed,
};
export function githubCases070() {
  const cases = nextGithubCases();
  for (const item of cases) {
    const changed = changedIn070[item.name.replace(/-(loose|recommended|strict)$/, '')];
    if (changed) item.expected = changed[item.profile];
  }
  const inputs = [
    ['observed-pr-view-branch-url', ['gh', 'pr', 'view', 'Fix-Login-Redirect', '-R', 'acme/web', '--json', 'url'], allowed, allowed],
    ['pr-view-web', ['gh', 'pr', 'view', '12', '--web', '-R', 'acme/web'], read, read],
    ['pr-checks-watch', ['gh', 'pr', 'checks', '12', '--watch', '-R', 'acme/web'], read, read],
    // A skipped option's value is checked like any other token.
    ['pr-diff-color-value', ['gh', 'pr', 'diff', 'fix', '--color', 'never', '-R', 'acme/web'], read, read],
    ['pr-list-draft', ['gh', 'pr', 'list', '--draft', '-R', 'acme/web', '--json', 'number'], read, read],
    ['run-list-commit', ['gh', 'run', 'list', '--commit', 'abc123', '-R', 'acme/web'], read, read],
    ['run-view-web', ['gh', 'run', 'view', '123', '--web', '-R', 'acme/web'], read, read],
    // Output expressions over the response are reads in every spelling.
    ['pr-view-jq', ['gh', 'pr', 'view', '12', '-R', 'acme/web', '--json', 'url', '--jq', '.url'], read, read],
    ['pr-view-jq-equals', ['gh', 'pr', 'view', '12', '-R', 'acme/web', '--json', 'url', '--jq=.url'], read, read],
    ['pr-view-jq-short', ['gh', 'pr', 'view', '12', '-R', 'acme/web', '--json', 'url', '-q', '.url'], read, read],
    ['pr-view-jq-cluster', ['gh', 'pr', 'view', '12', '-R', 'acme/web', '--json', 'url', '-wq.url'], read, read],
    ['pr-view-template', ['gh', 'pr', 'view', '12', '-R', 'acme/web', '--json', 'url', '-t', '{{.url}}'], read, read],
    ['release-list-jq', ['gh', 'release', 'list', '-R', 'acme/web', '--json', 'tagName', '--jq', '.[].tagName'], read, read],
    // Expressions that read the environment ask in every spelling.
    ['pr-view-jq-env', ['gh', 'pr', 'view', '12', '-R', 'acme/web', '--json', 'url', '--jq', 'env'], asked, asked],
    ['pr-view-jq-env-variable', ['gh', 'pr', 'view', '12', '-R', 'acme/web', '--json', 'url', '--jq', '$ENV.GH_TOKEN'], asked, asked],
    ['pr-view-jq-env-equals', ['gh', 'pr', 'view', '12', '-R', 'acme/web', '--json', 'url', '--jq=env.GH_TOKEN'], asked, asked],
    ['pr-view-jq-env-cluster', ['gh', 'pr', 'view', '12', '-R', 'acme/web', '--json', 'url', '-qenv'], asked, asked],
    ['pr-view-jq-env-interpolated', ['gh', 'pr', 'view', '12', '-R', 'acme/web', '--json', 'url', '--jq', '"\\(env.HOME)"'], asked, asked],
    // Observed 2026-11-15: a scoped REST read of a workflow run with --jq.
    ['api-run-jq', ['gh', 'api', 'repos/acme/web/actions/runs/43071998706', '--jq', '.head_sha,.event,.run_attempt'], asked, allowed],
    ['api-run-template', ['gh', 'api', 'repos/acme/web/actions/runs/1', '--template', '{{.head_sha}}'], asked, allowed],
    ['api-run-jq-env', ['gh', 'api', 'repos/acme/web/actions/runs/1', '--jq', '$ENV.GH_TOKEN'], asked, denied],
    ['api-other-repository-jq', ['gh', 'api', 'repos/other/web/actions/runs/1', '--jq', '.head_sha'], asked, denied],
    // A leading -R keeps listed forms only.
    ['leading-repository-unlisted', ['gh', '-R', 'acme/web', 'pr', 'view', '12', '--web'], asked, denied],
    ['leading-repository-jq', ['gh', '-R', 'acme/web', 'pr', 'view', '12', '--json', 'url', '--jq', '.url'], asked, denied],
    // Other targets stay outside the scope whatever the options.
    ['pr-view-url-web', ['gh', 'pr', 'view', 'https://github.com/other/web/pull/1', '--web', '-R', 'acme/web'], read, denied],
    ['pr-view-repository-hash', ['gh', 'pr', 'view', 'other/web#1', '-R', 'acme/web'], read, denied],
    ['pr-view-unlisted-other-repository', ['gh', 'pr', 'view', 'fix', '--web', '-R', 'other/web'], read, denied],
    ['pr-view-unlisted-missing-repository', ['gh', 'pr', 'view', 'fix', '--web'], read, denied],
    ['issue-comment-url', ['gh', 'issue', 'comment', 'https://github.com/other/web/issues/1', '--body', 'Thanks', '-R', 'acme/web'], asked, denied],
    ['pr-list-unlisted-search-or', ['gh', 'pr', 'list', '--draft', '-S', 'login OR signup', '-R', 'acme/web'], read, denied],
    ['pr-list-unlisted-qualifier', ['gh', 'pr', 'list', '--draft', '-S', 'repo:other/web', '-R', 'acme/web'], read, denied],
    // Unlisted list options with ':' values refuse conservatively; listed ones pass.
    ['pr-list-unlisted-label-colon', ['gh', 'pr', 'list', '--draft', '--label', 'type:bug', '-R', 'acme/web'], read, denied],
    ['pr-list-listed-label-colon', ['gh', 'pr', 'list', '--label', 'type:bug', '-R', 'acme/web'], allowed, allowed],
    ['workflow-view', ['gh', 'workflow', 'view', 'ci.yml', '-R', 'acme/web'], read, denied],
    ['repo-view-other', ['gh', 'repo', 'view', 'other/web', '--web'], read, denied],
    // Writes with unlisted options ask instead of refusing in scope.
    ['pr-create-fill', ['gh', 'pr', 'create', '--fill', '-R', 'acme/web'], asked, asked],
    ['pr-edit-unlisted-other-repository', ['gh', 'pr', 'edit', '12', '--add-reviewer', 'octo', '-R', 'other/web'], asked, denied],
    ['pr-comment-listed-body', ['gh', 'pr', 'comment', '12', '--body', 'Fixes: see #3', '-R', 'acme/web'], routine, routine],
    ['pr-merge-branch', ['gh', 'pr', 'merge', 'fix', '--squash', '-R', 'acme/web'], merging, merging],
    ['local-version', ['gh', '--version'], allowed, allowed],
    ['local-help-topic', ['gh', 'help', 'pr'], asked, denied],
  ];
  for (const scoped of [false, true]) for (const profile of ['loose', 'recommended', 'strict'])
    for (const [name, argv, unscoped, inside] of inputs) cases.push({
      name: `${scoped ? 'scoped' : 'unscoped'}-${name}-${profile}`, profile,
      ...(scoped ? {variables: {repository: 'acme/web'}} : {}), argv, expected: (scoped ? inside : unscoped)[profile],
    });
  return cases;
}
export function githubCases071() {
  const cases = githubCases070();
  const reviewable = new Set(['rest-method-post', 'rest-field-post', 'rest-get-with-field', 'rest-method-patch',
    'rest-header', 'rest-input', 'api-run-jq-env']);
  for (const item of cases) {
    const name = item.name.replace(/^scoped-/, '').replace(/-(loose|recommended|strict)$/, '');
    if (item.variables?.repository && reviewable.has(name)) item.expected = 'ask';
  }
  const endpoint = 'repos/acme/web/pulls/12/reviews';
  const inputs = [
    ['review-post-input', [endpoint, '--method', 'POST', '--input', '/tmp/acme-review.json', '--jq', '{url: .html_url, state: .state}'], 'ask'],
    ['review-post-options-first', ['--method=POST', '--input=review.json', '--jq=.html_url', endpoint], 'ask'],
    ['review-post-short-cluster', ['-XPOST', '-fbody=Thanks', endpoint], 'ask'],
    ['review-post-typed-file', [endpoint, '-F', 'body=@review.txt'], 'ask'],
    ['review-post-stdin', [endpoint, '--input', '-'], 'ask'],
    ['review-delete', [endpoint + '/1', '--method', 'DELETE'], 'ask'],
    ['review-output-env', [endpoint, '--jq', 'env'], 'ask'],
    ['review-cache', [endpoint, '--cache', '1h'], 'ask'],
    ['review-preview', [endpoint, '--preview', 'corsair'], 'ask'],
    ['review-explicit-host', [endpoint, '--hostname', 'github.com', '--method', 'POST', '--input', 'review.json'], 'ask'],
    ['review-other-host', [endpoint, '--hostname', 'example.com', '--method', 'POST', '--input', 'review.json'], 'deny'],
    ['review-duplicate-host', [endpoint, '--hostname', 'github.com', '--hostname=example.com', '--input', 'review.json'], 'deny'],
    ['review-other-repository', ['repos/other/web/pulls/12/reviews', '--method', 'POST', '--input', 'review.json'], 'deny'],
    ['review-sibling-repository', ['repos/acme/web-other/pulls/12/reviews', '--input', 'review.json'], 'deny'],
    ['review-dot-escape', ['repos/acme/web/../../other/web/pulls/12/reviews', '--input', 'review.json'], 'deny'],
    ['review-encoded-escape', ['repos/acme/web/%2e%2e/other/pulls/12/reviews', '--input', 'review.json'], 'deny'],
    ['review-placeholder', ['repos/acme/web/pulls/{branch}/reviews', '--input', 'review.json'], 'deny'],
    ['review-full-url', ['https://api.github.com/' + endpoint, '--input', 'review.json'], 'deny'],
    ['review-two-endpoints', [endpoint, 'repos/other/web/pulls/12/reviews', '--input', 'review.json'], 'deny'],
    ['review-missing-input', [endpoint, '--input'], 'deny'],
    ['review-unknown-option', [endpoint, '--future-option', 'repos/other/web/pulls'], 'deny'],
    // Option values cannot stand in for a missing endpoint.
    ['review-endpoint-in-body', ['--raw-field', 'body=' + endpoint], 'deny'],
  ];
  for (const scoped of [false, true]) for (const profile of ['loose', 'recommended', 'strict'])
    for (const [name, args, expected] of inputs) cases.push({
      name: `${scoped ? 'scoped' : 'unscoped'}-${name}-${profile}`, profile,
      ...(scoped ? {variables: {repository: 'acme/web'}} : {}), argv: ['gh', 'api', ...args],
      expected: scoped ? expected : 'ask',
    });
  return cases;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // Default: the current candidate. A version argument reproduces a published release.
  const releases = {'0.4.0': [destination, graphqlGithubCases], '0.5.0': [currentDestination, currentGithubCases], '0.6.0': [nextDestination, nextGithubCases], '0.7.0': [destination070, githubCases070]};
  const [output, build] = releases[process.argv[2]] ?? [destination071, githubCases071];
  // Larger releases continue in cases-2.json, ... at Shield's per-file limit.
  for (const [name, document] of splitCaseFiles({schema_version:1,cases:build()}))
    await writeFile(new URL(name,output),JSON.stringify(document,null,2)+'\n');
}

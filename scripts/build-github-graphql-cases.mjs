import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {usableGithubCases} from './build-github-usable-cases.mjs';
import {destination, currentDestination} from './build-github-graphql-pack.mjs';

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
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // Default: the current candidate. Pass 0.4.0 to reproduce the published release.
  const [output, cases] = process.argv[2] === '0.4.0' ? [destination, graphqlGithubCases()] : [currentDestination, currentGithubCases()];
  await writeFile(new URL('cases.json',output),JSON.stringify({schema_version:1,cases},null,2)+'\n');
}

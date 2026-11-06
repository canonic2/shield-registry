import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {usableGithubCases} from './build-github-usable-cases.mjs';
import {destination} from './build-github-graphql-pack.mjs';

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
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await writeFile(new URL('cases.json',destination),JSON.stringify({schema_version:1,cases:graphqlGithubCases()},null,2)+'\n');

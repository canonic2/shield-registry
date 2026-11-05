// Expected decisions reuse the independent GitHub operation matrix, with one
// repository and no project dimension authorized by the optional binding.
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {githubCases} from './build-github-cases.mjs';
import {destination} from './build-github-configurable-pack.mjs';

export function configurableGithubCases({complete = false} = {}) {
  return [false, true].flatMap(scoped => (complete ? ['hosted', 'local', 'local-read-only'] : ['hosted']).flatMap(integration =>
    githubCases({scope: scoped, integration})
      .filter(row => complete || !(row.name.startsWith('privileged-') || row.name.startsWith('jq-')))
      .map(row => ({...row,
      name: `${scoped ? 'repository-bound' : 'unset'}-${integration}-${row.name}`,
      ...(scoped ? {variables: {repository: 'acme/web'}} : {}),
      expected: scoped && (row.name.startsWith('project-') || row.name.startsWith('mcp-project-')
        || row.name.startsWith('mcp-second-pair-')) ? 'deny' : row.expected,
    }))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await writeFile(new URL('cases.json', destination), JSON.stringify({schema_version: 1, cases: configurableGithubCases()}, null, 2) + '\n');
}

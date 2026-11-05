// Expectations are maintained independently from the policy constructors.
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const profiles = ['loose', 'recommended', 'strict'];
const read = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'deny'];
const privileged = ['ask', 'deny', 'deny'];
const allow = ['allow', 'allow', 'allow'];
const deny = ['deny', 'deny', 'deny'];
export const exampleScope = {repositories: ['acme/web', 'other/api'], projects: [{owner: 'acme', number: 7}, {owner: 'other', number: 9}]};

export function githubCases({scope = false, organizations = false, id = 'canonic/github', integration = 'hosted'} = {}) {
  const restricted = scope || organizations;
  const rows = [
    ['version', ['gh', '--version'], allow],
    ['list', ['gh', 'issue', 'list', '-R', 'acme/web', '--json', 'number,title'], read],
    ['list-leading', ['gh', '-Racme/web', 'pr', 'list', '--limit=5'], read],
    ['view', ['gh', 'pr', 'view', '12', '--repo=acme/web', '--comments'], read],
    ['run-log', ['gh', 'run', 'view', '12', '-R', 'acme/web', '--log'], read],
    ['create', ['gh', 'issue', 'create', '-R', 'acme/web', '--title', 'A bug', '--body', 'Please fix'], review],
    ['body-is-not-option', ['gh', 'issue', 'create', '-R', 'acme/web', '--body', '--repo=outside/repo'], review],
    ['merge', ['gh', 'pr', 'merge', '12', '-R', 'acme/web', '--admin', '--squash'], privileged],
    ['delete', ['gh', 'issue', 'delete', '12', '-R', 'acme/web', '--yes'], privileged],
    ['repo-delete', ['gh', 'repo', 'delete', 'acme/web', '--yes'], restricted ? deny : privileged],
    ['implicit-repo', ['gh', 'issue', 'list'], restricted ? deny : read],
    ['other-repo', ['gh', 'issue', 'list', '-R', 'outside/web'], restricted ? deny : read],
    ['repeated-repo', ['gh', 'issue', 'list', '-R', 'acme/web', '--repo', 'outside/web'], restricted ? deny : read],
    ['leading-other-repo', ['gh', '-Routside/web', 'issue', 'list', '--repo=acme/web'], restricted ? deny : read],
    ['url-target', ['gh', 'issue', 'view', 'https://github.com/outside/web/issues/1', '-R', 'acme/web'], restricted ? deny : review],
    ['search-override', ['gh', 'issue', 'list', '-R', 'acme/web', '--search', 'repo:outside/web'], restricted ? deny : read],
    ['unknown-option', ['gh', 'issue', 'list', '-R', 'acme/web', '--future'], restricted ? deny : review],
    ['hostname', ['gh', 'issue', 'list', '-R', 'enterprise.example.com/acme/web'], restricted ? deny : read],
    ['api-graphql', ['gh', 'api', 'graphql', '-f', 'query={viewer{login}}'], restricted ? deny : review],
    ['extension', ['gh', 'extension', 'exec', 'custom'], restricted ? deny : privileged],
    ['token', ['gh', 'auth', 'token'], restricted ? deny : privileged],
    ['repo-positional', ['gh', 'repo', 'view', 'outside/web', '-R', 'acme/web'], restricted ? deny : review],
    ['project-view', ['gh', 'project', 'view', '7', '--owner', 'acme', '--format', 'json'], read],
    ['project-other', ['gh', 'project', 'view', '9', '--owner', 'acme'], scope ? deny : read],
    ['project-owner-other', ['gh', 'project', 'view', '7', '--owner', 'outside'], restricted ? deny : read],
    ['project-owner-missing', ['gh', 'project', 'view', '7'], restricted ? deny : read],
    ['project-owner-repeated', ['gh', 'project', 'view', '7', '--owner', 'acme', '--owner', 'outside'], restricted ? deny : read],
    ['project-list', ['gh', 'project', 'list', '--owner', 'acme'], scope ? deny : read],
    ['project-mutate-id', ['gh', 'project', 'item-edit', '--id', 'PVTI_other', '--project-id', 'PVT_other'], restricted ? deny : review],
    ['pr-view-current', ['gh', 'pr', 'view', '--json', 'number'], restricted ? deny : read],
    ['pr-checks-current', ['gh', 'pr', 'checks'], restricted ? deny : read],
    ['auth-status', ['gh', 'auth', 'status', '--active'], read],
    ['auth-status-token', ['gh', 'auth', 'status', '--show-token'], restricted ? deny : privileged],
    ['pr-close', ['gh', 'pr', 'close', '12', '-R', 'acme/web', '--comment', 'Done'], review],
    ['dot-repo', ['gh', 'issue', 'list', '-R', 'acme/..'], restricted ? deny : read],
    ['dot-prefixed-repo', ['gh', 'issue', 'list', '-R', 'acme/.github'], scope ? deny : read],
    ['linuxbrew-other-repo', ['/home/linuxbrew/.linuxbrew/bin/gh', 'issue', 'list', '-R', 'outside/web'], restricted ? deny : read],
    ['snap-other-repo', ['/snap/bin/gh', 'issue', 'list', '-R', 'outside/web'], restricted ? deny : read],
  ];
  // Deletion, credentials and administration are privileged even without a closed grammar.
  for (const [name, argv] of [
    ['deploy-key-add', ['gh', 'repo', 'deploy-key', 'add', 'key.pub', '-R', 'acme/web', '--allow-write']],
    ['deploy-key-delete', ['gh', 'repo', '-Racme/web', 'deploy-key', 'delete', '42']],
    ['repo-rename', ['gh', 'repo', 'rename', 'new', '-R', 'acme/web', '--yes']],
    ['repo-unarchive', ['gh', 'repo', 'unarchive', 'acme/web', '--yes']],
    ['autolink-delete', ['gh', 'repo', 'autolink', 'delete', '1', '-R', 'acme/web', '--yes']],
    ['variable-set', ['gh', 'variable', 'set', 'EXAMPLE', '--body', 'example', '-R', 'acme/web']],
    ['variable-delete', ['gh', 'variable', 'delete', 'EXAMPLE', '--repo=acme/web']],
    ['label-delete', ['gh', 'label', 'delete', 'bug', '-R', 'acme/web', '--yes']],
    ['cache-delete', ['gh', 'cache', 'delete', '--all', '-R', 'acme/web']],
    ['project-delete', ['gh', 'project', 'delete', '7', '--owner', 'acme']],
    ['gist-delete', ['gh', 'gist', 'delete', 'abc123', '--yes']],
    ['codespace-delete', ['gh', 'codespace', 'delete', '--all']],
    ['config-set-editor', ['gh', 'config', 'set', 'editor', 'vim']],
  ]) rows.push([`privileged-admin-${name}`, argv, restricted ? deny : privileged]);
  // Closing with branch deletion is privileged in every form; scopes admit only the listed options.
  for (const [name, argv, admitted] of [
    ['long', ['gh', 'pr', 'close', '12', '-R', 'acme/web', '--delete-branch'], true],
    ['short', ['gh', 'pr', 'close', '12', '-d', '--repo=acme/web'], true],
    ['cluster', ['gh', 'pr', 'close', '12', '-dc', 'Done', '-R', 'acme/web'], true],
    ['interleaved', ['gh', 'pr', '-Racme/web', 'close', '12', '-d'], true],
    ['branch-selector', ['gh', 'pr', 'close', 'fix', '-d', '-R', 'acme/web'], false],
    ['unknown-option', ['gh', 'pr', 'close', '12', '--future', 'x', '-d', '-R', 'acme/web'], false],
  ]) rows.push([`pr-close-delete-branch-${name}`, argv, restricted && !admitted ? deny : privileged]);
  if (scope) rows.push(['pair-crossed', ['gh', 'issue', 'list', '-R', 'acme/api'], deny],
    ['project-second', ['gh', 'project', 'view', '9', '--owner', 'other'], read]);
  // gh's embedded jq exposes env/$ENV. Every expression, including otherwise
  // harmless filters, stays outside the read allowance until explicitly reviewed.
  const jqCommands = [
    ['repo', 'view'], ['issue', 'list'], ['pr', 'list'], ['pr', 'view', '12'], ['pr', 'checks', '12'],
    ['run', 'list'], ['run', 'view', '12'], ['workflow', 'list'], ['release', 'list'],
    ['project', 'view', '7'], ['project', 'list'], ['project', 'item-list', '7'], ['project', 'field-list', '7'],
  ];
  for (const command of jqCommands) {
    const field = {repo: 'name', issue: 'number', pr: command[1] === 'checks' ? 'name' : 'number', run: 'databaseId', workflow: 'id', release: 'tagName'}[command[0]];
    const target = command[0] === 'project' ? ['--owner', 'acme', '--format', 'json'] : ['-R', 'acme/web', '--json', field];
    for (const [name, filter] of [['env', ['--jq', 'env']], ['env-equals', ['--jq=$ENV']], ['env-short', ['-qenv']], ['nested-env', ['--jq', 'env | .GH_TOKEN']], ['filter', ['--jq', '.[]']]])
      rows.push([`jq-${command.join('-')}-${name}`, ['gh', ...command, ...target, ...filter], restricted ? deny : review]);
  }
  // Privileged classifications must not depend on where a repo option appears.
  for (const [family, command, suffix] of [
    ['release', 'delete', ['v1', '--yes']], ['release', 'delete-asset', ['v1', 'asset.zip', '--yes']],
    ['run', 'delete', ['12']], ['secret', 'set', ['EXAMPLE', '--body', 'example']],
    ['pr', 'merge', ['12', '--squash']], ['issue', 'delete', ['12', '--yes']],
  ]) {
    for (const [form, option] of [['separate', ['--repo', 'acme/web']], ['short', ['-R', 'acme/web']], ['equals', ['--repo=acme/web']], ['attached', ['-Racme/web']]])
      for (const [position, argv] of [
        ['leading', ['gh', ...option, family, command, ...suffix]],
        ['interleaved', ['gh', family, ...option, command, ...suffix]],
        ['trailing', ['gh', family, command, ...suffix, ...option]],
      ]) rows.push([`privileged-${family}-${command}-${form}-${position}`, argv,
        restricted && !['pr', 'issue'].includes(family) ? deny : privileged]);
  }
  // Alternate selectors and options cannot soften a known privileged command.
  // Scope gates still admit only the reviewed numeric, closed-grammar forms.
  for (const [name, family, command, suffix] of [
    ['merge-short', 'pr', 'merge', ['12', '-s']],
    ['merge-branch', 'pr', 'merge', ['fix', '--squash']],
    ['merge-url', 'pr', 'merge', ['https://github.com/acme/web/pull/12', '--squash']],
    ['merge-current', 'pr', 'merge', ['--squash']],
    ['merge-author-email', 'pr', 'merge', ['12', '--squash', '--author-email', 'dev@example.com']],
    ['merge-unknown-option', 'pr', 'merge', ['12', '--squash', '--future']],
    ['delete-url', 'issue', 'delete', ['https://github.com/acme/web/issues/12', '--yes']],
    ['delete-unknown-option', 'issue', 'delete', ['12', '--yes', '--future']],
  ]) {
    for (const [position, argv] of [
      ['leading', ['gh', '-Racme/web', family, command, ...suffix]],
      ['interleaved', ['gh', family, '--repo=acme/web', command, ...suffix]],
      ['trailing', ['gh', family, command, ...suffix, '--repo', 'acme/web']],
    ]) rows.push([`privileged-variant-${name}-${position}`, argv, restricted ? deny : privileged]);
  }
  rows.push(['interleaved-other-repo', ['gh', 'issue', '-Routside/web', 'list', '--repo', 'acme/web'], restricted ? deny : read],
    ['interleaved-matching-repo', ['gh', 'issue', '-Racme/web', 'list', '--repo', 'acme/web'], read]);
  const connection = {github: {transport: {type: 'defaults', pack: id, integration}, agents: {codex: 'github'}, packs: {[id]: integration}}};
  const mcpRows = [
    ['files', 'get_file_contents', {owner: 'acme', repo: 'web', path: 'README.md'}, read],
    ['files-other', 'get_file_contents', {owner: 'outside', repo: 'web'}, restricted ? deny : read],
    ['files-missing', 'get_file_contents', {repo: 'web'}, restricted ? deny : read],
    ['files-array', 'get_file_contents', {owner: ['acme'], repo: 'web'}, restricted ? deny : read],
    ['files-dot-repo', 'get_file_contents', {owner: 'acme', repo: '..'}, restricted ? deny : read],
    ['pr-read', 'pull_request_read', {owner: 'acme', repo: 'web', method: 'get_diff', pullNumber: 12}, read],
    ['pr-unknown-method', 'pull_request_read', {owner: 'acme', repo: 'web', method: 'future'}, restricted ? deny : review],
    ['pr-create', 'create_pull_request', {owner: 'acme', repo: 'web', title: 'Fix', head: 'fix', base: 'main'}, review],
    ['pr-merge', 'merge_pull_request', {owner: 'acme', repo: 'web', pullNumber: 12}, privileged],
    ['search', 'search_code', {query: 'repo:acme/web OR repo:outside/api'}, restricted ? deny : review],
    ['unknown', 'future_tool', {owner: 'acme', repo: 'web'}, restricted ? deny : review],
    ['project', 'projects_get', {owner: 'acme', project_number: 7, method: 'get_project'}, read],
    ['project-other', 'projects_get', {owner: 'acme', project_number: 9, method: 'get_project'}, scope ? deny : read],
    ['project-wrong-type', 'projects_get', {owner: 'acme', project_number: '7', method: 'get_project'}, scope ? deny : read],
    ['project-opaque', 'projects_get', {owner: 'acme', project_number: 7, item_id: 99, method: 'get_project_item'}, restricted ? deny : review],
    ['project-global-field', 'projects_get', {owner: 'acme', project_number: 7, field_id: 99, method: 'get_project_field'}, restricted ? deny : read],
    ['project-list', 'projects_list', {owner: 'acme', method: 'list_projects'}, scope ? deny : read],
    ['project-write', 'projects_write', {owner: 'acme', project_number: 7, method: 'delete_project'}, restricted ? deny : privileged],
  ];
  if (scope) mcpRows.push(['pair-crossed', 'list_issues', {owner: 'acme', repo: 'api'}, deny],
    ['second-pair', 'list_issues', {owner: 'other', repo: 'api'}, read],
    ['project-crossed', 'projects_get', {owner: 'other', project_number: 7, method: 'get_project'}, deny]);
  return [
    ...rows.flatMap(([name, argv, expected]) => profiles.map((profile, i) => ({name: `${name}-${profile}`, profile, argv, expected: expected[i]}))),
    ...mcpRows.flatMap(([name, tool, arguments_, expected]) => profiles.map((profile, i) => ({name: `mcp-${name}-${profile}`, profile, expected: expected[i],
      mcp: connection, input: {kind: 'mcp', server: 'github', tool, arguments: arguments_, original_input: {}}}))),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await writeFile(new URL('../packs/canonic/github/0.1.0/cases.json', import.meta.url), JSON.stringify({schema_version: 1, cases: githubCases()}, null, 2) + '\n');

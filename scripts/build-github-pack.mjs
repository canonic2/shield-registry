// Reviewed against https://cli.github.com/manual/gh_help_reference and
// https://github.com/github/github-mcp-server (2026-11-04).
import {mkdir, writeFile, readFile, copyFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

export const destination = new URL('../packs/canonic/github/0.1.0/', import.meta.url);
const profiles = (loose, recommended = loose, strict = recommended) => ({loose, recommended, strict});
const decisions = {local: profiles('allow'), read: profiles('allow', 'allow', 'ask'),
  change: profiles('ask', 'ask', 'deny'), privileged: profiles('ask', 'deny', 'deny'), unknown: profiles('ask', 'ask', 'deny')};
const executable = {one_of: ['gh', '/usr/bin/gh', '/usr/local/bin/gh', '/opt/homebrew/bin/gh', '/opt/local/bin/gh',
  '/home/linuxbrew/.linuxbrew/bin/gh', '/snap/bin/gh']};
const server = {one_of: ['hosted', 'local', 'local-read-only']};
const choice = values => values.length === 1 ? values[0] : {one_of: values};
const number = {regex: '[1-9][0-9]*'};
const ownerPattern = '[A-Za-z0-9][A-Za-z0-9-]{0,38}';
// At least one non-dot character: GitHub has no repository named '.' or '..'.
const repoPattern = '\\.*[A-Za-z0-9_-][A-Za-z0-9_.-]*';
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const local = [['--version'], ['--help'], ['help']];
const repoLeading = {flags: [], values: ['-R', '--repo'], interleaved: true};

// Closed grammars: omitted options and URL operands never inherit read access.
// Each group also supplies the complete set of forms admitted by a scope gate.
const groups = [
  {id: 'repo-view', prefix: ['repo', 'view'], category: 'read', flags: [], values: ['--json']},
  {id: 'issue-pr-list', prefix: [choice(['issue', 'pr']), 'list'], category: 'read', flags: [], values: ['--json', '--limit', '-L', '--state', '--author', '--assignee', '--label', '--search', '--base', '--head']},
  // Without a number, these read the current branch's pull request. Scopes still
  // require -R, and gh refuses a missing number together with -R.
  {id: 'issue-pr-view', prefix: [choice(['issue', 'pr']), 'view'], category: 'read', operand: number, optionalOperand: true, flags: ['--comments'], values: ['--json']},
  {id: 'pr-diff-checks', prefix: ['pr', choice(['diff', 'checks'])], category: 'read', operand: number, optionalOperand: true, flags: ['--name-only', '--patch', '--required'], values: ['--json']},
  {id: 'run-workflow-list', prefix: [choice(['run', 'workflow']), 'list'], category: 'read', flags: ['--all'], values: ['--json', '--limit', '-L', '--workflow', '--branch', '--status', '--event', '--user']},
  {id: 'run-view', prefix: ['run', 'view'], category: 'read', operand: number, flags: ['--log', '--log-failed', '--exit-status', '--verbose'], values: ['--json', '--job', '--attempt']},
  {id: 'release-list', prefix: ['release', 'list'], category: 'read', flags: ['--exclude-drafts', '--exclude-pre-releases'], values: ['--json', '--limit', '-L', '--order']},
  {id: 'issue-pr-create', prefix: [choice(['issue', 'pr']), 'create'], category: 'change', flags: ['--draft'], values: ['--title', '--body', '--body-file', '--base', '--head', '--label', '--assignee', '--reviewer']},
  {id: 'issue-pr-change', prefix: [choice(['issue', 'pr']), choice(['comment', 'edit', 'close', 'reopen'])], category: 'change', operand: number,
    flags: ['--edit-last', '--delete-branch', '-d'], values: ['--body', '--body-file', '--title', '--reason', '--comment', '-c', '--add-label', '--remove-label', '--add-assignee', '--remove-assignee', '--base']},
  {id: 'pr-merge', prefix: ['pr', 'merge'], category: 'privileged', operand: number,
    flags: ['--merge', '--squash', '--rebase', '--auto', '--disable-auto', '--delete-branch', '--admin'], values: ['--subject', '--body', '--body-file', '--match-head-commit']},
  {id: 'issue-delete', prefix: ['issue', 'delete'], category: 'privileged', operand: number, flags: ['--yes'], values: []},
];
// Local account status without --show-token, which would print the token.
const authStatus = {id: 'auth-status', category: 'read', conditions: {kind: 'options', prefix: ['auth', 'status'],
  flags: ['--active', '-a'], values: ['--hostname', '-h'], operands: false}};
// Deletion, credential and administration commands outside the closed grammars.
const privilegedPrefixes = [['repo', 'delete'], ['repo', 'edit'], ['repo', 'archive'], ['repo', 'unarchive'], ['repo', 'rename'],
  ['repo', 'deploy-key', 'add'], ['repo', 'deploy-key', 'delete'], ['repo', 'autolink', 'create'], ['repo', 'autolink', 'delete'],
  ['release', 'delete'], ['release', 'delete-asset'], ['run', 'delete'], ['pr', 'merge'], ['issue', 'delete'],
  ['variable', 'set'], ['variable', 'delete'], ['label', 'delete'], ['cache', 'delete'], ['project', 'delete'],
  ['gist', 'delete'], ['codespace', 'delete'], ['config', 'set']];
// Closing a PR with -d/--delete-branch deletes its branch, whatever else the
// request contains. Undeclared options are skipped so they cannot hide the flag.
const prCloseDeleteBranch = {kind: 'options', prefix: ['pr', 'close'], leading: repoLeading,
  flags: ['--delete-branch', '-d'], values: ['-R', '--repo', '--comment', '-c'],
  operands: true, unknown_options: 'skip', require_any: ['--delete-branch', '-d']};
const projectGroups = [
  {id: 'project-view', prefix: ['project', 'view'], operand: number, category: 'read', flags: [], values: ['--format']},
  {id: 'project-list', prefix: ['project', 'list'], category: 'read', flags: ['--closed'], values: ['--format', '--limit']},
  {id: 'project-items-fields', prefix: ['project', choice(['item-list', 'field-list'])], operand: number, category: 'read', flags: [], values: ['--format', '--limit']},
];
const repoTools = {
  get_file_contents: 'read', list_branches: 'read', list_commits: 'read', get_commit: 'read',
  list_tags: 'read', get_tag: 'read', list_releases: 'read', get_release_by_tag: 'read', get_latest_release: 'read',
  list_issues: 'read', list_pull_requests: 'read', issue_read: 'read', pull_request_read: 'read',
  add_issue_comment: 'change', create_pull_request: 'change', create_branch: 'change',
  create_or_update_file: 'change', push_files: 'change', merge_pull_request: 'privileged', delete_file: 'privileged',
};
const methods = {
  issue_read: ['get', 'get_comments', 'get_labels', 'get_sub_issues'],
  pull_request_read: ['get', 'get_diff', 'get_status', 'get_files', 'get_commits', 'get_comments', 'get_review_comments', 'get_reviews'],
  projects_get: ['get_project', 'get_project_field'],
  projects_list: ['list_projects', 'list_project_fields', 'list_project_items', 'list_project_views', 'list_project_status_updates'],
};

const localServer = args => ({transport: 'stdio', fields: {'/command': {text: {one_of: ['github-mcp-server', '/usr/bin/github-mcp-server',
  '/usr/local/bin/github-mcp-server', '/opt/homebrew/bin/github-mcp-server']}}, '/args': {exact: args}},
  defaults: {type: 'stdio', command: 'github-mcp-server', args, env: {}}});

export function validateScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw Error('Scope must be an object.');
  for (const key of Object.keys(scope)) if (!['repositories', 'organizations', 'projects'].includes(key)) throw Error(`Unknown scope key: ${key}`);
  for (const [key, pattern] of [['repositories', new RegExp(`^${ownerPattern}/${repoPattern}$`)], ['organizations', new RegExp(`^${ownerPattern}$`)]]) {
    if (scope[key] !== undefined && (!Array.isArray(scope[key]) || !scope[key].length || scope[key].length > 16
      || new Set(scope[key]).size !== scope[key].length || !scope[key].every(value => typeof value === 'string' && pattern.test(value) && value.length <= 140)))
      throw Error(`${key} must contain 1–16 unique explicit names.`);
  }
  if (scope.projects !== undefined && (!Array.isArray(scope.projects) || !scope.projects.length || scope.projects.length > 16
    || !scope.projects.every(project => project && typeof project === 'object' && Object.keys(project).sort().join(',') === 'number,owner'
      && typeof project.owner === 'string' && new RegExp(`^${ownerPattern}$`).test(project.owner)
      && Number.isSafeInteger(project.number) && project.number > 0)
    || new Set(scope.projects.map(project => `${project.owner}/${project.number}`)).size !== scope.projects.length))
    throw Error('projects must contain 1–16 unique {owner, number} objects with positive safe integer numbers.');
  // Reject contradictory input rather than quietly generating an unusable scope.
  if (scope.organizations) for (const owner of [...(scope.repositories ?? []).map(repo => repo.split('/')[0]), ...(scope.projects ?? []).map(project => project.owner)])
    if (!scope.organizations.includes(owner)) throw Error(`Owner ${owner} is outside organizations.`);
  return scope;
}

function grammar(group, repository, owners, projects) {
  const project = group.prefix[0] === 'project';
  const repoOptions = ['-R', '--repo'].map(name => repository ? {name, match: repository} : name);
  return {kind: 'options', prefix: group.prefix,
    leading: project ? {flags: [], values: []} : {...repoLeading, values: repoOptions},
    flags: group.flags,
    values: [...group.values.filter(name => !repository || name !== '--search'), ...(project ? [owners ? {name: '--owner', match: owners} : '--owner'] : repoOptions)],
    operands: group.operand ? {match: projects ?? group.operand, min: group.optionalOperand ? 0 : 1, max: 1} : false,
    ...(project && owners ? {require_all: ['--owner']} : {}),
    ...(!project && repository ? {require_any: ['-R', '--repo']} : {}),
  };
}

export function githubPack(scope = {}, id = 'canonic/github', version = '0.1.0') {
  validateScope(scope);
  if (!/^[a-z0-9-]{1,64}\/[a-z0-9-]{1,64}$/.test(id)) throw Error('Invalid pack id.');
  if (!/^0\.[0-9]+\.[0-9]+$/.test(version)) throw Error('Pack version must be a stable 0.x.y version.');
  const scoped = Object.keys(scope).length > 0;
  if (scoped && id === 'canonic/github') throw Error('Scoped variants need their own publisher/name identity.');
  const argv = arguments_ => ({domain: 'argv', executable, arguments: arguments_});
  const mcp = (tool, fields) => ({domain: 'mcp', server, tool, ...(fields ? {fields} : {})});
  const rules = local.map((values, i) => ({id: `local-${i}`, conditions: argv({kind: 'exact', values}), decision: decisions.local, reason: 'Print local help or version.'}));
  for (const group of [...groups, ...projectGroups]) rules.push({id: group.id, conditions: argv(grammar(group)), decision: decisions[group.category],
    reason: group.category === 'read' ? 'Read GitHub metadata or content using listed options.' : 'Change remote GitHub state; review the operation and any local input files.'});
  rules.push({id: authStatus.id, conditions: argv(authStatus.conditions), decision: decisions.read, reason: 'Show local GitHub CLI sign-in status without the token.'});
  rules.push({id: 'pr-close-delete-branch', conditions: argv(prCloseDeleteBranch), decision: decisions.privileged, reason: 'Close a pull request and delete its branch.'});
  // Unclassified transports, API bodies, extensions, credential and administration commands.
  for (const [name, category] of [['api', 'unknown'], ['auth', 'privileged'], ['extension', 'privileged'], ['alias', 'privileged'], ['secret', 'privileged'], ['ssh-key', 'privileged'], ['gpg-key', 'privileged']])
    rules.push({id: `review-${name}`, conditions: argv({kind: 'prefix', leading: repoLeading, values: [name]}), decision: decisions[category], reason: 'Review API access, credentials, extensions or configuration explicitly.'});
  // Known privileged operations retain their decision even when selectors or
  // options miss a closed grammar. Scope preconditions still check that grammar.
  for (const words of privilegedPrefixes)
    rules.push({id: `review-${words.join('-')}`, conditions: argv({kind: 'prefix', leading: repoLeading, values: words}), decision: decisions.privileged, reason: 'Delete remote resources, merge pull requests, add credentials or change repository or CLI administration.'});
  rules.push({id: 'cli-unlisted', conditions: argv({kind: 'any'}), decision: decisions.unknown, reason: 'Unlisted GitHub CLI commands and options require review.'});
  const allTools = {...repoTools, projects_get: 'read', projects_list: 'read', projects_write: 'privileged'};
  for (const [tool, category] of Object.entries(allTools)) {
    rules.push({id: `mcp-${tool}`, conditions: mcp(tool, methods[tool] ? {'/method': {text: choice(methods[tool])}} : undefined), decision: decisions[category], reason: 'Classify this documented GitHub MCP operation by its remote effects.'});
    if (methods[tool]) rules.push({id: `mcp-${tool}-unlisted-method`, conditions: mcp(tool), decision: decisions.unknown, reason: 'Unlisted GitHub MCP methods require review.'});
  }
  rules.push({id: 'mcp-unlisted', fallback: true, conditions: mcp({not: {one_of: Object.keys(allTools)}}), decision: decisions.unknown, reason: 'Unlisted GitHub MCP tools require review.'});
  const preconditions = [];
  const gate = (name, conditions, requires_any) => preconditions.push({id: name, conditions, requires_any,
    on_unmet: {decision: 'deny', message: 'The GitHub target is outside the configured scope or cannot be established from this request.'}});
  if (scoped) {
    const repository = scope.repositories ? choice(scope.repositories) : scope.organizations
      ? {regex: `(?:${scope.organizations.map(escape).join('|')})/${repoPattern}`} : undefined;
    const cliBranches = [...local.map(values => ({arguments: {kind: 'exact', values}})), {arguments: authStatus.conditions}];
    if (repository) for (const group of groups) cliBranches.push({arguments: grammar(group, repository)});
    // Keep each precondition within Shield's 16 alternative limit. Project forms
    // get a separate gate; the general gate recognizes only their command prefix.
    const projectOwners = scope.projects ? [...new Set(scope.projects.map(project => project.owner))] : scope.organizations;
    if (projectOwners) cliBranches.push({arguments: {kind: 'prefix', values: ['project']}});
    gate('cli-scope', argv({kind: 'any'}), cliBranches);
    if (projectOwners) {
      // Each project is checked in a single branch using a shared command selector.
      const alternatives = scope.projects ? scope.projects.map(project => ({arguments: grammar({
        ...projectGroups[0], prefix: ['project', choice(['view', 'item-list', 'field-list'])], values: ['--format', '--limit'],
      }, undefined, project.owner, String(project.number))}))
        : projectGroups.map(group => ({arguments: grammar(group, undefined, choice(projectOwners))}));
      gate('cli-project-scope', argv({kind: 'prefix', values: ['project']}), alternatives);
    }
    const repoNames = Object.keys(repoTools);
    const projectNames = ['projects_get', 'projects_list'];
    const admitted = [...(repository ? repoNames : []), ...(projectOwners ? projectNames : [])];
    gate('mcp-known-scope', mcp({glob: '*'}), [{tool: choice(admitted)}]);
    if (repository) {
      const pairs = scope.repositories?.map(repo => repo.split('/'));
      const alternatives = pairs ? pairs.map(([owner, repo]) => ({fields: {'/owner': {exact: owner}, '/repo': {exact: repo}}}))
        : [{fields: {'/owner': {text: choice(scope.organizations)}, '/repo': {text: {regex: repoPattern}}}}];
      gate('mcp-repository-scope', mcp(choice(repoNames)), alternatives);
      for (const name of ['issue_read', 'pull_request_read']) gate(`mcp-${name}-method`, mcp(name), [{fields: {'/method': {text: choice(methods[name])}}}]);
    }
    if (projectOwners) {
      const alternatives = scope.projects ? scope.projects.map(project => ({fields: {'/owner': {exact: project.owner}, '/project_number': {exact: project.number}}}))
        : [{fields: {'/owner': {text: choice(projectOwners)}}}];
      gate('mcp-project-scope', mcp(choice(projectNames)), alternatives);
      for (const name of projectNames) {
        const allowed = methods[name].filter(method => method !== 'get_project_field' && (!scope.projects || method !== 'list_projects'));
        gate(`mcp-${name}-method`, mcp(name), [{fields: {'/method': {text: choice(allowed)}}}]);
      }
    }
  }
  return {schema_version: 1, kind: 'pack', id, version, description: 'GitHub CLI and official MCP permissions, with optional explicit target scopes.',
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: '>=0.18.0, <1.0.0'},
    capabilities: ['structured-rules-v1', 'argument-rules-v1', 'prefix-leading-v1', 'interleaved-leading-v1', 'regex-v1', 'negated-selectors-v1', 'unknown-options-v1', ...(scoped ? ['preconditions-v1', 'glob-v1'] : []), 'fallback-rules-v1', 'mcp-integrations-v1'],
    mcp_integrations: {
      hosted: {transport: 'http', fields: {'/url': {exact: 'https://api.githubcopilot.com/mcp/'}}, defaults: {type: 'http', url: 'https://api.githubcopilot.com/mcp/'}},
      local: localServer(['stdio']),
      'local-read-only': localServer(['stdio', '--read-only']),
    }, preconditions, rules};
}

export async function buildGithubPack(scope = {}, id, output = destination, version) {
  const pack = githubPack(scope, id, version);
  const bytes = JSON.stringify(pack, null, 2) + '\n';
  await mkdir(output, {recursive: true});
  await writeFile(new URL('pack.yml', output), bytes);
  await writeFile(new URL('commands.json', output), JSON.stringify({schema_version: 1, commands: [{name: 'gh', rule_ids: pack.rules.filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]}, null, 2) + '\n');
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', output));
  if (pack.id !== 'canonic/github') await writeFile(new URL('catalog.json', output), JSON.stringify({schema_version: 1,
    packs: [{id: pack.id, version: pack.version, path: 'pack.yml', sha256: createHash('sha256').update(bytes).digest('hex')}]}, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {values} = parseArgs({options: {scope: {type: 'string'}, id: {type: 'string'}, output: {type: 'string'}, 'pack-version': {type: 'string'}}});
  if (values.scope && (!values.id || !values.output)) throw Error('--scope requires --id and --output for a separate local pack.');
  if (!values.scope && (values.id || values.output || values['pack-version'])) throw Error('--id, --output and --pack-version require --scope.');
  await buildGithubPack(values.scope ? JSON.parse(await readFile(values.scope, 'utf8')) : {}, values.id,
    values.output ? pathToFileURL(resolve(values.output) + '/') : destination, values['pack-version']);
}

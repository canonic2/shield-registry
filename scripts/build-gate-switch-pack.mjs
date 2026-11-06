// Published 0.2.0 stays immutable; routine engineering and short docs names
// get a new revision. Gate's concrete confirmations remain authoritative.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const gateSwitchDirectory = new URL('../packs/canonic/gate/0.2.1/', import.meta.url);
const previous = new URL('../packs/canonic/gate/0.2.0/', import.meta.url);

export async function gateSwitchPack() {
  const pack = JSON.parse(await readFile(new URL('pack.yml', previous)));
  pack.version = '0.2.1';
  // Shield's verified launcher runs this ordinary command in the enrolled
  // project root. Server-side --project arguments would change that base.
  pack.mcp_integrations.gate.fields['/args'] = {exact:['mcp','serve']};
  const allow = {loose: 'allow', recommended: 'allow', strict: 'allow'};
  const routine = new Set(['add', 'apply', 'commit', 'switch', 'switch-force-create', 'attach',
    'branch-remove', 'session-start', 'session-stop', 'session-resume', 'session-promote', 'recover', 'init', 'worktree-add-folder']);
  const confirmed = new Set(['push', 'sync', 'migrate', 'branch_remove', 'worktree_remove', 'worktree_repair', 'session_remove']);
  const readTools = new Set(['status', 'diff', 'explain', 'check', 'doctor', 'branch_list', 'remote_show',
    'session_status', 'worktree_list', 'worktree_status']);
  const protectedPaths = ['.git', '.shield', '.aws', '.ssh', '.codex', '.claude'];
  const projectPath = root => ({within:{root}, exclude:protectedPaths.map(path => ({root:'project', path}))});
  for (const rule of pack.rules) {
    const command = rule.id.replace(/^mcp-/, '').replaceAll('_', '-');
    if (routine.has(command) || rule.id === 'mcp-switch-force-create' || rule.id === 'worktree-add') {
      rule.decision = {...allow};
      rule.reason = 'Routine local engineering with Gate file, ref and transaction safeguards.';
    }
    if (rule.conditions.domain === 'mcp' && confirmed.has(rule.conditions.tool) && !rule.id.endsWith('-project')) {
      rule.decision = {...allow, strict: rule.decision.strict === 'deny' ? 'deny' : 'allow'};
      rule.reason = 'Gate asks for the concrete change before applying it; avoid a duplicate generic approval.';
    }
    if (rule.conditions.domain === 'mcp' && rule.id.endsWith('-project')) {
      const base = pack.rules.find(row => row.id === `mcp-${rule.conditions.tool}`);
      rule.decision = {...base.decision};
      rule.requirements = {field_paths: {'/project': {absolute: true,
        path: projectPath(readTools.has(rule.conditions.tool) ? 'read' : 'write')}}};
      rule.on_unmet = {decision: 'ask', message: 'Use an absolute project path inside the approved roots.'};
      rule.reason = 'Explicit approved project paths retain the operation decision; outside or ambiguous paths need review.';
    }
    if (rule.conditions.domain === 'mcp' && ['worktree_add', 'worktree_remove', 'worktree_repair'].includes(rule.conditions.tool)) {
      if (rule.conditions.tool === 'worktree_add') rule.decision = {...allow};
      rule.requirements ??= {};
      rule.requirements.field_paths ??= {};
      rule.requirements.field_paths['/path'] = {relative_to:'project', path: {within: {root: 'write'},
        exclude: ['.git', '.shield', '.aws', '.ssh', '.codex', '.claude'].map(path => ({root: 'project', path}))}};
      if (rule.id.endsWith('-project')) rule.requirements.field_paths['/path'].absolute = true;
      rule.on_unmet = {decision: 'ask', message: 'Choose an approved worktree destination; with project, use an absolute destination.'};
    }
  }
  // Attach path requirements to each operation so a generic selector can
  // never outrank an amendment, force-push or deletion decision.
  const project = pack.rules.find(rule => rule.id === 'project-option');
  const projectGrammar = structuredClone(project.conditions.arguments);
  delete projectGrammar.require_any;
  projectGrammar.values.push('--repo', '--message', '--create', '--force-create', '--branch', '--name',
    '--repo-from', '--confirm', '--force-with-lease', '--remote', '--session', '--history', '--patch');
  pack.rules = pack.rules.filter(rule => rule !== project);
  const readCommands = new Set([...readTools].map(name => name.replaceAll('_', '-')));
  for (const rule of pack.rules.filter(rule => rule.conditions.domain === 'argv' && rule.conditions.cwd)) {
    const root = readCommands.has(rule.id) ? 'read' : 'write';
    if (root === 'read') rule.conditions.cwd = {within:{root}};
    rule.requirements ??= {};
    // Existing worktree checks also inspect operands and must keep doing so.
    if (rule.requirements.argument_paths) {
      rule.requirements.argument_paths.options ??= {};
      rule.requirements.argument_paths.options['--project'] = {path:projectPath('write')};
    } else rule.requirements.argument_paths = {grammar: projectGrammar,
      options: {'--project': {path: projectPath(root)}}};
    rule.on_unmet = {decision: Object.fromEntries(Object.entries(rule.decision)
      .map(([profile, decision]) => [profile, decision === 'deny' ? 'deny' : 'ask'])),
    message: 'Choose paths inside the approved roots and supported command syntax.'};
  }
  pack.capabilities.push('field-paths-v1');
  addShortDocs(pack, 'gate');
  return pack;
}

export function addShortDocs(pack, server) {
  const names = ['docs_list', 'docs_search', 'docs_read'];
  for (const tool of names) pack.rules.push({id: `mcp-${tool}`, decision: {loose:'allow', recommended:'allow', strict:'allow'},
    conditions: {domain:'mcp', server, tool}, reason:'Read guides bundled into the verified server, without accessing a project.'});
  const fallback = pack.rules.find(rule => rule.id === 'mcp-unlisted');
  fallback?.conditions.tool.not.one_of.push(...names);
}

export async function gateSwitchCases() {
  const cases = JSON.parse(await readFile(new URL('cases.json', previous)));
  for (const row of cases.cases) {
    if (['mcp-push', 'mcp-sync'].some(name => row.name === `${name}-${row.profile}`)) row.expected = 'allow';
  }
  const binding = cases.cases.find(row => row.input?.kind === 'mcp').mcp;
  const cli = [
    ['branch', ['gate', 'switch', '-r', 'acme', 'feature'], 'allow'],
    ['create', ['gate', 'switch', '-r', 'acme', '-c', 'feature', 'origin/feature'], 'allow'],
    ['force-create', ['gate', 'switch', '-C', 'feature', 'main'], 'allow'],
    ['force-create-equals', ['gate', 'switch', '--force-create=feature', 'main'], 'allow'],
    ['project-current', ['gate', '--project', '.', 'switch', 'feature'], 'allow'],
    ['project', ['gate', '--project', '../acme-other', 'switch', 'feature'], 'ask'],
    ['project-force-push', ['gate', '--project', '.', 'push', '--force-with-lease=abc', 'origin', 'main'], 'destructive'],
    ['project-push', ['gate', '--project', '.', 'push', 'origin', 'main'], 'publish'],
    ['project-amend', ['gate', '--project', '.', 'commit', '--amend', '-m', 'Fix'], 'ask'],
    ['safe-branch-remove', ['gate', 'branch', 'remove', '-r', 'acme', 'old'], 'allow'],
    ['forced-branch-remove', ['gate', 'branch', 'remove', '-r', 'acme', '--force', 'old'], 'destructive'],
    ['init', ['gate', 'init'], 'allow'],
    ['attach', ['gate', 'attach', '-r', 'acme', 'HEAD'], 'allow'],
    ['add', ['gate', 'add', 'src'], 'allow'],
    ['apply', ['gate', 'apply', '--cached', 'change.patch'], 'allow'],
    ['commit', ['gate', 'commit', '-m', 'Fix'], 'allow'],
  ];
  const mcp = [
    ['branch', {repo: 'acme', revision: 'feature'}, 'allow'],
    ['create', {repo: 'acme', create: 'feature', revision: 'origin/feature'}, 'allow'],
    ['force-create', {revision: 'main', force_create: 'feature'}, 'allow'],
    ['project', {revision: 'feature', project: '../acme-other'}, 'ask'],
  ];
  const operations = [
    ['branch_remove', {repo:'acme', branches:['old']}, 'allow'],
    ['branch_remove', {repo:'acme', branches:['old'], force:true}, 'confirmed-destructive'],
    ['attach', {repo:'acme', tip:'HEAD'}, 'allow'],
    ['init', {}, 'allow'], ['recover', {}, 'allow'],
    ['add', {paths:['src']}, 'allow'], ['apply', {patch:'change.patch'}, 'allow'],
    ['commit', {message:'Fix'}, 'allow'], ['commit', {message:'Fix', amend:true}, 'ask'],
    ['worktree_add', {path:'.gate/tasks/feature', branch:'feature'}, 'allow'],
    ['worktree_add', {path:'other/feature', branch:'feature'}, 'allow'],
    ['worktree_add', {path:'../outside', branch:'feature'}, 'ask'],
    ['worktree_add', {path:'.shield/feature', branch:'feature'}, 'ask'],
    ['worktree_remove', {path:'.gate/tasks/feature'}, 'allow'],
    ['worktree_repair', {path:'.gate/tasks/feature'}, 'allow'],
    ['session_remove', {session:'s1'}, 'confirmed-destructive'],
  ];
  for (const profile of ['loose', 'recommended', 'strict']) {
    const expected = decision => ({destructive: profile === 'strict' ? 'deny' : 'ask',
      'confirmed-destructive': profile === 'strict' ? 'deny' : 'allow',
      publish: profile === 'loose' ? 'allow' : 'ask'})[decision] ?? decision;
    for (const [name, argv, decision] of cli)
      cases.cases.push({name: `switch-${name}-${profile}`, profile, argv, expected: expected(decision)});
    for (const [name, arguments_, decision] of mcp)
      cases.cases.push({name: `mcp-switch-${name}-${profile}`, profile, mcp: binding,
        input: {kind: 'mcp', server: 'gate', tool: 'switch', arguments: arguments_, original_input: {}},
        expected: expected(decision)});
    for (const [index, [tool, arguments_, decision]] of operations.entries())
      cases.cases.push({name:`routine-${index}-${profile}`, profile, mcp:binding,
        input:{kind:'mcp', server:'gate', tool, arguments:arguments_, original_input:{}}, expected:expected(decision)});
    for (const tool of ['docs_list', 'docs_search', 'docs_read'])
      cases.cases.push({name:`${tool}-${profile}`, profile, mcp:binding,
        input:{kind:'mcp', server:'gate', tool, arguments:{}, original_input:{}}, expected:'allow'});
  }
  return cases;
}

export async function buildGateSwitchPack() {
  await mkdir(gateSwitchDirectory, {recursive: true});
  await writeFile(new URL('pack.yml', gateSwitchDirectory), JSON.stringify(await gateSwitchPack(), null, 2) + '\n');
  await writeFile(new URL('cases.json', gateSwitchDirectory), JSON.stringify(await gateSwitchCases(), null, 2) + '\n');
  for (const file of ['commands.json', 'LICENSE'])
    await copyFile(new URL(file, previous), new URL(file, gateSwitchDirectory));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildGateSwitchPack();

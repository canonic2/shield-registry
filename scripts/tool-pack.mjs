// Shared constructors for permission packs of subcommand CLIs that also serve
// their own tools over MCP. Each pack's reviewed command data lives in its
// *-policy.mjs file; expected decisions live independently in
// build-tool-cases.mjs.
import {mkdir, writeFile, copyFile} from 'node:fs/promises';

const profiles = (loose, recommended = loose, strict = recommended) => ({loose, recommended, strict});

// Decisions by effect class.
export const decisions = {
  inspect: profiles('allow'),
  routine: profiles('allow', 'allow', 'ask'),
  device: profiles('allow', 'allow', 'ask'),
  change: profiles('allow', 'ask', 'ask'),
  exposure: profiles('allow', 'ask', 'ask'),
  remote: profiles('ask', 'ask', 'deny'),
  execute: profiles('ask', 'ask', 'deny'),
  agent: profiles('ask', 'ask', 'deny'),
  integration: profiles('ask', 'ask', 'deny'),
  destroy: profiles('ask', 'deny', 'deny'),
  credential: profiles('ask', 'deny', 'deny'),
  stream: profiles('ask'),
  folder: profiles('ask'),
  rewrite: profiles('ask'),
  unlisted: profiles('ask', 'ask', 'deny'),
};

const severity = ['allow', 'ask', 'deny'];
const strictest = (a, b) => Object.fromEntries(Object.keys(a).map(profile =>
  [profile, severity[Math.max(severity.indexOf(a[profile]), severity.indexOf(b[profile]))]]));

const baseCapabilities = ['structured-rules-v1', 'argument-rules-v1', 'prefix-leading-v1', 'interleaved-leading-v1', 'location-v1',
  'access-paths-v1', 'unknown-options-v1', 'negated-selectors-v1', 'fallback-rules-v1', 'mcp-integrations-v1'];

export const executableForms = name => [name, `/usr/bin/${name}`, `/usr/local/bin/${name}`, `/opt/homebrew/bin/${name}`];
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A per-user install folder such as `.local/bin`, under any macOS or Linux
// home. The user segment cannot be `.` or `..`.
const homeInstall = (name, folder) => `/(?:Users|home)/[A-Za-z0-9_][A-Za-z0-9_.-]*/${escape(folder)}/${escape(name)}`;

// Explicitly named files must stay inside the approved roots and away from
// version control, Shield state, credentials and agent settings.
const protectedPaths = ['.shield', '.git', '.aws', '.ssh', '.env', '.mcp.json', '.codex', '.claude'];
const pathCheck = root => ({path: {within: {root}, exclude: protectedPaths.map(path => ({root: 'project', path}))}});

/** Every ordering of a subset of the leading options, each in its spellings,
 *  as lists of token-selector chunks: a risk check has no leading phase. */
function leadingOrderings({flags, values}) {
  const forms = [...flags.map(flag => [[flag]]),
    ...values.map(name => [[name, {not: {exact: ''}}], [name, ''], [{prefix: `${name}=`}]])];
  const orderings = (remaining, chosen) => [chosen, ...remaining.flatMap((options, index) =>
    options.flatMap(form => orderings(remaining.filter((_, other) => other !== index), [...chosen, form])))];
  return orderings(forms, []);
}
const leadingPrefixes = leading => leadingOrderings(leading).map(chunks => chunks.flat());

/** Each ordering's options placed before and between `words`, as the
 *  interleaved leading phase accepts them, so a risk check cannot be skipped
 *  by moving a global option between command words. */
function interleavedPrefixes(leading, words) {
  // Options before words[index] are the first `count` chunks; the rest go later.
  const place = (chunks, index) => index === words.length - 1 ? [[...chunks.flat(), words[index]]]
    : Array.from({length: chunks.length + 1}, (_, count) => count).flatMap(count =>
      place(chunks.slice(count), index + 1).map(rest => [...chunks.slice(0, count).flat(), words[index], ...rest]));
  return leadingOrderings(leading).flatMap(chunks => place(chunks, 0));
}

/**
 * Build a pack from a tool description:
 * - `leading`: the tool's global options ({flags, values}). They are accepted
 *   before the subcommand and between its words, as clap's `global = true`
 *   options are, so `gate branch --json remove` matches `branch remove`.
 * - `shortOptions`: the tool's short options ({flags, values}), declared in every
 *   option scan so clusters and attached values parse instead of being skipped.
 * - `commands`: [words, category, reason, adjustments?]. An adjustment is
 *   {id, any?: [options], forbid?: [options], category, reason}; it matches the
 *   same subcommand when any listed option is present (or none of the forbidden
 *   ones is) and decides with equal rank, so the stricter decision wins.
 *   `flags` declares other flags that begin a listed option's name, since an
 *   option scan refuses an undeclared prefix of a checked option. With
 *   `paths: {option: 'read'|'write'}` and/or `operandPaths: 'read'|'write'`
 *   and the command's complete `grammar` ({flags, values, operands?}, where
 *   `operands: true` admits unchecked positional arguments), the named files
 *   must also be in approved paths, or the rule decides `unmet` (a category
 *   that never allows; deny by default). The command rule's cwd check gives it
 *   the same rank, so an adjustment can only make a decision stricter.
 * - `risks`: [id, words, tokens, category, reason] conservative token checks,
 *   repeated for each spelling of the leading options before and between `words`.
 * - `extraCapabilities`: capabilities this tool's data uses beyond the shared set.
 * - `exacts`: [values, category, reason] complete argument lists, alone and,
 *   when --json is a leading flag, with it first or last, that keep a harmless
 *   spelling at its decision.
 * - `homeInstall`: a folder under each user's home, such as `.local/bin`,
 *   where the tool installs itself; MCP connections launching it from there
 *   match the integration. Command rules keep the fixed executable list.
 * - `workspaceSelector`: {option, field}, the CLI option and MCP argument that
 *   select another workspace folder; explicit use asks. Omit it for a tool
 *   whose project option names a developer-configured app project.
 * - `mcpTools`: {tool: [category, reason, fieldAdjustments?]}, where a field
 *   adjustment is {id, fields, category, reason} and outranks the tool rule.
 * - `profileDecisions`: optional reviewed category profiles for a new version.
 * - `activeProjectAdjustments`: keep project review at the base/folder decision;
 *   other field rules apply only when their arguments are actually present.
 */
export function toolPack(tool) {
  // Versioned candidates may select reviewed profiles without rewriting
  // immutable earlier releases or duplicating their command/path grammars.
  const profileDecisions = tool.profileDecisions ?? decisions;
  const executable = {one_of: executableForms(tool.name)};
  const cwd = {within: {root: 'write'}};
  const leading = {flags: tool.leading.flags, values: tool.leading.values, interleaved: true};
  const argv = (id, args, category, reason, {project = true} = {}) => ({id,
    conditions: {domain: 'argv', executable, arguments: args, ...(project ? {cwd} : {})},
    decision: profileDecisions[category], reason});
  const idOf = words => words.map(word => word === '--' ? 'separator' : word).join('-');
  const scan = (words, options, extra) => ({kind: 'options', leading, prefix: words,
    flags: [...new Set([...tool.leading.flags, ...tool.shortOptions.flags, ...options.flags])],
    values: [...new Set([...tool.leading.values, ...tool.shortOptions.values, ...options.values])],
    operands: true, unknown_options: 'skip', ...extra});

  const rules = [];
  // Version and help never reach a workspace, from any folder.
  for (const [id, values] of [['version', ['--version']], ['version-short', ['-V']], ['help', ['--help']], ['help-short', ['-h']], ['help-command', ['help']]])
    rules.push(argv(id, {kind: 'exact', values}, 'inspect', 'Print the version or built-in help.', {project: false}));
  rules.push(argv('help-topic', {kind: 'prefix', values: ['help']}, 'inspect', 'Print built-in help for a command.', {project: false}));

  for (const [words, category, reason, adjustments = []] of tool.commands) {
    const id = idOf(words);
    if (words.length === 1 && words[0] === '--') {
      // Match the raw shell shortcut before a leading parser can consume its
      // separator and mistake the child executable for one of our subcommands.
      // Risk-token rank also keeps child options from selecting a weaker rule.
      leadingPrefixes(tool.leading).forEach((before, index) => {
        const shortcutId = index ? `${id}-leading-${index}` : id;
        const prefix = [...before, '--'];
        rules.push(argv(shortcutId, {kind: 'risk_tokens', prefix, any_of: [{not: {exact: ''}}]}, category, reason));
        rules.push(argv(`${shortcutId}-empty`, {kind: 'sequence', prefix, rest: {kind: 'none'}}, category, reason));
      });
      continue;
    }
    rules.push(argv(id, {kind: 'prefix', leading, values: words}, category, reason));
    for (const help of ['--help', '-h'])
      rules.push(argv(`${id}-help${help === '-h' ? '-short' : ''}`, {kind: 'exact', values: [...words, help]}, 'inspect', 'Print built-in help for a command.', {project: false}));
    for (const adjustment of adjustments) {
      const named = [...(adjustment.any ?? []), ...(adjustment.forbid ?? [])];
      const options = {flags: [...named.filter(name => !(adjustment.values ?? []).includes(name)), ...(adjustment.flags ?? [])],
        values: adjustment.values ?? []};
      const extra = {...(adjustment.any ? {require_any: adjustment.any} : {}), ...(adjustment.forbid ? {forbid: adjustment.forbid} : {})};
      const row = argv(`${id}-${adjustment.id}`, scan(words, options, extra), adjustment.category, adjustment.reason);
      if (adjustment.paths || adjustment.operandPaths) {
        row.requirements = {argument_paths: {
          grammar: {kind: 'options', leading, prefix: words, flags: [...tool.leading.flags, ...adjustment.grammar.flags],
            values: [...tool.leading.values, ...adjustment.grammar.values], operands: Boolean(adjustment.operandPaths || adjustment.grammar.operands)},
          ...(adjustment.paths ? {options: Object.fromEntries(Object.entries(adjustment.paths).map(([name, root]) => [name, pathCheck(root)]))} : {}),
          ...(adjustment.operandPaths ? {operands: pathCheck(adjustment.operandPaths)} : {}),
        }};
        row.on_unmet = {decision: adjustment.unmet ? profileDecisions[adjustment.unmet] : 'deny',
          message: 'Name a file inside the project, away from version control, credentials and agent settings.'};
      }
      rules.push(row);
    }
  }
  // Complete literal forms outrank prefix and option rules; used only to keep
  // a harmless spelling of a stricter command at its own decision.
  const variants = [['', values => values], ...(tool.leading.flags.includes('--json')
    ? [['-json', values => [...values, '--json']], ['-json-leading', values => ['--json', ...values]]] : [])];
  for (const [suffix, spell] of variants) {
    for (const [values, category, reason] of tool.exacts ?? []) {
      const id = `${idOf(values.map(value => value.replace(/^-+/, '')))}${suffix}`;
      rules.push(argv(`exact-${id}`, {kind: 'exact', values: spell(values)}, category, reason));
    }
  }
  for (const [id, words, tokens, category, reason] of tool.risks ?? []) {
    interleavedPrefixes(tool.leading, words).forEach((prefix, index) => rules.push(argv(index ? `${id}-leading-${index}` : id,
      {kind: 'risk_tokens', prefix, any_of: tokens}, category, reason)));
  }
  // An explicit --project selects another folder, whose files and policy this
  // request's cwd check does not cover. It ranks with the subcommand rules, so
  // a stricter subcommand decision still wins.
  if (tool.workspaceSelector) rules.push(argv('project-option', scan([], {flags: [], values: [tool.workspaceSelector.option]},
    {require_any: [tool.workspaceSelector.option]}), 'folder',
    'An explicit --project can select a folder outside the approved project; review the selected folder.'));
  rules.push({id: 'unlisted', conditions: {domain: 'argv', executable, arguments: {kind: 'any'}}, decision: profileDecisions.unlisted,
    reason: `Unlisted ${tool.title} syntax and commands run outside approved project folders require review.`});

  // MCP: the tool's own stdio server, launched as `<name> mcp serve`.
  const server = tool.name;
  const mcp = (id, tool, category, reason, fields) => ({id, decision: profileDecisions[category],
    conditions: {domain: 'mcp', server, tool, ...(fields ? {fields} : {})}, reason});
  const known = Object.keys(tool.mcpTools);
  for (const [name, [category, reason, adjustments = []]] of Object.entries(tool.mcpTools)) {
    rules.push(mcp(`mcp-${name}`, name, category, reason));
    for (const adjustment of adjustments) rules.push(mcp(`mcp-${name}-${adjustment.id}`, name, adjustment.category, adjustment.reason, adjustment.fields));
    // Frozen versions retain their conservative aggregation. New versions let
    // matching field rules tighten project review without assuming every
    // optional destructive argument was supplied.
    if (tool.workspaceSelector) rules.push({...mcp(`mcp-${name}-project`, name, 'folder',
      'An explicit project can select a folder outside the approved project; review the selected folder.',
      {[tool.workspaceSelector.field]: {text: {not: {exact: ''}}}}),
    decision: [category, ...(tool.activeProjectAdjustments ? [] : adjustments.map(adjustment => adjustment.category))]
      .map(key => profileDecisions[key]).reduce(strictest, profileDecisions.folder)});
  }
  rules.push({...mcp('mcp-unlisted', {not: {one_of: known}}, 'unlisted', `Unknown ${tool.title} MCP tools require review.`), fallback: true});

  return {
    schema_version: 1, kind: 'pack', id: `canonic/${tool.name}`, version: tool.version, description: tool.description,
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: tool.engine},
    capabilities: [...new Set([...baseCapabilities, ...(tool.homeInstall ? ['regex-v1'] : []), ...(tool.extraCapabilities ?? [])])].sort(),
    mcp_integrations: {[server]: {transport: 'stdio', fields: {
      '/command': {text: tool.homeInstall
        ? {regex: [...executableForms(tool.name).map(escape), homeInstall(tool.name, tool.homeInstall)].join('|')}
        : {one_of: executableForms(tool.name)}},
      '/args/0': {exact: 'mcp'}, '/args/1': {exact: 'serve'},
    }, defaults: {type: 'stdio', command: tool.name, args: ['mcp', 'serve'], env: {}}}},
    rules,
  };
}

export const destinationOf = pack => new URL(`../packs/${pack.id}/${pack.version}/`, import.meta.url);

export async function writePack(pack) {
  const destination = destinationOf(pack);
  await mkdir(destination, {recursive: true});
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('commands.json', destination), JSON.stringify({schema_version: 1,
    commands: [{name: pack.id.split('/')[1], rule_ids: pack.rules.filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]}, null, 2) + '\n');
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', destination));
}

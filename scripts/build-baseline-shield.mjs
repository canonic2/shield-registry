import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {shieldCases} from './baseline-shield-cases.mjs';

export const previous = new URL('../packs/canonic/baseline/0.18.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.19.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));

const executable = {regex: String.raw`^(?:shield(?:\.exe)?|/(?:bin|usr/bin|usr/local/bin|opt/homebrew/bin)/shield|/(?:Users|home)/[A-Za-z0-9_][A-Za-z0-9_. -]*/\.local/bin/shield|[A-Za-z]:[\\/]Users[\\/][A-Za-z0-9_][A-Za-z0-9_. -]*[\\/]\.local[\\/]bin[\\/]shield\.exe)$`};

const inspection = [
  'status', 'doctor', 'docs_list', 'docs_read', 'docs_search', 'history_list', 'history_show',
  'pack_info', 'pack_list', 'pack_search', 'pack_show', 'policy_compare', 'policy_draft_list',
  'policy_evaluate', 'policy_show', 'registry_list', 'request_list', 'request_show', 'rule_list',
  'session_grant_list', 'session_grant_show', 'suggestion_list',
];
const preparation = [
  'pack_add', 'pack_configure', 'pack_remove', 'pack_update', 'policy_defer', 'policy_draft_remove',
  'policy_propose', 'policy_withdraw', 'review_defer', 'rule_add', 'rule_edit', 'rule_remove',
  'session_grant_propose', 'session_grant_reconsider',
];
const confirmation = [
  'disable', 'enable', 'history_configure', 'init', 'mcp_setup', 'policy_apply', 'policy_reject',
  'protection_set', 'registry_add', 'registry_default', 'registry_remove', 'registry_trust',
  'request_approve', 'request_deny', 'session_grant_approve', 'session_grant_revoke', 'setup',
];

function integrations() {
  const launchers = [
    ['shield-stdio', ['mcp', 'serve']],
    ['shield-project', ['mcp', 'serve', '--project', '.']],
  ];
  for (const agent of ['codex', 'claude', 'gemini', 'agy', 'copilot', 'opencode']) {
    const selection = ['--project', '.', '--agent', agent];
    launchers.push([`shield-${agent}`, ['mcp', 'serve', ...selection]],
      [`shield-legacy-${agent}`, ['__internal', 'mcp', ...selection]]);
  }
  return Object.fromEntries(launchers.map(([id, args]) => [id, {
    transport: 'stdio',
    fields: {'/command': {text: executable}, '/args': {exact: args}, '/env': {exact: {}}},
  }]));
}

const cliRules = [
  {id: 'shield-version', decision: 'allow', conditions: {domain: 'argv', executable,
    arguments: {kind: 'sequence', prefix: [{one_of: ['--version', '-V']}], rest: {kind: 'none'}}},
  reason: 'Print the Shield version without opening project policy.'},
  {id: 'shield-help', decision: 'allow', conditions: {domain: 'argv', executable,
    arguments: {kind: 'options', prefix: [], flags: ['--help', '-h'], require_any: ['--help', '-h'],
      values: [{name: '--project', match: {exact: '.'}, repeat: 'forbid'}], long_equals: true,
      operands: {match: {regex: '^[a-z][a-z-]*$'}}}},
  reason: 'Print Shield command help without opening policy or selecting an external project, configuration or output path.'},
];

function mcpRules(server) {
  return [
    {id: 'shield-mcp-inspection', decision: 'allow',
      conditions: {domain: 'mcp', server, tool: {one_of: inspection}},
      reason: 'Inspect Shield policy, diagnostics, history, approvals, discovered packs and bundled documentation.'},
    {id: 'shield-mcp-preparation', decision: 'allow',
      conditions: {domain: 'mcp', server, tool: {one_of: preparation}},
      reason: "Prepare, defer or withdraw reviews. Guided pack and rule changes require Shield's own confirmation before publication."},
    {id: 'shield-mcp-policy-review', decision: 'allow',
      conditions: {domain: 'mcp', server, tool: 'policy_review',
        fields: {'/proposal_id': {text: {regex: String.raw`\A[^\x00]{1,128}\z`}}}},
      reason: "Open Shield's mandatory human confirmation for an exact retained proposal."},
    {id: 'shield-mcp-setup-preview-other-project', decision: 'ask',
      conditions: {domain: 'mcp', server, tool: 'mcp_setup_preview', fields: {'/project': {text: {regex: '(?s).*'}}}},
      reason: 'Review setup inspection that explicitly selects a different project.'},
    {id: 'shield-mcp-setup-preview', decision: 'allow', fallback: true,
      conditions: {domain: 'mcp', server, tool: 'mcp_setup_preview'},
      reason: 'Preview agent registration changes without publishing them.'},
    {id: 'shield-mcp-confirmation', decision: 'ask',
      conditions: {domain: 'mcp', server, tool: {one_of: confirmation}},
      reason: 'Review publication, authorization, registry trust or administrative changes through the host and Shield.'},
  ];
}

export async function baselineShieldPack() {
  const pack = await read('pack.yml');
  const shield = integrations();
  pack.version = '0.19.0';
  pack.description += ' Includes Shield help, version and MCP permissions.';
  Object.assign(pack.mcp_integrations, shield);
  pack.rules.push(...cliRules, ...mcpRules({one_of: Object.keys(shield)}));
  return pack;
}

export async function baselineShieldCommands() {
  const inventory = await read('commands.json');
  const ruleIds = cliRules.map(rule => rule.id);
  const index = inventory.commands.findIndex(row => row.name > 'shield');
  inventory.commands.splice(index, 0, {name: 'shield', rule_ids: ruleIds, source_rule_ids: ruleIds});
  return inventory;
}

export async function baselineShieldReleaseCases() {
  const cases = await read('cases.json');
  cases.cases.push(...shieldCases());
  return cases;
}

export function guide() {
  return `# Baseline permissions 0.19.0

This release adds Shield CLI and MCP permissions to [Baseline 0.18.0](../0.18.0/README.md).
It uses the same Shield engine range and policy capabilities.

## Shield CLI

All profiles allow \`shield --version\`, \`shield -V\` and help such as
\`shield pack update --help\`. Help accepts \`--project .\`. Shield's native hook
reserves operator CLI commands for people at the terminal. Agents use MCP for
project status, diagnostics, bundled guides, and policy and request workflows.

## Shield MCP

All profiles allow inspection, review preparation, and calls that open Shield's
own policy confirmation on a matching connection. Host-reviewed publication,
request authority, registry trust and administrative changes keep their Ask
decisions. Shield validates arguments and review ownership before asking.

| Decision | Tools |
| --- | --- |
| Allow inspection | ${inspection.map(tool => `\`${tool}\``).join(', ')} |
| Allow preparation | ${preparation.map(tool => `\`${tool}\``).join(', ')} |
| Allow Shield's form | \`policy_review\` with a nonempty proposal ID of at most 128 characters |
| Allow setup preview | \`mcp_setup_preview\` for the connected project |
| Ask | ${confirmation.map(tool => `\`${tool}\``).join(', ')}, setup preview with an explicit project, and unlisted tools |

Pack and rule tools can take \`review: true\` to open Shield's form after
preparation. For a separately prepared proposal, \`policy_review\` opens the
same form with its \`proposal_id\`. Applying the exact change requires acceptance
in the form. \`policy_apply\` keeps its host review. Missing or malformed
proposal IDs fall back to Ask.

\`setup\` covers initialization and repair, reuses saved agent choices and
requires human confirmation for changes. \`init\` is the first-run compatibility
tool and requires an explicit agent list. Registry discovery and trust review
keep their Ask decision, including the \`review_ref\` follow-up. The default
registry scope is project. \`mcp_setup\` supports explicit Claude and Codex
repair. A preview that names a project requires review, even
though it does not publish changes. Shield validates required and malformed
arguments before any action.

Connection matching uses stdio with an empty environment override and an exact
Shield launcher. It recognizes \`shield mcp serve\`,
\`shield mcp serve --project .\` and the generated
\`shield mcp serve --project . --agent <agent>\` launch for Codex, Claude Code,
Gemini CLI, Antigravity, Copilot CLI and OpenCode. Shield 0.54.0 still accepts the
corresponding legacy \`shield __internal mcp\` registration. The executable can
be the PATH name or a standard install path, including \`~/.local/bin/shield\`.
The local host resolves and starts the executable. Alternate configuration
arguments, extra environment, wrappers and HTTP connections require separate
review. Merely naming a server \`shield\` grants no permissions.

Shield setup manages the native MCP registration and its approvals. Baseline
supplies permission rules for matching connections evaluated by the pack.

Reviewed against Shield 0.55.0's CLI, MCP catalog, native operator guard and setup
launchers. Generate with \`node scripts/build-baseline-shield.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/baseline-shield.test.mjs\`.

Licensed under MIT.
`;
}

export async function build() {
  await mkdir(destination, {recursive: true});
  for (const [name, document] of [['pack.yml', await baselineShieldPack()],
    ['commands.json', await baselineShieldCommands()], ['cases.json', await baselineShieldReleaseCases()]])
    await writeFile(new URL(name, destination), JSON.stringify(document, null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), guide());
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();

const cli = [
  ['version', ['shield', '--version'], 'allow'],
  ['version-short', ['shield', '-V'], 'allow'],
  ['installed', ['/Users/acme/.local/bin/shield', '--version'], 'allow'],
  ['linux-installed', ['/home/acme/.local/bin/shield', '--version'], 'allow'],
  ['windows', ['shield.exe', '--version'], 'allow'],
  ['windows-installed', [String.raw`C:\Users\Acme User\.local\bin\shield.exe`, '--version'], 'allow'],
  ['help', ['shield', '--help'], 'allow'],
  ['setup-help', ['shield', 'setup', '--help'], 'allow'],
  ['repair-help', ['shield', 'mcp', 'setup', '-h'], 'allow'],
  ['pack-add-help', ['shield', 'pack', 'add', '--help'], 'allow'],
  ['subcommand-help', ['shield', 'pack', 'update', '-h'], 'allow'],
  ['operator-help', ['shield', 'protection', 'set', '--help'], 'allow'],
  ['server-help', ['shield', 'mcp', 'serve', '--help'], 'allow'],
  ['local-project-help', ['shield', '--project', '.', 'mcp', 'setup', '--help'], 'allow'],
  ['local-project-equals-help', ['shield', '--project=.', 'mcp', 'setup', '--help'], 'allow'],
  ['version-extra', ['shield', '--version', 'disable'], 'ask'],
  ['no-metadata-flag', ['shield', 'pack', 'update'], 'ask'],
  ['operator-pack-add', ['shield', 'pack', 'add', 'main/git'], 'ask'],
  ['operator-pack-set', ['shield', 'pack', 'add', 'main/git', '--set', 'mode=read'], 'ask'],
  ['shell-status', ['shield', 'status'], 'ask'],
  ['shell-start-server', ['shield', 'mcp', 'serve'], 'ask'],
  ['operator-setup', ['shield', 'setup', '--agent', 'codex'], 'ask'],
  ['operator-repair', ['shield', 'mcp', 'setup', '--agent', 'codex', '--repair'], 'ask'],
  ['repair-flag-with-help', ['shield', 'mcp', 'setup', '--repair', '--help'], 'ask'],
  ['operator-approval', ['shield', 'request', 'approve', 'request-a'], 'ask'],
  ['internal-transport', ['shield', '__internal', 'native-hook'], 'ask'],
  ['separator-before-help', ['shield', 'enable', '--', '--help'], 'ask'],
  ['switch-project', ['shield', '--project', '/outside/project', 'status', '--help'], 'ask'],
  ['alternate-config', ['shield', '--config=other.yml', 'pack', 'update', '--help'], 'ask'],
  ['write-debug-log', ['shield', '--debug-log-dir=/outside/log', '--help'], 'ask'],
  ['foreign-path', ['./shield', '--version'], 'ask'],
  ['foreign-name', ['shield-local', '--version'], 'ask'],
];

// Expected behavior is maintained independently of the policy's tool groups.
export const shieldToolCases = [
  ['disable', {}, 'ask'],
  ['docs_list', {}, 'allow'],
  ['docs_read', {path: 'getting-started.md'}, 'allow'],
  ['docs_search', {query: 'approval'}, 'allow'],
  ['doctor', {}, 'allow'],
  ['enable', {}, 'ask'],
  ['history_configure', {purge: true}, 'ask'],
  ['history_list', {limit: 5}, 'allow'],
  ['history_show', {entry_id: 'entry-a'}, 'allow'],
  ['init', {agents: ['codex']}, 'ask'],
  ['mcp_setup', {agents: ['codex']}, 'ask'],
  ['mcp_setup_preview', {agents: ['codex']}, 'allow'],
  ['pack_add', {reference: 'main/git'}, 'allow'],
  ['pack_configure', {reference: 'main/git'}, 'allow'],
  ['pack_info', {reference: 'main/baseline'}, 'allow'],
  ['pack_list', {}, 'allow'],
  ['pack_remove', {reference: 'main/git'}, 'allow'],
  ['pack_search', {query: 'git'}, 'allow'],
  ['pack_show', {reference: 'main/baseline'}, 'allow'],
  ['pack_update', {}, 'allow'],
  ['policy_apply', {}, 'ask'],
  ['policy_compare', {before_candidate_id: 'before', after_candidate_id: 'after', domain: 'literal_argv'}, 'allow'],
  ['policy_defer', {intent: 'Review the Git pack', idempotency_key: 'defer-a'}, 'allow'],
  ['policy_draft_list', {}, 'allow'],
  ['policy_draft_remove', {draft_id: 'draft-a'}, 'allow'],
  ['policy_evaluate', {input: {kind: 'argv', executable: 'git', arguments: ['status'], original_input: {}},
    context: {cwd: '/project'}}, 'allow'],
  ['policy_propose', {change: {kind: 'pack_add', reference: 'main/git'}}, 'allow'],
  ['policy_reject', {proposal_id: 'proposal-a'}, 'ask'],
  ['policy_review', {proposal_id: 'proposal-a'}, 'allow'],
  ['policy_show', {}, 'allow'],
  ['policy_withdraw', {proposal_id: 'proposal-a'}, 'allow'],
  ['protection_set', {agent_settings_change: 'allow'}, 'ask'],
  ['registry_add', {name: 'acme', location: 'https://registry.example'}, 'ask'],
  ['registry_default', {name: 'acme'}, 'ask'],
  ['registry_list', {}, 'allow'],
  ['registry_remove', {name: 'acme'}, 'ask'],
  ['registry_trust', {name: 'acme'}, 'ask'],
  ['request_approve', {request_id: 'request-a'}, 'ask'],
  ['request_deny', {request_id: 'request-a'}, 'ask'],
  ['request_list', {}, 'allow'],
  ['request_show', {request_id: 'request-a'}, 'allow'],
  ['review_defer', {session_id: 'session-a', review_ids: ['review-a']}, 'allow'],
  ['rule_add', {}, 'allow'],
  ['rule_edit', {}, 'allow'],
  ['rule_list', {}, 'allow'],
  ['rule_remove', {rule_id: 'rule-a'}, 'allow'],
  ['session_grant_approve', {proposal_id: 'proposal-a', candidate_digest: 'digest-a'}, 'ask'],
  ['session_grant_list', {}, 'allow'],
  ['session_grant_propose', {}, 'allow'],
  ['session_grant_reconsider', {proposal_id: 'proposal-a', candidate_digest: 'digest-a', idempotency_key: 'retry-a'}, 'allow'],
  ['session_grant_revoke', {grant_id: 'grant-a'}, 'ask'],
  ['session_grant_show', {id: 'grant-a'}, 'allow'],
  ['setup', {}, 'ask'],
  ['status', {}, 'allow'],
  ['suggestion_list', {}, 'allow'],
];

const registeredArgs = ['mcp', 'serve', '--project', '.', '--agent', 'codex'];
const stdio = (command, args = registeredArgs, env = {}) => ({type: 'stdio', command, args, env});
const binding = (transport, server = 'shield-tools') => ({[server]: {transport, agents: {codex: server}}});

const exampleRule = {id: 'acme-status', decision: 'allow', conditions: {domain: 'argv',
  executable: 'acme', arguments: {kind: 'sequence', prefix: ['status'], rest: {kind: 'none'}}}};
const guidedPolicyCalls = [
  ['pack_add', {reference: 'main/git'}],
  ['pack_configure', {reference: 'main/git'}],
  ['pack_remove', {reference: 'main/git', layer: 'local'}],
  ['pack_update', {}],
  ['rule_add', {rule: exampleRule}],
  ['rule_edit', {rule_id: 'acme-status', rule: exampleRule}],
  ['rule_remove', {rule_id: 'acme-status'}],
];

function mcpCase(name, profile, tool, arguments_, expected, mcp, server = 'shield-tools') {
  return {name: `shield-mcp-${name}-${profile}`, profile, expected, mcp,
    input: {kind: 'mcp', server, tool, arguments: arguments_, original_input: {}}};
}

export const shieldRestoreToolCase = ['pack_restore', {}, 'allow'];

export const shieldCodexApplyArguments = {
  change: 'Review one exact project rule',
  details: 'Review the selected command and working directory.',
  reference: '0123456789abcdef01234567',
};

export const shieldRequestApproval = {
  single: {request_id: 'hook-request-acme-1'},
  group: {request_ids: ['hook-request-acme-1', 'hook-request-acme-2']},
};

export function shieldApprovalArgumentCases() {
  const registered = binding(stdio('shield'));
  const legacy = binding(stdio('shield', ['__internal', 'mcp', '--project', '.', '--agent', 'codex']));
  const remote = binding({type: 'http', url: 'https://shield.example/mcp'});
  const {single, group} = shieldRequestApproval;
  return ['loose', 'recommended', 'strict'].flatMap(profile => [
    mcpCase('codex-apply', profile, 'policy_apply', shieldCodexApplyArguments, 'ask', registered),
    mcpCase('codex-apply-legacy', profile, 'policy_apply', shieldCodexApplyArguments, 'ask', legacy),
    mcpCase('codex-apply-malformed-reference', profile, 'policy_apply',
      {...shieldCodexApplyArguments, reference: 123}, 'ask', registered),
    mcpCase('codex-apply-remote', profile, 'policy_apply', shieldCodexApplyArguments, 'ask', remote),
    mcpCase('request-approve-single', profile, 'request_approve', single, 'ask', registered),
    mcpCase('request-approve-group', profile, 'request_approve', group, 'ask', registered),
    mcpCase('request-approve-legacy-group', profile, 'request_approve', group, 'ask', legacy),
    mcpCase('request-approve-missing-ids', profile, 'request_approve', {}, 'ask', registered),
    mcpCase('request-approve-both-id-forms', profile, 'request_approve', {...single, ...group}, 'ask', registered),
    mcpCase('request-approve-remote-group', profile, 'request_approve', group, 'ask', remote),
  ]);
}

export function shieldDocsPagingCases() {
  const registered = binding(stdio('shield'));
  const legacy = binding(stdio('shield', ['__internal', 'mcp', '--project', '.', '--agent', 'codex']));
  const external = binding(stdio('shield', ['mcp', 'serve', '--project', '/outside', '--agent', 'codex']));
  const args = {path: 'getting-started.md', offset: 1, limit: 1};
  return ['loose', 'recommended', 'strict'].flatMap(profile => [
    mcpCase('docs-read-offset', profile, 'docs_read', args, 'allow', registered),
    mcpCase('docs-read-offset-legacy', profile, 'docs_read', args, 'allow', legacy),
    mcpCase('docs-read-offset-outside-project', profile, 'docs_read', args, 'ask', external),
  ]);
}

export function shieldInspectionCases() {
  const pack_selector = 'pack:15b30c2d-114b-4088-8a21-189c07e49f51';
  const registered = binding(stdio('shield'));
  const legacy = binding(stdio('shield', ['__internal', 'mcp', '--project', '.', '--agent', 'codex']));
  const external = binding(stdio('shield', ['mcp', 'serve', '--project', '/outside']));
  return ['loose', 'recommended', 'strict'].flatMap(profile => [
    {name: `shield-cli-filtered-rule-list-help-${profile}`, profile,
      argv: ['shield', 'rule', 'list', '--help'], expected: 'allow'},
    {name: `shield-cli-filtered-rule-list-${profile}`, profile,
      argv: ['shield', 'rule', 'list', '--section', 'invocations', '--pack-selector', pack_selector], expected: 'ask'},
    mcpCase('rule-list-by-pack', profile, 'rule_list', {pack_selector}, 'allow', registered),
    ...['shared', 'invocations', 'command_sets'].map(section =>
      mcpCase(`rule-list-${section}-by-pack`, profile, 'rule_list', {section, pack_selector}, 'allow', registered)),
    mcpCase('rule-list-by-pack-legacy', profile, 'rule_list', {pack_selector}, 'allow', legacy),
    mcpCase('rule-list-by-pack-outside-project', profile, 'rule_list', {pack_selector}, 'ask', external),
    // Shield rejects invalid input in the inspection tool without any side effects.
    mcpCase('rule-list-missing-pack-selector', profile, 'rule_list', {section: 'invocations'}, 'allow', registered),
    mcpCase('rule-list-malformed-pack-selector', profile, 'rule_list', {pack_selector: 123}, 'allow', registered),
    mcpCase('evaluate-mcp-normalized-input', profile, 'policy_evaluate', {
      input: {kind: 'mcp', server: 'acme', tool: 'search', arguments: {query: 'documentation'}, original_input: {}},
      context: {cwd: '/project'},
    }, 'allow', registered),
  ]);
}

export function shieldRestoreCases() {
  const registered = binding(stdio('shield'));
  const legacy = binding(stdio('shield', ['__internal', 'mcp', '--project', '.', '--agent', 'codex']));
  const external = binding(stdio('shield', ['mcp', 'serve', '--project', '/outside', '--agent', 'codex']));
  const wrapped = binding(stdio('env', ['shield', ...registeredArgs]));
  const [tool, args, expected] = shieldRestoreToolCase;
  return ['loose', 'recommended', 'strict'].flatMap(profile => [
    {name: `shield-cli-pack-restore-help-${profile}`, profile,
      argv: ['shield', 'pack', 'restore', '--help'], expected: 'allow'},
    {name: `shield-cli-pack-restore-${profile}`, profile,
      argv: ['shield', 'pack', 'restore'], expected: 'ask'},
    mcpCase(tool, profile, tool, args, expected, registered),
    mcpCase('restore-legacy-launcher', profile, tool, args, expected, legacy),
    mcpCase('restore-extra-argument', profile, tool, {reference: 'main/git'}, 'ask', registered),
    mcpCase('restore-malformed-argument', profile, tool, {project: false}, 'ask', registered),
    mcpCase('restore-outside-project', profile, tool, args, 'ask', external),
    mcpCase('restore-wrapped-launcher', profile, tool, args, 'ask', wrapped),
    mcpCase('restore-server-name-only', profile, tool, args, 'ask', {}, 'shield'),
  ]);
}

export function shieldCases() {
  const registered = binding(stdio('shield'));
  const transports = [
    ['generic', stdio('shield', ['mcp', 'serve']), 'allow'],
    ['explicit-current-project', stdio('shield', ['mcp', 'serve', '--project', '.']), 'allow'],
    ['claude', stdio('shield', ['mcp', 'serve', '--project', '.', '--agent', 'claude']), 'allow'],
    ['gemini', stdio('shield', ['mcp', 'serve', '--project', '.', '--agent', 'gemini']), 'allow'],
    ['antigravity', stdio('shield', ['mcp', 'serve', '--project', '.', '--agent', 'agy']), 'allow'],
    ['copilot', stdio('shield', ['mcp', 'serve', '--project', '.', '--agent', 'copilot']), 'allow'],
    ['opencode', stdio('shield', ['mcp', 'serve', '--project', '.', '--agent', 'opencode']), 'allow'],
    ['legacy', stdio('shield', ['__internal', 'mcp', '--project', '.', '--agent', 'codex']), 'allow'],
    ['absolute', stdio('/Users/acme/.local/bin/shield'), 'allow'],
    ['windows', stdio('shield.exe'), 'allow'],
    ['relative-executable', stdio('./shield'), 'ask'],
    ['wrapper', stdio('env', ['shield', ...registeredArgs]), 'ask'],
    ['foreign-executable', stdio('/project/bin/shield'), 'ask'],
    ['alternate-agent', stdio('shield', ['mcp', 'serve', '--project', '.', '--agent', 'other']), 'ask'],
    ['other-project', stdio('shield', ['mcp', 'serve', '--project', '/outside', '--agent', 'codex']), 'ask'],
    ['agentless-other-project', stdio('shield', ['mcp', 'serve', '--project', '/outside']), 'ask'],
    ['skills-only', stdio('shield', ['mcp', 'serve', '--skills-only']), 'ask'],
    ['alternate-config', stdio('shield', [...registeredArgs, '--config', 'other.yml']), 'ask'],
    ['extra-environment', stdio('shield', registeredArgs, {SHIELD_DEBUG_LOG_DIR: '/outside'}), 'ask'],
    ['http', {type: 'http', url: 'https://shield.example/mcp'}, 'ask'],
  ];
  return ['loose', 'recommended', 'strict'].flatMap(profile => [
    ...cli.map(([name, argv, expected]) => ({name: `shield-cli-${name}-${profile}`, profile, argv, expected})),
    ...shieldToolCases.map(([tool, args, expected]) => mcpCase(tool, profile, tool, args, expected, registered)),
    ...transports.map(([name, transport, expected]) => mcpCase(`transport-${name}`, profile,
      'status', {}, expected, binding(transport))),
    mcpCase('renamed', profile, 'status', {}, 'allow', binding(stdio('shield'), 'policy-tools'), 'policy-tools'),
    mcpCase('alias-only', profile, 'status', {}, 'ask', {}, 'shield'),
    mcpCase('integration-name-only', profile, 'status', {}, 'ask', {}, 'shield-codex'),
    mcpCase('future-tool', profile, 'future_tool', {}, 'ask', registered),
    ...guidedPolicyCalls.map(([tool, args]) => mcpCase(`guided-${tool}`, profile,
      tool, {...args, review: true}, 'allow', registered)),
    mcpCase('review-missing-id', profile, 'policy_review', {}, 'ask', registered),
    mcpCase('review-empty-id', profile, 'policy_review', {proposal_id: ''}, 'ask', registered),
    mcpCase('review-typed-id', profile, 'policy_review', {proposal_id: 123}, 'ask', registered),
    mcpCase('review-long-id', profile, 'policy_review', {proposal_id: 'a'.repeat(129)}, 'ask', registered),
    mcpCase('review-unverified-binding', profile, 'policy_review', {proposal_id: 'proposal-a'}, 'ask',
      binding(stdio('env', ['shield', ...registeredArgs]))),
    mcpCase('guided-registry', profile, 'registry_add', {review: true}, 'ask', registered),
    mcpCase('registry-review-ref', profile, 'registry_add', {review_ref: 'review-a'}, 'ask', registered),
    mcpCase('registry-discard-ref', profile, 'registry_add', {review_ref: 'review-a', discard: true}, 'ask', registered),
    mcpCase('explicit-setup', profile, 'setup', {agents: ['codex'], profile: 'strict'}, 'ask', registered),
    mcpCase('malformed-setup', profile, 'setup', {agents: 'codex'}, 'ask', registered),
    mcpCase('missing-init-agents', profile, 'init', {}, 'ask', registered),
    mcpCase('repair-preview', profile, 'mcp_setup_preview', {agents: ['codex'], repair: true}, 'allow', registered),
    mcpCase('external-repair-preview', profile, 'mcp_setup_preview',
      {agents: ['codex'], repair: true, project: '/outside'}, 'ask', registered),
    mcpCase('external-repair', profile, 'mcp_setup',
      {agents: ['codex'], repair: true, project: '/outside'}, 'ask', registered),
    mcpCase('other-project-preview', profile, 'mcp_setup_preview', {project: '/outside'}, 'ask', registered),
    mcpCase('windows-project-preview', profile, 'mcp_setup_preview', {project: 'C:/Outside'}, 'ask', registered),
    mcpCase('missing-docs-argument', profile, 'docs_read', {}, 'allow', registered),
    mcpCase('malformed-proposal', profile, 'policy_propose', {change: 123}, 'allow', registered),
  ]);
}

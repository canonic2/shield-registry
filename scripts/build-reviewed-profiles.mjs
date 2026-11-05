// Reviewed profile migrations preserve the original grammars and boundaries.
// Published bytes and the independent expected decisions are never rewritten.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {toolPack} from './tool-pack.mjs';
import {gate} from './gate-policy.mjs';
import {box} from './box-policy.mjs';
import {testrun} from './testrun-policy.mjs';

const profiles = (loose, recommended = loose, strict = recommended) => ({loose, recommended, strict});
const allow = profiles('allow');
const review = profiles('ask');
const privileged = profiles('allow', 'ask', 'ask');
const destructive = profiles('ask', 'ask', 'deny');
const deny = profiles('deny');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const source = async (name, version) => JSON.parse(await readFile(new URL(`../packs/canonic/${name}/${version}/pack.yml`, import.meta.url)));
const change = (rule, decision, reason) => Object.assign(rule, {decision, reason});

export const revisions = {baseline: ['0.10.0', '0.11.0'], git: ['0.7.0', '0.8.0'],
  node: ['0.3.1', '0.4.0'], rust: ['0.1.2', '0.2.0'], aws: ['0.1.0', '0.2.0'],
  gate: ['0.1.0', '0.2.0'], box: ['0.1.0', '0.2.0'], testrun: ['0.1.0', '0.2.0']};

function baseline(pack) {
  for (const rule of pack.rules) {
    if (['shared-unsupported-cat', 'grep-other'].includes(rule.id)) {
      change(rule, review, 'Unsupported reader syntax requires review; supported forms retain their path checks.');
      rule.guidance = {message: rule.reason};
    }
    if (/^deny-(?:docker-|kubectl-delete|aws-s3-|hostname-set)/.test(rule.id))
      change(rule, destructive, 'Review a destructive or host-wide change; Strict refuses it.');
  }
  const system = pack.rules.find(rule => rule.id === 'shared-deny-sudo');
  const privilegedNames = new Set(['sudo', 'su', 'doas', 'mount', 'umount']);
  const spellings = system.conditions.executable.one_of.filter(path => privilegedNames.has(path.split('/').at(-1)));
  system.conditions.executable.one_of = system.conditions.executable.one_of.filter(path => !spellings.includes(path));
  system.conditions.executable.one_of.push('/usr/sbin/diskutil');
  pack.rules.push({id: 'review-privilege', conditions: {domain: 'argv', executable: {one_of: spellings},
    arguments: {kind: 'any'}}, decision: review, reason: 'Review privilege escalation and mount changes; the command is not inspected as a transparent wrapper.'});
  pack.rules.push({id: 'disk-inspection', conditions: {domain: 'argv',
    executable: {one_of: ['diskutil', '/usr/sbin/diskutil', '/usr/bin/diskutil']},
    arguments: {kind: 'prefix', values: [{one_of: ['list', 'info']}]}},
  decision: allow, reason: 'Inspect disk identities and metadata without changing disks.'});
  return pack;
}

function git(pack) {
  const privilegedIds = new Set(['base-rebase', 'review-commit-amend', 'configuration-removal-or-editor',
    'rewrite-or-hook-bypass', 'rebase-hook-bypass', 'submodule-external-execution', 'worktree-removal', 'submodule-deinit']);
  for (const rule of pack.rules) {
    if (same(rule.decision, profiles('ask', 'ask', 'deny')) || privilegedIds.has(rule.id))
      change(rule, privileged, 'Review remote access, history changes, configuration or external helpers.');
    else if (same(rule.decision, profiles('ask', 'deny', 'deny')))
      change(rule, destructive, 'Review possible data loss; Strict refuses destructive forms.');
  }
  for (const id of ['worktree-removal', 'network-submodule-update']) {
    const rule = pack.rules.find(rule => rule.id === id);
    rule.conditions.arguments = {kind: 'options', prefix: rule.conditions.arguments.values,
      flags: [], values: [], operands: true, unknown_options: 'skip'};
  }
  if (!pack.capabilities.includes('unknown-options-v1')) pack.capabilities.push('unknown-options-v1');
  // The old mixed command set also denied maintenance, hooks and credential
  // administration. Separate those from destructive storage operations.
  const names = ['credential', 'credential-cache', 'credential-cache--daemon', 'credential-store',
    'for-each-repo', 'fsmonitor--daemon', 'gc', 'hook', 'index-pack', 'maintenance', 'merge-index',
    'merge-ours', 'merge-recursive', 'merge-recursive-ours', 'merge-recursive-theirs', 'merge-subtree',
    'multi-pack-index', 'pack-objects', 'pack-refs', 'pack-redundant', 'repack', 'submodule--helper',
    'unpack-objects', 'update-server-info', 'checkout-index', 'read-tree', 'reflog', 'replace', 'update-ref'];
  pack.command_sets['reviewed-administration'] = {};
  for (const name of names) {
    pack.command_sets['reviewed-administration'][name] = pack.command_sets['baseline-2'][name];
    delete pack.command_sets['baseline-2'][name];
  }
  pack.rules.push({id: 'reviewed-administration', invocation: 'git', command_set: 'reviewed-administration',
    conditions: {domain: 'argv', executable: 'git', arguments: {kind: 'any'}}, decision: privileged,
    reason: 'Review repository maintenance, helpers and credential administration.'});
  for (const [id, prefix, tokens, decision] of [
    ['credential-disclosure', [{one_of: ['credential', 'credential-store', 'credential-cache']}], ['fill', 'get'], deny],
    ['forced-worktree-removal', ['worktree', 'remove'], ['--force', '-f'], destructive],
    ['forced-submodule-deinit', ['submodule', 'deinit'], ['--force', '-f'], destructive],
    ['forced-checkout-index', ['checkout-index'], ['--force', '-f'], destructive],
    ['reset-read-tree', ['read-tree'], ['--reset', '-u'], destructive],
    ['delete-ref', ['update-ref'], ['-d'], destructive],
    ['replace-ref-destruction', ['replace'], ['--delete', '-d', '--force', '-f'], destructive],
    ['reflog-destruction', ['reflog'], ['delete', 'drop', 'expire'], destructive],
  ]) pack.rules.push({id, invocation: 'git', conditions: {domain: 'argv', executable: 'git',
    arguments: {kind: 'risk_tokens', prefix, any_of: tokens}}, decision,
  reason: id === 'credential-disclosure' ? 'Returns stored credentials into agent-visible output.' : 'May discard uncommitted work.'});
  return pack;
}

function node(pack) {
  for (const rule of pack.rules) {
    const old = rule.decision;
    if (old?.strict !== 'deny') continue;
    const unknown = /unlisted/.test(rule.id);
    if (unknown) change(rule, review, 'Unlisted syntax requires review, not an automatic refusal.');
    else if (old.loose === 'allow') change(rule, {...old, strict: 'ask'}, 'Review dependency changes in Strict; supported local installs remain usable.');
    else if (/global|host-configuration|credentials-config|publication|tag-mutation/.test(rule.id))
      change(rule, privileged, 'Review host installation, registry configuration, authentication or publication.');
    else change(rule, review, 'Review package execution, inline code or configuration overrides.');
  }
  // A credential/configuration family is not itself credential disclosure.
  // Only explicit reads of secret settings receive Deny.
  const setting = {regex: '(?i).*(?:_auth|token|password|secret).*'};
  const npm = pack.rules.find(rule => rule.id === 'npm-credentials-config');
  for (const [id, executable, route] of [
    ['npm', npm.conditions.executable, []],
    ['corepack-npm', pack.rules.find(rule => rule.id === 'corepack-npm-npm-credentials-config').conditions.executable, ['npm']],
    ['manager', pack.rules.find(rule => rule.id === 'manager-credentials-config').conditions.executable, []],
    ...['pnpm', 'yarn', 'yarnpkg'].map(name => [`corepack-${name}`, {one_of: ['corepack', '/bin/corepack', '/usr/bin/corepack', '/usr/local/bin/corepack', '/opt/homebrew/bin/corepack']}, [name]]),
  ]) for (const words of [['config', 'get', setting], ['get', setting]]) pack.rules.push({
    id: `secret-${id}-${words.length}`, conditions: {domain: 'argv', executable,
      arguments: {kind: 'prefix', leading: npm.conditions.arguments.leading, values: [...route, ...words]}},
    decision: deny, reason: 'Explicitly requests a credential-bearing configuration setting.'});
  const leading = structuredClone(npm.conditions.arguments.leading);
  leading.interleaved = true;
  leading.flags.push('--recursive', '-r');
  leading.values.push('--dir', '-C', '--cwd', '--filter', '-F');
  for (const rule of [...pack.rules]) {
    if (rule.conditions.arguments?.kind !== 'risk_tokens'
      || !/global|manager-credentials-config/.test(rule.id)) continue;
    for (const words of [['config', 'get', setting], ['get', setting]]) pack.rules.push({
      id: `disclosure-${rule.id}-${words.length}`, conditions: structuredClone(rule.conditions),
      requirements: {arguments: {kind: 'prefix', leading,
        values: [...rule.conditions.arguments.prefix, ...words]}},
      on_unmet: {decision: 'ask', message: 'Review configuration or global operations; only explicit secret reads are denied.'},
      decision: deny, reason: 'A credential-bearing configuration read, including manager/global options.'});
  }
  pack.capabilities.push('interleaved-leading-v1', 'requirements-v1');
  return pack;
}

function rust(pack) {
  for (const rule of pack.rules) {
    const old = rule.decision;
    if (old?.strict !== 'deny') continue;
    if (old.loose === 'allow') change(rule, {...old, strict: 'ask'}, 'Review dependency changes in Strict.');
    else if (/authentication|credentials/.test(rule.id))
      change(rule, privileged, 'Review registry selection, authentication and credential-provider configuration.');
    else if (/cargo-install(?:-target-file)?$/.test(rule.id))
      change(rule, privileged, 'Review executable installation or removal.');
    else change(rule, review, 'Review cleanup, execution overrides, plugins or unlisted syntax.');
  }
  return pack;
}

function aws(pack) {
  for (const rule of pack.rules) {
    const id = rule.id;
    if (/^secret-|^configure-(?:get-secret|export-credentials)|^ssm-decryption$|^apigateway-key-values$/.test(id)) continue;
    if (/^verb-destroy|^s3-(?:mv|rm-rb|sync-delete)/.test(id))
      change(rule, destructive, 'Review destructive remote changes; Strict refuses them.');
    else if (/^access-|^verb-access|^s3-presign|^mcp-presigned-url|^deploy-host-agent/.test(id))
      change(rule, privileged, 'Review access grants, policy changes and host administration.');
    else if (/^data-|^mcp-task-results$|^verb-(?:change|execute)$|^(?:execute|change)-|^(?:configure-(?:interactive|change|mfa-login)|sso-session|login-session|eks-update-kubeconfig|cloudformation-|deploy-push|ddb-|s3-mb-website)/.test(id))
      change(rule, privileged, 'Review account data, remote changes, execution or local configuration.');
    else if (rule.decision?.strict === 'deny')
      change(rule, review, 'Review local output paths, scripts, transport overrides or unclassified operations.');
    else if (rule.decision?.strict === 'ask' && rule.decision?.recommended === 'allow')
      change(rule, allow, 'Inspect metadata or use the explicitly configured local emulator.');
  }
  const keyDeletion = structuredClone(pack.rules.find(rule => rule.id === 'access-kms'));
  keyDeletion.id = 'kms-scheduled-key-deletion';
  keyDeletion.conditions.arguments.values = ['kms', 'schedule-key-deletion'];
  change(keyDeletion, destructive, 'Schedule destruction of a KMS key; review it explicitly and refuse in Strict.');
  pack.rules.push(keyDeletion);
  return pack;
}

const toolProfiles = {inspect: allow, routine: profiles('allow', 'allow', 'ask'), device: profiles('allow', 'allow', 'ask'),
  change: privileged, exposure: privileged, remote: privileged, integration: privileged, agent: privileged,
  execute: review, destroy: destructive, credential: privileged, secret: deny,
  stream: review, folder: review, rewrite: review, unlisted: review};

export async function reviewedPacks() {
  const packs = [];
  for (const [name, transform] of Object.entries({baseline, git, node, rust, aws})) {
    const pack = transform(await source(name, revisions[name][0]));
    for (const rule of pack.rules) {
      if (rule.conditions.arguments?.kind === 'risk_tokens'
        && Object.values(rule.decision).includes('allow'))
        change(rule, review, 'A conservative token scan requires review; it cannot establish an allowance.');
    }
    pack.version = revisions[name][1];
    packs.push(pack);
  }
  for (const original of [gate, box, testrun]) {
    const tool = structuredClone(original);
    tool.version = revisions[tool.name][1];
    tool.profileDecisions = toolProfiles;
    tool.activeProjectAdjustments = true;
    if (tool.name === 'box') tool.commands.find(([words]) => words.join(' ') === 'mcp auth headers')[1] = 'secret';
    if (tool.name === 'gate') tool.commands.find(([words]) => words.join(' ') === 'fetch')[1] = 'inspect';
    if (tool.name === 'gate') tool.mcpTools.fetch[0] = 'inspect';
    packs.push(toolPack(tool));
  }
  for (const pack of packs) pack.engines.shield = '>=0.20.0, <1.0.0';
  return packs;
}

export async function buildReviewedProfiles() {
  for (const pack of await reviewedPacks()) {
    const name = pack.id.split('/')[1];
    const directory = new URL(`../packs/${pack.id}/${pack.version}/`, import.meta.url);
    const previous = new URL(`../packs/${pack.id}/${revisions[name][0]}/`, import.meta.url);
    await mkdir(directory, {recursive: true});
    await writeFile(new URL('pack.yml', directory), JSON.stringify(pack, null, name === 'rust' ? undefined : 2) + '\n');
    const inventory = JSON.parse(await readFile(new URL('commands.json', previous)));
    for (const command of inventory.commands) {
      for (const rule of pack.rules) {
        const executable = rule.conditions.executable;
        if (rule.conditions.domain === 'argv' && (executable === command.name || executable?.one_of?.includes(command.name))
          && !command.rule_ids.includes(rule.id)) command.rule_ids.push(rule.id);
      }
    }
    await writeFile(new URL('commands.json', directory), JSON.stringify(inventory, null, 2) + '\n');
    await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', directory));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildReviewedProfiles();

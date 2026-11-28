// Git 0.11.0 allows everyday use by default and reviews known-harmful forms.
// 0.10.0 asked for every local command or option its grammars did not list, and
// for every network command, so routine work such as `git ls-remote --heads
// origin <branch>` or a new display option needed approval. This revision:
//
// - allows unlisted local commands and options in Loose and Recommended;
// - allows network reads (fetch, pull, ls-remote, clone, remote show/update,
//   submodule update/add/sync) and rebase in Recommended; push keeps asking;
// - adds explicit reviews for what the catch-all used to catch by accident:
//   programs run through options or configuration, reads and writes outside the
//   repository, interactive or executing rebases and forced fetch refspecs;
// - makes the existing destructive-option checks match short-option clusters
//   (`rm -rf`) and `--option=value` spellings (`--force-with-lease=main`).
//
// Destructive operations keep their 0.10.0 decisions and Strict keeps asking
// for anything it does not list.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gitOutputCases} from './git-output-cases.mjs';
import {gitRepositoryPathCases, gitTreeRepositoryPathCases} from './git-repository-path-cases.mjs';

export const revision = ['0.10.0', '0.11.0'];
export const outputRevision = '0.12.0';
export const editorRevision = '0.12.1';
export const repositoryPathRevision = '0.12.2';
export const treeRepositoryPathRevision = '0.12.3';
const split = value => value.split(' ');
const everyday = {loose: 'allow', recommended: 'allow', strict: 'ask'};
const always = {loose: 'ask', recommended: 'ask', strict: 'ask'};
const dataLoss = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const git = {domain: 'argv', executable: 'git'};

// Network commands that download without publishing anything.
export const networkRead = split('fetch pull ls-remote clone fetch-pack backfill');
// 0.10.0 rules whose Recommended decision moves from Ask to Allow.
export const relaxed = split('network-remote-show network-remote-update network-submodule-update network-submodule-add network-submodule-sync base-rebase');

const one = names => ({one_of: names});
const tokens = (id, prefix, anyOf, decision, reason) => ({
  id, conditions: {...git, arguments: {kind: 'risk_tokens', prefix, any_of: anyOf}}, reason, decision, invocation: 'git'});
const command = (id, values, decision, reason) => ({
  id, conditions: {...git, arguments: {kind: 'prefix', values}}, reason, decision, invocation: 'git'});
const option = name => [name, {prefix: `${name}=`}];

const diffFamily = split('log show diff diff-tree diff-index diff-files range-diff whatchanged stash format-patch cat-file');
const remoteFamily = split('fetch pull ls-remote clone fetch-pack archive push send-pack');
// Configuration keys whose values Git runs as programs, loads as more
// configuration, or use to redirect or authenticate remote access.
const executingKeys = [
  'alias\\..+', 'include\\..+', 'includeif\\..+', 'sequence\\.editor', 'diff\\.external',
  'core\\.(?:hookspath|sshcommand|pager|editor|fsmonitor|gitproxy|askpass|worktree|attributesfile)',
  '(?:uploadpack|receivepack|protocol|credential|url|gpg|filter|pager|http|browser|instaweb)\\..+',
  'safe\\.directory', 'interactive\\.difffilter', 'web\\.browser',
  '.+\\.(?:command|cmd|driver|program|textconv|clean|smudge|process|helper|uploadpack|receivepack|proxy)',
].join('|');

export const addedRules = [
  {id: 'network-read', conditions: {...git, arguments: {kind: 'any'}},
    reason: 'Download from a remote without publishing; Strict reviews remote access.',
    decision: everyday, invocation: 'git', command_set: 'network-read'},
  tokens('remote-program', [one(remoteFamily)],
    ['--upload-pack', '--receive-pack', '--exec'].map(name => ({prefix: name})), always,
    'Review options that run a program for the remote side of a transfer.'),
  tokens('repository-template-or-configuration', [one(split('clone init'))],
    ['-u', '-c', {prefix: '--template'}, {prefix: '--config'}], always,
    'Review templates and configuration that can install hooks or commands in a new repository.'),
  tokens('external-diff-program', [one(diffFamily)], [...option('--ext-diff'), ...option('--textconv')], always,
    'Review diff options that run configured external programs.'),
  tokens('grep-pager', [one(['grep'])], ['-O', {prefix: '--open-files-in-pager'}], always,
    'Review grep options that open results in another program.'),
  tokens('outside-repository-read', [one(split('diff grep blame annotate'))], ['--no-index', {prefix: '--contents'}], always,
    'Review reads of files outside the repository.'),
  tokens('file-output', [one(diffFamily)], option('--output'), always,
    'Review output written to an arbitrary file.'),
  tokens('archive-output', [one(['archive'])], ['-o', {prefix: '--output'}], always,
    'Review archives written to an arbitrary file.'),
  tokens('configuration-execution', ['config'], [{regex: `(?i)(?:${executingKeys})(?:=.*)?`}], always,
    'Review configuration keys that run programs, load configuration or redirect remote access.'),
  tokens('rebase-execution', ['rebase'],
    [{regex: '-[A-Za-z0-9]*[xis][A-Za-z0-9]*'}, ...option('--exec'), '--interactive', ...option('--strategy')], always,
    'Review rebases that run commands, open an editor or use an external merge strategy.'),
  tokens('external-strategy-pull', ['pull'], [{regex: '-[A-Za-z0-9]*s[A-Za-z0-9]*'}, ...option('--strategy')], always,
    'Review pulls that use an external merge strategy.'),
  tokens('forced-fetch', [one(split('fetch pull'))],
    [...option('--force'), {regex: '-[A-Za-z0-9]*f[A-Za-z0-9]*'}, {regex: '\\+.+:.+'}], dataLoss,
    'Review fetches that can overwrite local branches.'),
  tokens('forced-submodule-update', ['submodule', 'update'], [...option('--force'), {regex: '-[A-Za-z0-9]*f[A-Za-z0-9]*'}], dataLoss,
    'Review submodule updates that discard local changes.'),
  command('bisect-run', ['bisect', 'run'], always, 'Review bisect runs, which execute a command at each step.'),
  command('git-shell', ['shell'], always, 'Review the restricted login shell, which runs commands.'),
];

// Destructive-option checks see `-rf` and `--force-with-lease=main` as the
// options they contain. Option values that happen to contain the letter can
// also ask; that errs toward review.
function harden(token) {
  if (typeof token !== 'string') return [token];
  if (/^--[A-Za-z0-9-]+$/.test(token)) return option(token);
  if (/^-[A-Za-z0-9]$/.test(token)) return [{regex: `-[A-Za-z0-9]*${token[1]}[A-Za-z0-9]*`}];
  return [token];
}

export async function gitAllowByDefaultPack() {
  const pack = JSON.parse(await readFile(new URL(`../packs/canonic/git/${revision[0]}/pack.yml`, import.meta.url)));
  const rule = id => pack.rules.find(entry => entry.id === id);
  rule('baseline-0').decision = {...everyday};
  for (const id of relaxed) rule(id).decision.recommended = 'allow';
  const network = pack.command_sets['baseline-1'];
  pack.command_sets['network-read'] = Object.fromEntries(networkRead.map(name => [name, `net-${name}`]));
  for (const name of networkRead) delete network[name];
  for (const entry of pack.rules)
    if (entry.conditions.arguments?.kind === 'risk_tokens')
      entry.conditions.arguments.any_of = entry.conditions.arguments.any_of.flatMap(harden);
  const after = pack.rules.findIndex(entry => entry.id === 'baseline-3');
  pack.rules.splice(after + 1, 0, structuredClone(addedRules[0]));
  pack.rules.push(...structuredClone(addedRules.slice(1)));
  pack.version = revision[1];
  return pack;
}

const allowed = ['allow', 'allow', 'ask'];
const reviewed = ['ask', 'ask', 'ask'];
const lossy = ['ask', 'ask', 'deny'];
const pushed = ['allow', 'ask', 'ask'];

// 0.10.0 fixtures whose expectation changes, with the reason. Every other
// earlier fixture keeps its expectation.
export const changed = {
  // Unlisted options of read-only commands are routine.
  'inspection-show-unknown-loose': 'allow',
  'inspection-show-unknown-recommended': 'allow',
  'merge-tree-unknown-option-loose': 'allow',
  'merge-tree-unknown-option-recommended': 'allow',
  'merge-tree-stdin-loose': 'allow',
  'merge-tree-stdin-recommended': 'allow',
  'merge-tree-stdin-nul-loose': 'allow',
  'merge-tree-stdin-nul-recommended': 'allow',
  'merge-tree-write-tree-command-loose': 'allow',
  'merge-tree-write-tree-command-recommended': 'allow',
  // Network reads, rebase and submodule updates are everyday work in Recommended.
  'fetch-recommended': 'allow',
  'rebase-recommended': 'allow',
  'submodule-init-recommended': 'allow',
};

const added = [
  // Everyday local work that 0.10.0 asked for.
  ['commit-trailer', 'commit --trailer Acked-by:Acme -m fix', allowed],
  ['log-new-option', 'log --some-future-option', allowed],
  ['worktree-add', 'worktree add ../acme-feature feature', allowed],
  ['config-user', 'config user.name Acme', allowed],
  ['config-global-user', 'config --global user.email dev@example.com', allowed],
  // Read-only configuration forms are allowed in every profile.
  ['config-list', 'config --list', ['allow', 'allow', 'allow']],
  ['config-read-remote', 'config --get remote.origin.url', ['allow', 'allow', 'allow']],
  ['config-read-aliases', 'config --get-regexp alias', ['allow', 'allow', 'allow']],
  ['bisect-start', 'bisect start', allowed],
  ['archive-stdout', 'archive HEAD', allowed],
  ['format-patch-directory', 'format-patch -o patches main', allowed],
  ['rebase', 'rebase origin/main', allowed],
  ['rebase-continue', 'rebase --continue', allowed],
  ['merge-no-ff', 'merge --no-ff feature', allowed],
  // Network reads.
  ['fetch', 'fetch origin', allowed],
  ['fetch-prune', 'fetch --prune origin', allowed],
  ['fetch-branch', 'fetch origin main', allowed],
  ['pull-rebase', 'pull --rebase origin main', allowed],
  ['clone', 'clone https://example.com/acme/repo.git', allowed],
  ['remote-show', 'remote show origin', allowed],
  ['remote-update', 'remote update', allowed],
  ['submodule-update', 'submodule update --init --recursive', allowed],
  ['submodule-update-remote', 'submodule update --remote', allowed],
  ['ls-remote-branch', 'ls-remote --heads origin feature-x', allowed],
  ['ls-remote-combined-worktree', '-C .gate/repos/public ls-remote --heads origin Fix-PR-Skill-Without-Local-Tools', allowed],
  ['ls-remote-no-pager', '--no-pager ls-remote origin', allowed],
  ['ls-remote-default', 'ls-remote', allowed],
  ['ls-remote-tags', 'ls-remote -t --refs origin', allowed],
  ['ls-remote-symref', 'ls-remote --symref origin HEAD', allowed],
  ['ls-remote-sort', 'ls-remote --sort=-v:refname --tags origin', allowed],
  ['ls-remote-url', 'ls-remote https://example.com/acme/repo.git', allowed],
  ['ls-remote-server-option', 'ls-remote -o trace origin', allowed],
  // Publishing keeps asking in Recommended.
  ['push', 'push origin feature-x', pushed],
  ['push-upstream', 'push -u origin feature-x', pushed],
  // Programs run through options or configuration.
  ['ls-remote-upload-pack', 'ls-remote --upload-pack=/tmp/helper origin', reviewed],
  ['ls-remote-upload-pack-separate', 'ls-remote --upload-pack /tmp/helper origin', reviewed],
  ['ls-remote-upload-pack-after-remote', 'ls-remote origin --upload-pack=/tmp/helper', reviewed],
  ['ls-remote-exec', 'ls-remote --exec=/tmp/helper origin', reviewed],
  ['fetch-upload-pack', 'fetch --upload-pack=/tmp/helper origin', reviewed],
  ['push-receive-pack', 'push --receive-pack=/tmp/helper origin main', reviewed],
  ['archive-exec', 'archive --remote=origin --exec=/tmp/helper HEAD', reviewed],
  ['clone-upload-pack', 'clone -u /tmp/helper https://example.com/acme/repo.git', reviewed],
  ['clone-template', 'clone --template=/tmp/template https://example.com/acme/repo.git', reviewed],
  ['clone-config', 'clone -c core.hooksPath=/tmp/hooks https://example.com/acme/repo.git', reviewed],
  ['clone-config-long', 'clone --config=core.sshCommand=helper https://example.com/acme/repo.git', reviewed],
  ['init-template', 'init --template=/tmp/template', reviewed],
  ['log-ext-diff', 'log -p --ext-diff', reviewed],
  ['show-textconv', 'show --textconv HEAD:README.md', reviewed],
  ['grep-pager-long', 'grep --open-files-in-pager=less Acme', reviewed],
  ['config-alias', 'config alias.st status', reviewed],
  ['config-ssh-command', 'config core.sshCommand helper', reviewed],
  ['config-hooks-path', 'config core.hooksPath /tmp/hooks', reviewed],
  ['config-include', 'config --add include.path /tmp/acme.inc', reviewed],
  ['config-credential-helper', 'config set credential.helper store', reviewed],
  ['config-url-rewrite', 'config url.https://example.com/.insteadOf origin', reviewed],
  ['config-filter', 'config filter.acme.clean helper', reviewed],
  // The key check cannot tell a read from a write, so reading these keys asks.
  ['config-read-hooks', 'config --get core.hooksPath', reviewed],
  ['rebase-exec-short', 'rebase -x make origin/main', reviewed],
  ['rebase-exec-long', 'rebase --exec=make origin/main', reviewed],
  ['rebase-interactive', 'rebase -i HEAD~3', reviewed],
  ['rebase-strategy', 'rebase -s ours main', reviewed],
  ['pull-strategy', 'pull -s ours origin main', reviewed],
  ['pull-strategy-equals', 'pull --strategy=ours origin main', reviewed],
  ['merge-strategy-equals', 'merge --strategy=octopus a b', reviewed],
  ['merge-strategy-attached', 'merge -sours feature', reviewed],
  ['bisect-run', 'bisect run make test', reviewed],
  ['shell', 'shell -c ls', reviewed],
  // Reads and writes outside the repository.
  ['grep-no-index', 'grep --no-index secret /tmp/acme', reviewed],
  ['blame-contents', 'blame --contents /tmp/acme README.md', reviewed],
  ['log-output', 'log --output=/tmp/acme.log', reviewed],
  ['archive-output-short', 'archive -o /tmp/acme.tar HEAD', reviewed],
  ['archive-output-long', 'archive --output=/tmp/acme.tar HEAD', reviewed],
  // Git options before the subcommand match no form.
  ['config-option', '-c core.pager=helper log', reviewed],
  ['git-dir', '--git-dir=/tmp/acme log', reviewed],
  // Destructive forms keep their decisions, including clusters and attached values.
  ['rm-cluster', 'rm -rf build', lossy],
  ['branch-cluster', 'branch -Df feature', lossy],
  ['checkout-cluster', 'checkout -qf main', lossy],
  ['push-lease-equals', 'push --force-with-lease=main origin main', lossy],
  ['commit-hook-bypass-cluster', 'commit -an -m fix', reviewed],
  ['fetch-force', 'fetch -f origin main:main', lossy],
  ['fetch-forced-refspec', 'fetch origin +main:main', lossy],
  ['submodule-update-force', 'submodule update --force', lossy],
  ['reset-hard', 'reset --hard HEAD~1', lossy],
  ['clean', 'clean -fd', lossy],
];

export async function gitAllowByDefaultCases() {
  const {cases} = JSON.parse(await readFile(new URL(`../packs/canonic/git/${revision[0]}/cases.json`, import.meta.url)));
  const next = cases.map(row => row.name in changed ? {...row, expected: changed[row.name]} : row);
  for (const [name, text, decisions] of added)
    ['loose', 'recommended', 'strict'].forEach((profile, index) => next.push({
      name: `everyday-${name}-${profile}`, profile, argv: ['git', ...split(text)], expected: decisions[index]}));
  return next;
}

const readme = `# Git permissions ${revision[1]}

Requires Shield \`>=0.20.0, <1.0.0\`.

Command coverage follows [${revision[0]}](../${revision[0]}/README.md). This release
allows everyday Git use by default and reviews the forms that can cause harm.

## What changes

- **Local commands and options:** Loose and Recommended allow commands and options
  the pack does not list, such as \`commit --trailer\` or a new \`log\` display option.
  Strict still asks for anything it does not list.
- **Network reads:** Recommended allows \`fetch\`, \`pull\`, \`ls-remote\`, \`clone\`,
  \`remote show\`, \`remote update\` and \`submodule update\`/\`add\`/\`sync\`, including
  for URLs. Strict asks.
- **Rebase:** Recommended allows \`rebase\`; \`-i\`, \`-x\`/\`--exec\` and \`-s\`/\`--strategy\` ask.

## What still asks

In every profile:

- Options that run a program for a transfer: \`--upload-pack\`, \`--receive-pack\`,
  \`--exec\`, and \`clone -u\`.
- \`clone\`/\`init\` with \`--template\`, \`-c\` or \`--config\`.
- \`--ext-diff\`, \`--textconv\` and \`grep -O\`/\`--open-files-in-pager\`.
- \`git config\` keys that run programs, load configuration or redirect remote
  access, such as \`alias.*\`, \`core.sshCommand\`, \`core.hooksPath\`, \`include.path\`,
  \`credential.helper\`, \`url.*.insteadOf\` and \`filter.*\`. Ordinary keys such as
  \`user.name\` are allowed. Reading one of these keys, as in
  \`git config --get core.hooksPath\`, also asks; \`git config --list\` does not.
- \`diff\`/\`grep --no-index\`, \`blame --contents\`, \`--output\` and \`archive -o\`.
- \`pull\`/\`merge\`/\`cherry-pick\`/\`revert\` with an external merge strategy, \`bisect run\`
  and \`git shell\`.
- Git options before the subcommand other than \`-C\`, \`--no-pager\` and \`-P\`, such as
  \`-c\` and \`--git-dir\`.

In Recommended, as in ${revision[0]}: \`push\`; destructive operations such as
\`reset --hard\`, \`clean\`, forced checkout, switch, branch, tag, \`rm\` and \`mv\`, stash drops,
ref and reflog deletion; forced fetch refspecs and \`submodule update --force\`; history
rewrites such as \`commit --amend\`; and administration commands. Strict refuses the
destructive operations.

Destructive-option checks match short-option clusters such as \`rm -rf\` and
\`--option=value\` spellings such as \`--force-with-lease=main\`.

## Limits

The pack matches arguments, not repository state. It cannot tell whether a remote
name is configured, what a hook does or whether a path leaves the project. Changing
remotes or executing configuration asks, so a remote cannot be redirected silently.
Environment variables such as \`GIT_SSH_COMMAND\` need host enforcement.

Generate with \`node scripts/build-git-allow-by-default.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/git-allow-by-default.test.mjs\`.
`;

export async function gitScopedOutputPack() {
  const pack = await gitAllowByDefaultPack();
  pack.version = outputRevision;
  pack.capabilities.push('access-paths-v1', 'location-v1', 'preconditions-v1');
  pack.capabilities.sort();
  const rule = pack.rules.find(rule => rule.id === 'file-output');
  const modeled = split('log show diff diff-tree diff-index whatchanged');
  rule.conditions.arguments.prefix = [one(diffFamily.filter(name => !modeled.includes(name)))];
  const targets = {action: 'write', all: {
    within: {root: 'write'},
    exclude: ['.git', '.gate', '.shield', '.config/shield'].map(path => ({root: 'write', path})),
  }};
  pack.preconditions = outputScopes(pack, targets);
  return pack;
}

// Preconditions do not follow shared invocation routing, so the output scope
// gate is repeated for every leading form the invocation group declares.
function outputScopes(pack, targets) {
  const modeled = split('log show diff diff-tree diff-index whatchanged');
  const forms = pack.invocations.git.segments.reduce(
    (prefixes, segment) => prefixes.flatMap(prefix => segment.map(part => [...prefix, ...part])), [[]]);
  return forms.map((prefix, index) => ({
    id: `file-output-scope-${index}`,
    conditions: {...git, arguments: {kind: 'risk_tokens', prefix: [...prefix, one(modeled)], any_of: option('--output')}},
    requires_any: [{targets}],
    on_unmet: {decision: 'ask', message: 'Use a verified writable destination for Git output or ask for approval.'},
  }));
}

// 0.12.1: `-c core.editor=true` is the usual way to skip the editor in
// `rebase --continue` and commits. `:` makes Git skip the editor and `true`
// resolves through PATH like any configured editor, so these exact settings
// add no effect of their own and take the decision of the command they
// precede. Any other value, key or second `-c` still matches no form and asks.
export const noopEditors = ['core.editor=true', 'core.editor=:', 'sequence.editor=true', 'sequence.editor=:'];
export async function gitNoopEditorPack() {
  const pack = await gitScopedOutputPack();
  pack.version = editorRevision;
  pack.invocations.git.segments.push([[], ...noopEditors.map(setting => ['-c', setting])]);
  pack.preconditions = outputScopes(pack, pack.preconditions[0].requires_any[0].targets);
  return pack;
}

const allowedRow = ['allow', 'allow', 'ask'];
// Observed 2026-11-19: `git -C .gate/repos/public -c core.editor=true rebase --continue`
// asked under 0.12.0 because no form matched the leading `-c`.
export const editorCases = [
  ['rebase-continue', ['-c', 'core.editor=true', 'rebase', '--continue'], allowedRow],
  ['rebase-continue-colon', ['-c', 'core.editor=:', 'rebase', '--continue'], allowedRow],
  ['rebase-continue-sequence', ['-c', 'sequence.editor=true', 'rebase', '--continue'], allowedRow],
  ['rebase-continue-pager', ['--no-pager', '-c', 'sequence.editor=:', 'rebase', '--continue'], allowedRow],
  ['rebase-upstream', ['-c', 'core.editor=true', 'rebase', 'origin/main'], allowedRow],
  // The command after the setting keeps its own review or refusal. Shield
  // releases before the no-op editor output model cannot verify an inside
  // destination after the setting either, so only refusals are fixed here.
  ['rebase-interactive', ['-c', 'core.editor=true', 'rebase', '-i', 'HEAD~3'], reviewed],
  ['rebase-exec', ['-c', 'sequence.editor=:', 'rebase', '-x', 'make', 'origin/main'], reviewed],
  ['reset-hard', ['-c', 'core.editor=true', 'reset', '--hard', 'HEAD~1'], lossy],
  ['push', ['-c', 'core.editor=true', 'push', 'origin', 'feature-x'], pushed],
  ['output-outside', ['-c', 'core.editor=true', 'diff', '--output', '../review.diff'], reviewed],
  ['output-policy', ['-c', 'core.editor=true', 'show', '--output', '.shield/config.yml'], reviewed],
  // Editors that run a program, other spellings and other settings ask.
  ['editor-program', ['-c', 'core.editor=vim', 'rebase', '--continue'], reviewed],
  ['editor-script', ['-c', 'core.editor=true; sh acme.sh', 'rebase', '--continue'], reviewed],
  ['editor-uppercase-value', ['-c', 'core.editor=TRUE', 'rebase', '--continue'], reviewed],
  ['editor-attached', ['-ccore.editor=true', 'rebase', '--continue'], reviewed],
  ['editor-config-env', ['--config-env=core.editor=EDITOR', 'rebase', '--continue'], reviewed],
  ['editor-then-pager', ['-c', 'core.editor=true', '-c', 'core.pager=helper', 'log'], reviewed],
  ['pager-setting', ['-c', 'core.pager=helper', 'log'], reviewed],
];

export function gitNoopEditorCases() {
  return [...gitOutputCases(), ...editorCases.flatMap(([name, argv, decisions]) =>
    ['loose', 'recommended', 'strict'].map((profile, index) => ({
      name: `noop-editor-${name}-${profile}`, profile, argv: ['git', ...argv], expected: decisions[index]})))];
}

function repositoryPathRules(command, reason, {forbid, ...options}) {
  const selectors = ['--git-dir', '--work-tree'];
  const grammar = {
    kind: 'options', prefix: [command],
    leading: {flags: ['--no-pager', '-P'], short_clusters: false,
      values: selectors.map(name => ({name, repeat: 'forbid', match: {regex: '[^-\\x00\\r\\n][^\\x00\\r\\n]*'}}))},
    ...options,
    operands: true, unknown_options: 'skip', long_abbreviations: true,
    require_any: selectors, ...(forbid && {forbid}),
  };
  const path = {within: {root: 'project'},
    exclude: ['.shield', '.config/shield', '.codex', '.claude', '.aws', '.ssh', '.env']
      .map(path => ({root: 'project', path}))};
  return [{
    id: `${command}-repository-paths`, decision: everyday, reason,
    conditions: {...git, cwd: {within: {root: 'project'}}, arguments: grammar},
    requirements: {argument_paths: {grammar,
      options: Object.fromEntries(selectors.map(name => [name, {path}]))}},
    on_unmet: {decision: 'ask', message: 'Use repository paths inside the project or ask for approval.'},
  }, {
    id: `${command}-gitfile`, decision: always,
    reason: 'Review a Git directory selector that names a file, which can point to another repository.',
    conditions: {...git, cwd: {within: {root: 'project'}}, arguments: grammar,
      argument_paths: {grammar: {...grammar, require_all: ['--git-dir']},
        options: {'--git-dir': {path, kind: 'file'}}}},
  }];
}

export async function gitRepositoryPathPack() {
  const pack = await gitNoopEditorPack();
  pack.version = repositoryPathRevision;
  pack.engines.shield = '>=0.58.0, <1.0.0';
  pack.capabilities = [...new Set([...pack.capabilities, 'argument-paths-v1',
    'argument-path-file-kind-v1', 'requirements-v1', 'unknown-options-v1',
    'option-abbreviations-v1'])].sort();
  pack.rules.push(...repositoryPathRules('log',
    'Inspect Git history with explicit repository paths inside the project.', {
      flags: ['--ext-diff', '--textconv'], values: ['--output'],
      forbid: ['--ext-diff', '--textconv', '--output'],
    }));
  return pack;
}

export function gitRepositoryPathFixtureCases() {
  return [...gitNoopEditorCases(), ...gitRepositoryPathCases()];
}

export async function gitTreeRepositoryPathPack() {
  const pack = await gitRepositoryPathPack();
  pack.version = treeRepositoryPathRevision;
  pack.rules.push(...repositoryPathRules('ls-tree',
    'List entries in a Git tree with explicit repository paths inside the project.', {
      flags: ['-d', '-r', '-t', '-z', '-l', '--long', '--name-only', '--name-status',
        '--object-only', '--full-name', '--full-tree'],
      values: ['--format'], optional_values: ['--abbrev'],
    }));
  return pack;
}

export function gitTreeRepositoryPathFixtureCases() {
  return [...gitRepositoryPathFixtureCases(), ...gitTreeRepositoryPathCases()];
}

const outputReadme = `# Git permissions ${outputRevision}

Requires Shield \`>=0.20.0, <1.0.0\`.

Command coverage and other decisions follow [${revision[1]}](../${revision[1]}/README.md).

With Git output target support in Shield, Loose and Recommended allow
\`--output\` on \`diff\`, \`show\`, \`log\`, \`diff-tree\`, \`diff-index\` and
\`whatchanged\` when all destinations are within the writable scope. In native
agent integrations this includes verified system temporary directories.
Git, Gate and Shield metadata directories are excluded. An unverified or
excluded destination asks in every profile. Strict reviews file output, as
do older clients without the target model. Archive output and other output
modes follow the existing review rules.

Generate with \`node scripts/build-git-allow-by-default.mjs ${outputRevision}\`.
Validate with \`npm test -- --shield /absolute/path/to/shield scripts/git-scoped-output.test.mjs\`.
`;

const editorReadme = `# Git permissions ${editorRevision}

Requires Shield \`>=0.20.0, <1.0.0\`.

Command coverage and other decisions follow [${outputRevision}](../${outputRevision}/README.md).

A leading \`-c core.editor=true\`, \`-c core.editor=:\`, \`-c sequence.editor=true\` or
\`-c sequence.editor=:\` is the usual way to skip an editor, as in
\`git -c core.editor=true rebase --continue\`. These settings add no effect of
their own, so the command takes the decision it has without the setting. They
do not guarantee that no editor runs: \`GIT_EDITOR\` takes precedence, and
\`sequence.editor\` covers only the rebase todo list. Recommended allows
\`rebase --continue\`, \`rebase -i\` still asks and \`reset --hard\` still asks.
It may follow \`--no-pager\` or \`-P\`. Output destinations keep their writable-scope
check after the setting; Shield versions that cannot read past the setting to
verify a destination ask.

Any other value, such as \`-c core.editor=vim\`, another key, an attached
\`-ccore.editor=true\`, \`--config-env\` or a second \`-c\` matches no form and asks
in every profile, because those settings can run programs or change what Git reads.

Generate with \`node scripts/build-git-allow-by-default.mjs ${editorRevision}\`.
Validate with \`npm test -- --shield /absolute/path/to/shield scripts/git-noop-editor.test.mjs\`.
`;

const repositoryPathReadme = `# Git permissions ${repositoryPathRevision}

Requires Shield \`>=0.58.0, <1.0.0\`.

Loose and Recommended allow \`git --git-dir=.git --work-tree=. log --oneline\`
when the working directory and both explicit paths resolve inside the project.
Either selector works alone. Both accept a separate value or an equals sign.
An initial \`-C\` changes the base for relative paths. Strict reviews explicit
repository selection.

Outside or protected paths, Git directory pointers, repeated selectors, file
output, external diff and text conversion options require review. The path
check covers the submitted selectors. Git still loads the selected repository's
configuration and object storage as usual.

Other commands follow [${editorRevision}](../${editorRevision}/README.md).

Generate with \`node scripts/build-git-allow-by-default.mjs ${repositoryPathRevision}\`.
Validate with \`npm test -- --shield /absolute/path/to/shield scripts/git-repository-paths.test.mjs\`.
`;

const treeRepositoryPathReadme = `# Git permissions ${treeRepositoryPathRevision}

Requires Shield \`>=0.58.0, <1.0.0\`.

Loose and Recommended allow \`git ls-tree\` with explicit repository selectors
when the working directory and the supplied \`--git-dir\` and \`--work-tree\`
paths resolve inside the project. This includes listing tracked migration
filenames from a local remote-tracking ref in a Gate checkout:

\`\`\`sh
git --git-dir=.gate/repos/public/.git --work-tree=. ls-tree --name-only origin/staging supabase/migrations/
\`\`\`

Strict reviews explicit repository selection. Outside or protected paths,
repeated selectors and Git directory pointers require review in every profile.
The same checks apply to \`git log\` as in [${repositoryPathRevision}](../${repositoryPathRevision}/README.md).

Generate with \`node scripts/build-git-allow-by-default.mjs ${treeRepositoryPathRevision}\`.
Validate with \`npm test -- --shield /absolute/path/to/shield scripts/git-repository-paths.test.mjs\`.
`;

const builds = {
  [revision[1]]: {pack: gitAllowByDefaultPack, cases: gitAllowByDefaultCases, previous: revision[0], readme},
  [outputRevision]: {pack: gitScopedOutputPack, cases: gitOutputCases, previous: revision[1], readme: outputReadme},
  [editorRevision]: {pack: gitNoopEditorPack, cases: gitNoopEditorCases, previous: outputRevision, readme: editorReadme},
  [repositoryPathRevision]: {pack: gitRepositoryPathPack, cases: gitRepositoryPathFixtureCases,
    previous: editorRevision, readme: repositoryPathReadme},
  [treeRepositoryPathRevision]: {pack: gitTreeRepositoryPathPack, cases: gitTreeRepositoryPathFixtureCases,
    previous: repositoryPathRevision, readme: treeRepositoryPathReadme},
};

export async function buildGitAllowByDefault(version = revision[1]) {
  const build = builds[version];
  if (!build) throw Error(`Unknown Git pack version ${version}`);
  const directory = new URL(`../packs/canonic/git/${version}/`, import.meta.url);
  const previous = new URL(`../packs/canonic/git/${build.previous}/`, import.meta.url);
  const pack = await build.pack();
  const cases = await build.cases();
  await mkdir(directory, {recursive: true});
  await writeFile(new URL('pack.yml', directory), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('cases.json', directory), JSON.stringify({schema_version: 1, cases}, null, 2) + '\n');
  await copyFile(new URL('commands.json', previous), new URL('commands.json', directory));
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', directory));
  await writeFile(new URL('README.md', directory), build.readme);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildGitAllowByDefault(process.argv[2] ?? revision[1]);

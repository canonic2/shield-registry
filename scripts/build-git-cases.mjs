// Expected decisions are reviewed examples, not derived from the policy rules.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = new URL('../packs/canonic/git/0.2.0/', import.meta.url);
const inventory = JSON.parse(await readFile(new URL('commands.json', root)));
const cases = [];
const add = (name, argv, expected) => {
  for (const [index, profile] of ['loose', 'recommended', 'strict'].entries()) {
    cases.push({ name: `${name}-${profile}`, profile, argv: ['git', ...argv], expected: expected[index] });
  }
};
// Explicit independent expected classifications for inventory regression checks.
const strict = new Set('clone fetch pull push ls-remote fetch-pack send-pack remote-ext remote-fd daemon upload-pack upload-archive upload-archive--writer receive-pack http-backend http-fetch http-push imap-send send-email svn p4 cvsimport cvsexportcommit cvsserver archimport request-pull backfill difftool mergetool gui citool instaweb help'.split(' '));
const deny = new Set('clean prune prune-packed gc filter-branch rebase replace reflog restore checkout-index read-tree unpack-objects fast-import index-pack pack-objects repack pack-refs pack-redundant multi-pack-index maintenance fsmonitor--daemon credential credential-cache credential-cache--daemon credential-store hook for-each-repo submodule--helper checkout--worker merge-index merge-recursive merge-recursive-ours merge-recursive-theirs merge-subtree merge-ours update-ref update-server-info'.split(' '));
for (const { name } of inventory.commands) add(`inventory-${name}`, [name, '--unknown-shield-option'], deny.has(name) ? ['ask', 'deny', 'deny'] : strict.has(name) ? ['ask', 'ask', 'deny'] : ['ask', 'ask', 'ask']);

const examples = {
  inspect: [
    ['status'], ['status', '--short', '--branch'], ['status', '--porcelain'], ['status', '--porcelain=v2', '-z'],
    ['log', '--oneline', '--graph', '-n5', 'HEAD'], ['log', '--format=%h %s', '--since=2026-01-01'],
    ['log', 'HEAD', '-pz'], ['diff', '--cached', '--stat'], ['diff', '--no-ext-diff', '--no-textconv', '--', 'src'],
    ['diff', '-U3', 'HEAD~1', 'HEAD'], ['show', '--format=fuller', 'HEAD'], ['grep', '-n', '-e', 'TODO', '--', 'src'],
    ['blame', '-L', '1,10', '--', 'README.md'], ['ls-files', '--stage', '-z'], ['ls-tree', '-r', 'HEAD'], ['grep', '-n', '-e', 'TODO', '--', 'README.md'],
    ['cat-file', '-p', 'HEAD'], ['rev-parse', '--show-toplevel'], ['rev-list', '--count', 'HEAD'],
    ['for-each-ref', '--format=%(refname)'], ['show-ref', '--heads'], ['merge-base', '--is-ancestor', 'main', 'HEAD'],
    ['describe', '--tags', '--always'], ['count-objects', '-v'], ['check-ignore', '-v', 'node_modules'],
    ['check-attr', '--all', '--', 'README.md'], ['check-ref-format', '--branch', 'feature'],
    ['hash-object', '--no-filters', 'README.md'], ['branch'], ['branch', '--list', 'feature/*'], ['branch', '--show-current'],
    ['tag'], ['tag', '--list', 'v*'], ['remote', '-v'], ['remote', 'get-url', 'origin'], ['remote', 'show', '-n', 'origin'],
    ['worktree', 'list', '--porcelain'], ['stash', 'list', '--oneline'], ['stash', 'show', '--stat'],
    ['reflog', 'show', '--oneline'], ['notes', 'list'], ['submodule', 'status', '--recursive'], ['sparse-checkout', 'list'],
    ['config', '--get', 'user.name'], ['config', '--list', '--show-origin'], ['config', 'get', 'user.name'],
    ['config', 'list', '--local'], ['clean', '-nd'], ['clean', '--dry-run', '-x'], ['clean', '-n', '--', '-f'],
    ['apply', '--check', 'change.patch'], ['apply', '--stat', 'change.patch'], ['--no-pager', 'log', '--oneline'],
    ['-P', 'status', '--short'], ['version', '--build-options'], ['--version'],
    ['log', '--', '--output=literal-file'],
  ],
  stage: [['add', 'README.md'], ['add', '-A'], ['add', '--', '--force'], ['stage', '-u']],
  local: [
    ['commit', '-m', 'Implement feature'], ['commit', '-am', 'Fix bug'], ['switch', '-c', 'feature'],
    ['checkout', '-b', 'feature'], ['merge', '--ff-only', 'feature'], ['cherry-pick', 'HEAD~1'],
    ['revert', '--no-edit', 'HEAD'], ['reset', '--soft', 'HEAD~1'], ['reset', 'README.md'],
    ['restore', '--staged', 'README.md'], ['init', '--initial-branch=main', 'new-repo'],
    ['stash', 'push', '-m', 'Before changes'], ['stash', 'apply'], ['stash', 'pop'], ['branch', 'feature'],
    ['tag', '-a', 'v1.0', '-m', 'Release'], ['mv', 'old', 'new'], ['rm', '--cached', 'tracked'],
  ],
  network: [
    ['push', 'origin', 'main'], ['fetch', '--prune', 'origin'], ['pull', '--ff-only'],
    ['clone', 'https://example.com/team/repo.git'], ['ls-remote', 'origin'], ['remote', 'show', 'origin'],
    ['submodule', 'update', '--init', '--recursive'], ['remote', 'update'], ['merge', '--strategy=custom', 'main'],
  ],
  destructive: [
    ['push', 'origin', 'main', '--force'], ['push', '-vf', 'origin', 'main'], ['push', '--force-with-lease=main:abc', 'origin'],
    ['push', 'origin', '+HEAD:main'], ['push', '--', 'origin', '+HEAD:main'], ['push', 'origin', ':main'],
    ['push', '--mirror', 'origin'], ['push', '--delete', 'origin', 'feature'], ['reset', 'HEAD', '--hard'],
    ['clean', '-fdx'], ['clean', '--', '-n'], ['clean', '-e', '-n'],
    ['commit', '-m', 'Rewrite', '--amend'], ['commit', '-anm', 'Bypass'],
    ['checkout', 'main', '-f'], ['switch', '--discard-changes', 'main'], ['branch', '-D', 'feature'],
    ['tag', '--delete', 'v1'], ['rm', '-rf', 'src'], ['stash', 'drop'], ['stash', 'clear'],
    ['worktree', 'remove', '../other'], ['submodule', 'foreach', 'echo hello'], ['config', '--unset', 'user.name'],
    ['rebase', '-i', 'HEAD~3'], ['restore', 'README.md'], ['gc'], ['prune'], ['credential', 'fill'], ['hook', 'run', 'pre-commit'],
    ['notes', 'remove'], ['notes', 'prune'], ['symbolic-ref', '--delete', 'refs/heads/feature'], ['update-index', '--force-remove', 'README.md'],
    ['--no-pager', 'push', '--force', 'origin', 'main'], ['-P', 'reset', '--hard'],
  ],
  review: [
    ['log', '--output=outside.txt'], ['diff', '--ext-diff'], ['show', '--textconv', 'HEAD'], ['grep', '--open-files-in-pager', 'TODO'],
    ['log', '-n'], ['status', '--short=yes'], ['log', '--unknown'],
    ['-c', 'alias.status=!echo hello', 'status'], ['-C', '../other', 'status'], ['--config-env=user.name=NAME', 'status'],
    ['--git-dir=../other/.git', 'log'], ['custom-extension'], ['config', 'user.name', 'Acme'],
    ['log', '--show-signature'], ['log', '--format', '--output=literal-value'],
  ],
};
const expected = { inspect: ['allow','allow','allow'], stage: ['allow','allow','ask'], local: ['allow','ask','ask'], network: ['ask','ask','deny'], destructive: ['ask','deny','deny'], review: ['ask','ask','ask'] };
// An output-looking token consumed by --format is a literal format, not an option.
examples.inspect.push(examples.review.pop());
for (const [tier, commands] of Object.entries(examples)) {
  commands.forEach((args, index) => add(`${tier}-${index}`, args, expected[tier]));
}
const output = process.argv[2] ? pathToFileURL(resolve(process.argv[2]) + '/') : root;
await writeFile(new URL('cases.json', output), JSON.stringify({ schema_version: 1, cases }, null, 2) + '\n');
console.log(`${cases.length} cases`);

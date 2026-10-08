// Reviewed Git permission data. Generation does not evaluate commands.
export const profiles = {
  inspect: ['allow', 'allow', 'allow'],
  stage: ['allow', 'allow', 'ask'],
  local: ['allow', 'ask', 'ask'],
  review: ['ask', 'ask', 'ask'],
  network: ['ask', 'ask', 'deny'],
  execution: ['ask', 'ask', 'deny'],
  destructive: ['ask', 'deny', 'deny'],
};

export const network = new Set('clone fetch pull push ls-remote fetch-pack send-pack remote-ext remote-fd daemon upload-pack upload-archive upload-archive--writer receive-pack http-backend http-fetch http-push imap-send send-email svn p4 cvsimport cvsexportcommit cvsserver archimport request-pull backfill'.split(' '));
export const destructive = new Set('clean prune prune-packed gc filter-branch rebase replace reflog restore checkout-index read-tree unpack-objects fast-import index-pack pack-objects repack pack-refs pack-redundant multi-pack-index maintenance fsmonitor--daemon credential credential-cache credential-cache--daemon credential-store hook for-each-repo submodule--helper checkout--worker merge-index merge-recursive merge-recursive-ours merge-recursive-theirs merge-subtree merge-ours update-ref update-server-info'.split(' '));
export const execution = new Set('difftool mergetool gui citool instaweb help'.split(' '));
export const reason = {
  inspect: 'Inspect repository data using explicitly listed options; repository configuration and executable identity remain host responsibilities.',
  stage: 'Stage local changes for review without recording or publishing a commit.',
  local: 'Change local repository state; review before changing history or the working tree in Recommended and Strict.',
  review: 'Review unclassified options or operations before permitting their effects.',
  network: 'Review remote access, publication or transport/helper execution; Strict denies these operations.',
  execution: 'Review launching editors, viewers or other external programs; Strict denies.',
  destructive: 'May discard data, rewrite history, run external code or change sensitive storage; Recommended and Strict deny.',
};

const split = value => value ? value.split(' ') : [];
const option = (prefix, flags = '', values = '', operands = true, tier = 'inspect', require = '') => ({
  prefix: split(prefix), flags: split(flags), values: split(values), operands, tier,
  ...(require ? { require_any: split(require) } : {}),
});

const diffFlags = '-p -u --patch --no-patch -s --raw --stat --numstat --shortstat --dirstat --summary --name-only --name-status --check --binary --full-index --color --no-color --color-words --word-diff --no-ext-diff --no-textconv --no-renames --minimal --patience --histogram --ignore-all-space --ignore-space-change --ignore-space-at-eol --ignore-cr-at-eol --ignore-blank-lines --exit-code --quiet -w -b -z --relative --reverse -R --no-prefix --abbrev';
const diffValues = '-U --unified --diff-filter --word-diff --word-diff-regex --color --color-moved --color-moved-ws --inter-hunk-context --src-prefix --dst-prefix --line-prefix --abbrev --find-renames --find-copies -S -G --stat-width --stat-name-width --stat-count';
// Options with both optional and explicit values appear in flags and values in
// Git, but the matcher uses one arity per name. Keep explicit-value spellings.
const remove = (flags, values) => split(flags).filter(flag => !split(values).includes(flag)).join(' ');
const safeDiff = remove(diffFlags, diffValues);
const logFlags = '--oneline --graph --all --branches --tags --remotes --decorate --no-decorate --date-order --author-date-order --topo-order --reverse --first-parent --no-merges --merges --ancestry-path --follow --walk-reflogs --no-walk --left-right --cherry --cherry-pick --boundary --encoding --simplify-by-decoration --full-history --simplify-merges --dense --sparse --parents --children';
const logValues = '-n --max-count --skip --since --after --until --before --author --committer --grep --format --pretty --date --decorate --encoding';

export const forms = [
  option('status', '--short -s --branch -b --porcelain --long --show-stash --ignored --ignore-submodules --no-renames -z', '--untracked-files -u --porcelain --ignored --ignore-submodules --find-renames', true),
  option('log', `${safeDiff} ${remove(logFlags, logValues)}`, `${diffValues} ${logValues}`),
  option('show', safeDiff, `${diffValues} --format --pretty --date --encoding`),
  option('diff', `${safeDiff} --cached --staged --merge-base`, diffValues),
  option('diff-files', safeDiff, diffValues),
  option('diff-index', `${safeDiff} --cached`, diffValues),
  option('diff-tree', `${safeDiff} -r -t --root --no-commit-id`, diffValues),
  option('range-diff', '--creation-factor --no-dual-color --left-only --right-only --no-ext-diff --no-textconv', '--creation-factor'),
  option('shortlog', '-s --summary -n --numbered -e --email --all', '--group --format --since --until'),
  option('blame', '--incremental --line-porcelain --porcelain --show-name --show-number --show-email -w -f -n -s -e --root --reverse --no-textconv', '-L --date --ignore-rev --ignore-revs-file'),
  option('annotate', '--porcelain --show-name --show-number --show-email -w -f -n -s -e --root --no-textconv', '-L --date'),
  option('grep', '-n --line-number -i --ignore-case -I --binary-files --cached --no-index --untracked --no-exclude-standard --recurse-submodules -v --invert-match -w --word-regexp -h -H --full-name -l --files-with-matches -L --files-without-match -c --count -z --null --break --heading --all-match --and --or --not -E --extended-regexp -G --basic-regexp -F --fixed-strings -P --perl-regexp --no-textconv --quiet -q', '-e -f -A -B -C --max-depth --threads'),
  option('ls-files', '--cached -c --deleted -d --modified -m --others -o --ignored -i --stage -s --unmerged -u --killed -k --directory --no-empty-directory --exclude-standard --full-name --error-unmatch --with-tree --debug --eol --deduplicate -z', '--exclude -x --exclude-from -X --exclude-per-directory --with-tree --format'),
  option('ls-tree', '-d -r -t -l --long --name-only --name-status --full-name --full-tree -z', '--format'),
  option('cat-file', '-t -s -e -p --batch --batch-check --batch-all-objects --unordered --buffer --follow-symlinks', '--batch --batch-check'),
  option('rev-parse', '--verify --quiet -q --short --abbrev-ref --symbolic --symbolic-full-name --show-toplevel --show-prefix --show-cdup --show-object-format --git-dir --absolute-git-dir --git-common-dir --is-inside-git-dir --is-inside-work-tree --is-bare-repository --show-superproject-working-tree --sq --not --all --branches --tags --remotes --revs-only --no-revs --flags --no-flags --local-env-vars', '--short --abbrev-ref --git-path --resolve-git-dir --path-format --show-object-format'),
  option('rev-list', '--all --branches --tags --remotes --count --objects --objects-edge --boundary --parents --children --timestamp --left-right --cherry-pick --cherry-mark --reverse --topo-order --date-order --first-parent --no-merges --merges --quiet --bisect --bisect-vars --bisect-all', '-n --max-count --skip --since --until --filter --format'),
  option('for-each-ref', '--sort --ignore-case --shell --python --perl --tcl --include-root-refs', '--format --sort --count --points-at --merged --no-merged --contains --no-contains'),
  option('show-ref', '--head --heads --branches --tags --dereference -d --verify --quiet -q --hash -s --exists', '--hash -s'),
  option('merge-base', '--all -a --octopus --independent --is-ancestor --fork-point'),
  option('describe', '--all --tags --contains --always --long --dirty --broken --exact-match', '--abbrev --candidates --match --exclude --dirty --broken'),
  option('name-rev', '--tags --all --always --undefined --no-undefined --name-only --annotate-stdin', '--refs --exclude'),
  option('count-objects', '-v --verbose -H --human-readable', '', false),
  option('check-ignore', '-v --verbose -n --non-matching --no-index -q --quiet -z'),
  option('check-attr', '-a --all --cached --source -z', '--source'),
  option('check-mailmap', '--stdin'),
  option('check-ref-format', '--branch --normalize --allow-onelevel --refspec-pattern'),
  option('show-branch', '--all -a --remotes -r --current --no-name --topics --topo-order --date-order --sparse', '--more --list --reflog'),
  option('show-index', '', '--object-format', false),
  option('hash-object', '--stdin --stdin-paths --no-filters --literally', '-t --path'),
  option('patch-id', '--stable --unstable --verbatim', '', false),
  option('get-tar-commit-id', '', '', false),
  option('stripspace', '--strip-comments -s --comment-lines -c', '', false),
  option('version', '--build-options', '', false),
  option('branch', '--list -l --all -a --remotes -r --verbose -v --no-color --show-current --no-column', '--format --sort --contains --no-contains --merged --no-merged --points-at'),
  option('tag', '--list -l --no-column', '--format --sort --contains --no-contains --merged --no-merged --points-at'),
  option('remote', '-v --verbose', '', false),
  option('remote get-url', '--all --push'),
  option('remote show', '-n --no-query', '', true, 'inspect', '-n --no-query'),
  option('worktree list', '--porcelain -z --verbose -v', '', false),
  option('stash list', `${safeDiff} ${remove(logFlags, logValues)}`, `${diffValues} ${logValues}`),
  option('stash show', `${safeDiff} --include-untracked --only-untracked`, diffValues),
  option('reflog show', `${safeDiff} ${remove(logFlags, logValues)}`, `${diffValues} ${logValues}`),
  option('reflog exists'),
  option('notes list'),
  option('notes show'),
  option('submodule status', '--cached --recursive'),
  option('sparse-checkout list', '', '', false),
  option('config list', '--local --global --system --worktree --show-origin --show-scope --name-only --includes --no-includes --null -z', '--file -f'),
  option('config get', '--local --global --system --worktree --show-origin --show-scope --all --includes --no-includes --null -z', '--file -f --type --default'),
  option('config', '--list -l --get --get-all --get-regexp --get-urlmatch --local --global --system --worktree --show-origin --show-scope --name-only --null -z --includes --no-includes', '--file -f --type', true, 'inspect', '--list -l --get --get-all --get-regexp --get-urlmatch'),
  option('clean', '--dry-run -n -d -x -X --quiet -q', '--exclude -e', true, 'inspect', '--dry-run -n'),
  option('apply', '--check --stat --numstat --summary --cached --index --reverse -R --verbose -v', '--directory -p --whitespace --include --exclude', true, 'inspect', '--check --stat --numstat --summary'),
  option('add', '--all -A --update -u --intent-to-add -N --ignore-removal --ignore-errors --ignore-missing --renormalize --verbose -v --dry-run -n --no-all --no-ignore-removal', '--chmod', true, 'stage'),
  option('stage', '--all -A --update -u --intent-to-add -N --verbose -v --dry-run -n', '', true, 'stage'),
  option('commit', '--all -a --quiet -q --verbose -v --signoff -s --allow-empty --allow-empty-message --no-edit --reset-author --dry-run --short --branch --porcelain --long --no-post-rewrite', '-m --message -F --file -C --reuse-message --author --date --cleanup --trailer', true, 'local'),
  option('switch', '--detach -d --guess --no-guess --quiet -q --recurse-submodules --no-recurse-submodules', '-c --create --track', true, 'local'),
  option('checkout', '--detach --quiet -q --guess --no-guess --ours --theirs --recurse-submodules --no-recurse-submodules', '-b --track', true, 'local'),
  option('merge', '--no-edit --no-ff --ff --ff-only --no-commit --commit --squash --no-squash --stat --no-stat --quiet -q --verbose -v --allow-unrelated-histories --abort --continue --quit', '-m --message -X --strategy-option', true, 'local'),
  option('cherry-pick', '--no-edit --no-commit -n --signoff -s --ff --allow-empty --allow-empty-message --keep-redundant-commits --abort --continue --skip --quit', '-m --mainline -X --strategy-option', true, 'local'),
  option('revert', '--no-edit --no-commit -n --abort --continue --skip --quit', '-m --mainline -X --strategy-option', true, 'local'),
  option('reset', '--soft --mixed --quiet -q', '', true, 'local'),
  option('restore', '--staged -S --quiet -q', '--source -s', true, 'local', '--staged -S'),
  option('init', '--bare --quiet -q', '--initial-branch -b --object-format --ref-format --template --separate-git-dir --shared', true, 'local'),
  option('stash push', '--keep-index -k --no-keep-index --include-untracked -u --all -a --staged -S --quiet -q', '-m --message', true, 'local'),
  option('stash apply', '--index --quiet -q', '', true, 'local'),
  option('stash pop', '--index --quiet -q', '', true, 'local'),
  option('stash branch', '', '', true, 'local'),
  option('branch', '--track --no-track --quiet -q', '', true, 'local'),
  option('tag', '--annotate -a --sign -s --no-sign', '-m --message -F --file --cleanup --local-user -u', true, 'local'),
  option('mv', '--verbose -v --dry-run -n', '', true, 'local'),
  option('rm', '--cached --dry-run -n --recursive -r --quiet -q --ignore-unmatch', '', true, 'local'),
];

// Bare branch/tag inspect; operands on their general forms create local refs.
forms.find(form => form.prefix.join(' ') === 'branch' && form.tier === 'inspect').require_any = ['--list', '-l', '--all', '-a', '--remotes', '-r', '--show-current'];
forms.find(form => form.prefix.join(' ') === 'tag' && form.tier === 'inspect').require_any = ['--list', '-l'];

// Git long options with optional values accept both --name and --name=value.
// Short options retain one arity; ambiguous short spellings ask for review.
for (const form of forms) {
  form.flags = [...new Set(form.flags)].filter(flag => flag.startsWith('--') || !form.values.includes(flag));
  form.values = [...new Set(form.values)];
}

export const exact = [['branch'], ['tag'], ['--version']];
export const risks = [
  { prefix: ['push'], tokens: ['--force', '-f', '--force-with-lease', '--force-if-includes', '--delete', '-d', '--mirror', '--prune'], token_prefixes: ['+', ':'], label: 'forced-or-deleting-push' },
  { prefix: ['reset'], tokens: ['--hard', '--merge', '--keep'], label: 'discarding-reset' },
  { prefix: ['commit'], tokens: ['--amend', '--no-verify', '-n'], label: 'rewrite-or-hook-bypass' },
  { prefix: ['checkout'], tokens: ['--force', '-f', '-B', '--overwrite-ignore'], label: 'forced-checkout' },
  { prefix: ['switch'], tokens: ['--force', '-f', '--discard-changes', '-C', '--force-create'], label: 'forced-switch' },
  { prefix: ['branch'], tokens: ['--delete', '-d', '-D', '--force', '-f', '-M', '-C'], label: 'deleting-or-replacing-branch' },
  { prefix: ['tag'], tokens: ['--delete', '-d', '--force', '-f'], label: 'deleting-or-replacing-tag' },
  { prefix: ['rm'], tokens: ['--force', '-f'], label: 'forced-removal' },
  { prefix: ['mv'], tokens: ['--force', '-f'], label: 'overwriting-move' },
  { prefix: ['stash', 'drop'], tokens: [], label: 'stash-drop', whole: true },
  { prefix: ['stash', 'clear'], tokens: [], label: 'stash-clear', whole: true },
  { prefix: ['worktree', 'remove'], tokens: [], label: 'worktree-removal', whole: true },
  { prefix: ['worktree', 'prune'], tokens: [], label: 'worktree-prune', whole: true },
  { prefix: ['submodule', 'deinit'], tokens: [], label: 'submodule-deinit', whole: true },
  { prefix: ['submodule', 'foreach'], tokens: [], label: 'submodule-external-execution', whole: true },
  { prefix: ['config'], tokens: ['--unset', '--unset-all', '--remove-section', '--rename-section', '--edit', '-e'], label: 'configuration-removal-or-editor' },
  { prefix: ['update-index'], tokens: ['--force-remove', '--remove'], label: 'index-removal' },
  { prefix: ['symbolic-ref'], tokens: ['--delete', '-d'], label: 'symbolic-ref-deletion' },
  { prefix: ['refs', 'delete'], tokens: [], label: 'ref-deletion', whole: true },
  { prefix: ['notes', 'remove'], tokens: [], label: 'note-removal', whole: true },
  { prefix: ['notes', 'prune'], tokens: [], label: 'note-prune', whole: true },
  { prefix: ['rerere', 'clear'], tokens: [], label: 'rerere-clear', whole: true },
];

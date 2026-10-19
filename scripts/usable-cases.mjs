// Independent workflow expectations; these do not read generated rules.
export const baselineReads = [
  ['sed-range', ['sed','-n','1,200p','README.md']],
  ['sed-last', ['sed','-n','$p','README.md']],
  ['sed-stdin', ['sed','-n','1,20p']],
  ['awk-fields', ['awk','{print $1, $2}','README.md']],
  ['awk-delimiter', ['awk','-F:','{print $1}','README.md']],
  ['awk-stdin', ['awk','{print $0}']],
  ['jq-field', ['jq','-r','.name','README.md']],
  ['jq-path', ['jq','.items[0].name','README.md']],
  ['jq-quoted', ['jq','.["some-key"]','README.md']],
  ['jq-array', ['jq','.items[].name','README.md']],
  ['jq-pipe', ['jq','.items | length','README.md']],
  ['jq-stdin', ['jq','keys']],
  ['sort-file', ['sort','-rn','README.md']],
  ['uniq-file', ['uniq','-c','README.md']],
  ['cut-fields-file', ['cut','-d:','-f1,3','README.md']],
  ['diff-files', ['diff','-u','README.md','README.md']],
  ['diff-context', ['diff','-U3','README.md','README.md']],
  ['cmp-files', ['cmp','-s','README.md','README.md']],
  ['formatted-date', ['date','+%Y-%m-%dT%H:%M:%S']],
  ['space', ['df','-h']],
];
export const baselineReviews = [
  ['sed-in-place', ['sed','-i','','1p','README.md']],
  ['sed-command', ['sed','-n','1p; e id','README.md']],
  ['sed-read-file', ['sed','-n','r secret','README.md']],
  ['awk-command', ['awk','{system("id")}','README.md']],
  ['awk-output', ['awk','{print $1 > "out"}','README.md']],
  ['awk-environment', ['awk','{print ENVIRON}','README.md']],
  ['jq-environment', ['jq','env']],
  ['jq-input', ['jq','. | inputs','README.md']],
  ['jq-module', ['jq','include "helper"; .','README.md']],
  ['jq-program-file', ['jq','-f','README.md']],
  ['jq-file-binding', ['jq','--rawfile','secret','.aws/config','.']],
  ['sort-output-file', ['sort','-o','out','README.md']],
  ['sort-input-list', ['sort','--files0-from=README.md']],
  ['uniq-output-file', ['uniq','README.md','out']],
  ['recursive-diff', ['diff','-r','src','src']],
  ['date-change', ['date','-s','2026-01-01']],
];
export const baselineDenied = [
  ['sed-credential', ['sed','-n','1p','.aws/config']],
  ['awk-credential', ['awk','{print $1}','.aws/config']],
  ['jq-credential', ['jq','.','.aws/config']],
  ['sort-credential', ['sort','.aws/config']],
  ['cut-outside', ['cut','-f1','/shield-baseline-unapproved/item']],
  ['diff-outside', ['diff','README.md','/shield-baseline-unapproved/item']],
];
export const gitReads = [
  ['log-count', ['log','-5']], ['log-count-after-flags', ['log','--oneline','--graph','-17']],
  ['show-count', ['show','-3','--stat']], ['rev-list-count', ['rev-list','-25','HEAD']],
  ['status-untracked', ['status','-u']], ['status-untracked-all', ['status','-uall']],
  ['branch-verbose', ['branch','-vv']], ['reflog-default', ['reflog']], ['reflog-count', ['reflog','-n','5']],
];
export const gitLocal = [
  ['merged-branch-delete', ['branch','-d','feature']], ['merged-branch-delete-long', ['branch','--delete','feature']],
  ['gc-default', ['gc']], ['gc-auto', ['gc','--auto']], ['rebase-continue', ['rebase','--continue']],
  ['rebase-abort', ['rebase','--abort']], ['rebase-quit', ['rebase','--quit']],
  ['stash-default', ['stash']], ['init-dot', ['init','-b','main','.']],
];
export const gitReviews = [
  ['amend', ['commit','--amend','--no-edit'], ['ask','ask','ask']],
  ['rebase-interactive', ['rebase','-i','HEAD~3'], ['ask','ask','deny']],
  ['rebase-exec', ['rebase','--exec','id','HEAD~3'], ['ask','ask','deny']],
  ['log-output-with-count', ['log','-5','--output=out'], ['ask','ask','ask']],
  ['log-helper-with-count', ['log','--oneline','-5','--ext-diff'], ['ask','ask','ask']],
  ['log-signature-with-count', ['log','-5','--show-signature'], ['ask','ask','ask']],
  ['missing-log-count', ['log','-n'], ['ask','ask','ask']],
  ['arbitrary-init-path', ['init','new-repo'], ['ask','ask','ask']],
];
export const gitDangerous = [
  ['amend-hook-bypass', ['commit','--amend','--no-verify','-m','Change']],
  ['clustered-hook-bypass', ['commit','-anm','Change']],
  ['rebase-hook-bypass', ['rebase','--no-verify','main']],
  ['forced-branch-delete', ['branch','-D','feature']], ['mixed-branch-delete', ['branch','-dD','feature']],
  ['forced-push', ['push','--force','origin','main']], ['lease-push', ['push','--force-with-lease','origin','main']],
  ['hard-reset', ['reset','--hard','HEAD']], ['clean-files', ['clean','-fdx']],
  ['restore-worktree', ['restore','README.md']], ['gc-immediate-prune', ['gc','--prune=now']],
  ['credential', ['credential','fill']], ['prune', ['prune']],
];

export function append(cases, entries, expected, executable) {
  for (const [name, args, override] of entries) {
    for (const [index, profile] of ['loose','recommended','strict'].entries()) {
      const argv = executable ? (override === true ? args : [executable, ...args]) : args;
      cases.push({ name: `usable-${name}-${profile}`, profile, argv,
        expected: (Array.isArray(override) ? override : expected)[index] });
    }
  }
}

export function updateExpected(name, fixtures) {
  const matches = (args, other) => JSON.stringify(args) === JSON.stringify(other);
  let changed = 0;
  for (const fixture of fixtures) {
    let expected;
    if (name === 'baseline' && matches(fixture.argv, ['cut','-f1','README.md'])) expected = 'allow';
    if (name === 'git') {
      const args = fixture.argv.slice(1);
      const index = ['loose','recommended','strict'].indexOf(fixture.profile);
      if (matches(args, ['commit','-m','Rewrite','--amend'])) expected = 'ask';
      if (matches(args, ['rebase','-i','HEAD~3'])) expected = ['ask','ask','deny'][index];
      if (matches(args, ['gc'])) expected = ['allow','allow','ask'][index];
      if (args[0] === 'rebase' && args[1] === '--unknown-shield-option') expected = ['ask','ask','deny'][index];
    }
    if (expected !== undefined && fixture.expected !== expected) { fixture.expected = expected; changed++; }
  }
  return changed;
}

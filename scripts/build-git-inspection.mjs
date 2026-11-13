// Git inspection grammars accept the read-only display, filter and diff options
// agents use every day. Only allowed inspection forms change; options that write
// files, launch external programs or read outside the repository stay unlisted.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {reviewedCases} from './build-reviewed-profile-cases.mjs';

export const revision = ['0.8.0', '0.9.0'];
const split = value => value.split(' ');
const digits = split('-0 -1 -2 -3 -4 -5 -6 -7 -8 -9');

// Git accepts these bare or as --name=value, never as a separate argument.
const optionalInGit = new Set(split('--color --word-diff --abbrev --find-renames --find-copies --color-moved --decorate --stat --dirstat --relative --pretty --untracked-files --ignore-submodules --submodule --notes --show-notes --column'));

const diff = {
  flags: split('--compact-summary --dirstat-by-file --cumulative --patch-with-stat --patch-with-raw -W --function-context --find-copies-harder --irreversible-delete -D --text -a --indent-heuristic --no-indent-heuristic --no-color-moved --no-color-moved-ws --ita-invisible-in-index --default-prefix --no-abbrev --no-relative -M -C -B'),
  values: split('--ws-error-highlight --anchored -I --ignore-matching-lines --diff-algorithm --rotate-to --skip-to -l --output-indicator-new --output-indicator-old --output-indicator-context'),
  optional: split('--ignore-submodules --submodule'),
};
const display = {
  flags: split('--oneline --abbrev-commit --no-abbrev-commit --no-decorate --relative-date --show-signature --no-show-signature --no-notes --use-mailmap --mailmap --no-mailmap --no-use-mailmap --first-parent --cc -c -m --dd --remerge-diff --no-diff-merges --combined-all-paths'),
  values: split('--diff-merges'),
  optional: split('--decorate --notes --show-notes --pretty'),
};
const history = {
  flags: [...digits, ...split('--invert-grep -i --regexp-ignore-case -E --extended-regexp -F --fixed-strings -P --perl-regexp --basic-regexp --all-match --pickaxe-all --pickaxe-regex --log-size --exclude-first-parent-only --show-pulls --no-min-parents --no-max-parents --source --left-only --right-only --cherry-mark --full-diff --ignore-missing --single-worktree -g --reflog')],
  values: split('-L --exclude --glob --since-as-filter --min-parents --max-parents --grep-reflog'),
  optional: [],
};
const merge = (...parts) => ({flags: parts.flatMap(p => p.flags), values: parts.flatMap(p => p.values), optional: parts.flatMap(p => p.optional)});
const additions = {
  'status': {flags: split('--ahead-behind --no-ahead-behind --renames --no-column -v --verbose'), values: [], optional: split('--column')},
  'log': merge(diff, display, history),
  'show': merge(diff, display, {flags: digits, values: [], optional: []}),
  'diff': merge(diff, {flags: split('--base --ours --theirs -1 -2 -3'), values: [], optional: []}),
  'diff-files': diff,
  'diff-index': diff,
  'diff-tree': merge(diff, {flags: split('-c --cc -m --always -v --merge-base'), values: [], optional: split('--pretty')}),
  'range-diff': merge(diff, {flags: split('-p -u --patch --no-patch -s --raw --stat --numstat --shortstat --summary --name-only --name-status --no-color --color-words --no-renames --minimal --patience --histogram --ignore-all-space --ignore-space-change --ignore-space-at-eol --ignore-cr-at-eol --ignore-blank-lines -w -b --no-prefix --no-notes'), values: split('-U --unified --diff-filter --word-diff-regex --color-moved-ws --inter-hunk-context --src-prefix --dst-prefix --line-prefix --stat-width --stat-name-width --stat-count'), optional: split('--color --word-diff --abbrev --color-moved --notes')}),
  'shortlog': {flags: split('-c --committer'), values: [], optional: []},
  'blame': {flags: split('-l -t -b --show-stats -c -p -M -C --minimal --first-parent --color-lines --color-by-age --progress --no-progress'), values: split('--encoding'), optional: split('--abbrev')},
  'grep': {flags: split('-o --only-matching --column -p --show-function -W --function-context -r --recursive --no-recursive -a --text --name-only --no-color'), values: split('-m --max-count'), optional: split('--color')},
  'ls-files': {flags: split('--recurse-submodules --sparse -t -v -f --resolve-undo'), values: [], optional: split('--abbrev')},
  'ls-tree': {flags: split('--object-only'), values: [], optional: split('--abbrev')},
  'rev-list': {flags: [...digits, ...split('--abbrev-commit --no-walk --ancestry-path --simplify-by-decoration --full-history --left-only --right-only --cherry --header --invert-grep -i --regexp-ignore-case -E --extended-regexp -F --fixed-strings --all-match --disk-usage')], values: split('--exclude --glob --min-parents --max-parents --after --before --author --committer --grep'), optional: split('--pretty --abbrev')},
  'for-each-ref': {flags: split('--omit-empty'), values: split('--exclude'), optional: []},
  'describe': {flags: split('--first-parent'), values: [], optional: []},
  'branch': {flags: split('--no-abbrev --ignore-case -i'), values: [], optional: split('--abbrev --color --column')},
  'tag': {flags: split('--ignore-case -i'), values: [], optional: split('--color --column')},
  'stash list': merge(diff, display, history),
  'stash show': diff,
  'reflog show': merge(diff, display, history),
};

const names = entry => typeof entry === 'string' ? entry : entry.name;

function widen(args, extra) {
  // Move options Git only accepts with an attached value to optional_values.
  const moved = args.values.filter(entry => optionalInGit.has(names(entry)))
    .concat(args.flags.filter(name => optionalInGit.has(name)));
  args.flags = args.flags.filter(name => !optionalInGit.has(name));
  args.values = args.values.filter(entry => !optionalInGit.has(names(entry)));
  args.optional_values = [...(args.optional_values ?? []), ...moved];
  const present = () => new Set([...args.flags, ...args.values, ...args.optional_values].map(names));
  for (const [field, list] of [['optional_values', extra.optional], ['values', extra.values], ['flags', extra.flags]])
    for (const name of list) if (!present().has(name)) args[field].push(name);
}

/** Allowed inspection grammars, including the operand-free branch listing. */
export const inspection = rule => (rule.id.startsWith('form-') || rule.id === 'read-branch-no-operands')
  && rule.conditions.arguments?.kind === 'options' && rule.decision.strict === 'allow';

export async function gitInspectionPack() {
  const pack = JSON.parse(await readFile(new URL(`../packs/canonic/git/${revision[0]}/pack.yml`, import.meta.url)));
  for (const rule of pack.rules) {
    const args = rule.conditions.arguments;
    if (!inspection(rule)) continue;
    const extra = additions[args.prefix.join(' ')];
    if (extra) widen(args, extra);
  }
  pack.version = revision[1];
  return pack;
}

const allow = ['allow', 'allow', 'allow'];
const review = ['ask', 'ask', 'ask'];
const added = [
  ['range-diff-stat', 'range-diff A^..B C~1..C --stat', allow],
  ['range-diff-display', 'range-diff --no-color --name-only -U3 main...HEAD', allow],
  ['log-graph-count', 'log --oneline --graph -8 HEAD origin/main', allow],
  ['log-count-cluster', 'log --abbrev-commit -20', allow],
  ['log-decorate', 'log --oneline --decorate --all', allow],
  ['log-decorate-value', 'log --decorate=short -5', allow],
  ['log-grep', 'log --grep=fix -i --invert-grep --oneline', allow],
  ['log-regexp', 'log -E --grep x --all-match', allow],
  ['log-reflog-walk', 'log -g --oneline', allow],
  ['log-signature', 'log --show-signature --no-notes --use-mailmap -1', allow],
  ['log-pretty', 'log --pretty -3', allow],
  ['log-pretty-format', 'log --pretty=format:%h -10', allow],
  ['log-line-range', 'log -L 1,5:src/app.ts', allow],
  ['log-color', 'log --color=always --stat', allow],
  ['show-oneline', 'show --oneline --no-patch HEAD', allow],
  ['show-abbrev', 'show --abbrev-commit -s --decorate HEAD', allow],
  ['show-merge', 'show --cc --first-parent HEAD', allow],
  ['diff-merge-base', 'diff --stat --merge-base main', allow],
  ['diff-renames', 'diff --cached --numstat --find-renames', allow],
  ['diff-submodules', 'diff --submodule=log --ignore-submodules', allow],
  ['diff-stat-width', 'diff --stat=120 HEAD~1', allow],
  ['diff-compact', 'diff --compact-summary -M -C HEAD~1', allow],
  ['diff-stage', 'diff --ours src/app.ts', allow],
  ['diff-tree-merge', 'diff-tree -r -c --no-commit-id --name-only HEAD', allow],
  ['status-renames', 'status --short --renames --no-ahead-behind', allow],
  ['status-untracked-bare', 'status --untracked-files', allow],
  ['grep-only-matching', 'grep -o --column Acme', allow],
  ['grep-function', 'grep -p -n Acme src', allow],
  ['ls-files-tags', 'ls-files -t --recurse-submodules', allow],
  ['blame-short', 'blame -l -t src/app.ts', allow],
  ['rev-list-abbrev', 'rev-list --abbrev-commit --no-walk -3 HEAD', allow],
  ['branch-abbrev', 'branch -vv --no-abbrev', allow],
  ['stash-list', 'stash list --oneline --date=relative', allow],
  ['reflog-show', 'reflog show --oneline -20', allow],
  // Neighboring boundaries stay reviewed.
  ['log-output', 'log --oneline --output=out', review],
  ['diff-external', 'diff --ext-diff', review],
  ['diff-textconv', 'diff --textconv', review],
  ['diff-outside', 'diff --no-index a b', review],
  ['range-diff-external', 'range-diff --ext-diff A..B C..D', review],
  ['grep-pager', 'grep -O less Acme', review],
  ['show-unknown', 'show --future HEAD', review],
  ['reflog-expire', 'reflog expire --all', ['ask', 'ask', 'deny']],
];

export function gitInspectionCases() {
  const cases = reviewedCases('git');
  for (const [name, command, decisions] of added)
    ['loose', 'recommended', 'strict'].forEach((profile, index) => cases.push({
      name: `inspection-${name}-${profile}`, profile, argv: ['git', ...split(command)], expected: decisions[index]}));
  return cases;
}

const readme = `# Git permissions ${revision[1]}

Requires Shield \`>=0.20.0, <1.0.0\`.

Profiles, boundaries and command coverage follow [${revision[0]}](../${revision[0]}/README.md).
This release widens the allowed inspection grammars with read-only options agents
use routinely:

- \`range-diff\` accepts the diff display options (\`--stat\`, \`--name-only\`, \`-U\`, colors).
- \`log\`, \`stash list\` and \`reflog show\` add \`--abbrev-commit\`, \`--decorate\`,
  grep matching modes, reflog walks, signatures, notes, mailmap, merge displays and
  \`-<n>\` counts combined with any listed option.
- \`show\` adds one-line and abbreviated displays, decoration and merge displays.
- Diff commands add compact summaries, rename/copy detection, submodule displays and
  whitespace controls. Options Git accepts only as \`--name=value\` or bare, such as
  \`--stat=120\` and \`--decorate\`, accept both spellings.
- \`status\`, \`grep\`, \`ls-files\`, \`ls-tree\`, \`blame\`, \`rev-list\`, \`for-each-ref\`,
  \`describe\`, and branch/tag listings add their remaining display options.

Options that write files (\`--output\`), launch external programs (\`--ext-diff\`,
\`--textconv\`, \`grep -O\`) or compare files outside the repository
(\`diff --no-index\`) remain unlisted and ask.

Generate with \`node scripts/build-git-inspection.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/git-inspection.test.mjs\`.
`;

export async function buildGitInspection() {
  const directory = new URL(`../packs/canonic/git/${revision[1]}/`, import.meta.url);
  const previous = new URL(`../packs/canonic/git/${revision[0]}/`, import.meta.url);
  await mkdir(directory, {recursive: true});
  await writeFile(new URL('pack.yml', directory), JSON.stringify(await gitInspectionPack(), null, 2) + '\n');
  await writeFile(new URL('cases.json', directory), JSON.stringify({schema_version: 1, cases: gitInspectionCases()}, null, 2) + '\n');
  await copyFile(new URL('commands.json', previous), new URL('commands.json', directory));
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', directory));
  await writeFile(new URL('README.md', directory), readme);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildGitInspection();

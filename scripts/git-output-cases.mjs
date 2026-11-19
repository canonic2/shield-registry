import {readFileSync} from 'node:fs';

export function gitOutputCases() {
  const previous = new URL('../packs/canonic/git/0.11.0/cases.json', import.meta.url);
  const {cases} = JSON.parse(readFileSync(previous));
  const changed = new Set(['inspection-log-output-loose', 'inspection-log-output-recommended']);
  const writable = ['allow', 'allow', 'ask'];
  const review = ['ask', 'ask', 'ask'];
  const scenarios = [
    ['diff', ['diff', 'base', 'head', '--output=review.diff'], writable],
    ['show', ['--no-pager', 'show', 'HEAD', '--output', 'review.diff'], writable],
    ['chdir', ['-C', 'scripts', 'diff', 'base', 'head', '--output=../review.diff'], writable],
    ['chdir-outside', ['-C', 'scripts', 'diff', '--output=../../review.diff'], review],
    ['log', ['log', '--output=review.log', '--', 'README.md'], writable],
    ['diff-tree', ['diff-tree', '--output=review.diff', 'HEAD'], writable],
    ['diff-index', ['diff-index', '--output=review.diff', 'HEAD'], writable],
    ['diff-files', ['diff-files', '--output=review.diff'], review],
    ['whatchanged', ['whatchanged', '--output=review.log'], writable],
    ['repeated', ['diff', '--output=first.diff', '--output', 'second.diff'], writable],
    ['outside', ['diff', '--output', '../review.diff'], review],
    ['earlier-outside', ['diff', '--output=../first.diff', '--output=second.diff'], review],
    ['later-outside', ['diff', '--output=first.diff', '--output=../second.diff'], review],
    ['missing', ['diff', '--output'], review],
    ['empty', ['diff', '--output='], review],
    ['separator', ['diff', '--output', '--', 'README.md'], review],
    ['pathspec', ['diff', '--', '--output=literal'], review],
    ['uncertain-separator', ['diff', '--output=first.diff', '--', '--output=../second.diff'], review],
    ['git-metadata', ['diff', '--output=.git/config'], review],
    ['gate-metadata', ['diff', '--output=.gate/repos/public/.git/config'], review],
    ['shield-policy', ['show', '--output', '.shield/config.yml'], review],
    ['grouped-shield-policy', ['show', '--output', '.config/shield/config.yml'], review],
    ['ext-diff', ['diff', '--output=review.diff', '--ext-diff'], review],
    ['textconv', ['show', '--output=review.diff', '--textconv'], review],
    ['no-index', ['diff', '--no-index', '--output=review.diff', '../first', '../second'], review],
    ['archive', ['archive', '--output=review.tar', 'HEAD'], review],
    ['format-patch', ['format-patch', '--output=review.diff', 'HEAD'], review],
  ];
  return [
    ...cases.map(row => changed.has(row.name) ? {...row, expected: 'allow'} : row),
    ...scenarios.flatMap(([name, argv, expected]) =>
      ['loose', 'recommended', 'strict'].map((profile, index) => ({
        name: `scoped-output-${name}-${profile}`, profile, argv: ['git', ...argv], expected: expected[index],
      }))),
  ];
}

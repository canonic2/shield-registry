const routine = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'ask'];

export function gitRepositoryPathCases() {
  const scenarios = [
    ['both', ['--git-dir=.git', '--work-tree=.', 'log', '--oneline'], routine],
    ['git-dir', ['--git-dir=.git', 'log', '--oneline'], routine],
    ['work-tree', ['--work-tree=.', 'log', '--oneline'], routine],
    ['separate', ['--work-tree', '.', '--git-dir', '.git', 'log', '--oneline'], routine],
    ['pager-and-display', ['--git-dir=.git', '-P', 'log', '--graph', '--format=%h', '-5', 'HEAD'], routine],
    ['chdir', ['-C', 'scripts', '--git-dir=../.git', '--work-tree=..', 'log', '--oneline'], routine],
    ['git-dir-outside', ['--git-dir=../other/.git', 'log', '--oneline'], review],
    ['work-tree-outside', ['--git-dir=.git', '--work-tree=..', 'log', '--oneline'], review],
    ['chdir-outside', ['-C', '..', '--work-tree=.', 'log', '--oneline'], review],
    ['chdir-target-outside', ['-C', 'scripts', '--git-dir=../../other/.git', 'log', '--oneline'], review],
    ['policy-path', ['--git-dir=.shield', 'log', '--oneline'], review],
    ['empty', ['--git-dir=', 'log', '--oneline'], review],
    ['missing', ['--git-dir'], review],
    ['missing-before-option', ['--git-dir', '--work-tree=.', 'log', '--oneline'], review],
    ['repeated', ['--git-dir=../other/.git', '--git-dir=.git', 'log', '--oneline'], review],
    ['file-output', ['--git-dir=.git', 'log', '--output=review.log'], review],
    ['abbreviated-output', ['--work-tree=.', 'log', '--out=review.log'], review],
    ['external-diff', ['--git-dir=.git', 'log', '-p', '--ext-diff'], review],
    ['text-conversion', ['--git-dir=.git', 'log', '-p', '--textconv'], review],
    ['config-override', ['--git-dir=.git', '-c', 'core.pager=helper', 'log'], review],
    ['other-command', ['--work-tree=.', 'status', '--short'], review],
    ['mutation', ['--git-dir=.git', '--work-tree=.', 'reset', '--hard'], review],
  ];
  const cases = scenarios.flatMap(([name, argv, decisions]) =>
    ['loose', 'recommended', 'strict'].map((profile, index) => ({
      name: `repository-paths-${name}-${profile}`, profile, argv: ['git', ...argv], expected: decisions[index],
    })));
  cases.push({
    name: 'repository-paths-bash-recommended', profile: 'recommended', expected: 'allow',
    input: {kind: 'shell', dialect: 'bash', dialect_version: null, original_input: {},
      source: 'git --git-dir=.git --work-tree=. log --oneline'},
  });
  return cases;
}

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

export function gitTreeRepositoryPathCases() {
  const gate = ['--git-dir=.gate/repos/public/.git', '--work-tree=.', 'ls-tree',
    '--name-only', 'origin/staging', 'supabase/migrations/'];
  const scenarios = [
    ['gate-checkout', gate, routine],
    ['git-dir', ['--git-dir', '.git', 'ls-tree', '-r', '--format=%(path)', 'HEAD'], routine],
    ['work-tree', ['--work-tree=.', 'ls-tree', '--abbrev=12', 'HEAD'], routine],
    ['chdir', ['-C', 'scripts', '--git-dir=../.git', '--work-tree=..', 'ls-tree', '--full-tree', 'HEAD'], routine],
    ['git-dir-outside', ['--git-dir=../other/.git', 'ls-tree', 'HEAD'], review],
    ['work-tree-outside', ['--git-dir=.git', '--work-tree=..', 'ls-tree', 'HEAD'], review],
    ['protected-selector', ['--git-dir=.shield', 'ls-tree', 'HEAD'], review],
    ['repeated-selector', ['--git-dir=../other/.git', '--git-dir=.git', 'ls-tree', 'HEAD'], review],
    ['empty-selector', ['--git-dir=', 'ls-tree', 'HEAD'], review],
    ['missing-selector-value', ['--git-dir', '--work-tree=.', 'ls-tree', 'HEAD'], review],
    ['config-override', ['--git-dir=.git', '-c', 'core.pager=helper', 'ls-tree', 'HEAD'], review],
  ];
  const cases = scenarios.flatMap(([name, argv, decisions]) =>
    ['loose', 'recommended', 'strict'].map((profile, index) => ({
      name: `tree-repository-paths-${name}-${profile}`, profile, argv: ['git', ...argv], expected: decisions[index],
    })));
  cases.push({
    name: 'tree-repository-paths-gate-bash-recommended', profile: 'recommended', expected: 'allow',
    input: {kind: 'shell', dialect: 'bash', dialect_version: null, original_input: {},
      source: `git ${gate.join(' ')}`},
  });
  return cases;
}

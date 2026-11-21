const profiles = ['loose', 'recommended', 'strict'];
const routine = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'ask'];
const deny = ['deny', 'deny', 'deny'];

export const nodeYarnVersionCases = [
  ['version', ['yarn', '--cwd', '.', 'node', '--version'], routine],
  ['short-version', ['yarnpkg', '--cwd=.', 'node', '-v'], routine],
  ['absolute-outside', ['yarn', '--cwd=/outside/project', 'node', '--version'], review],
  ['parent-directory', ['yarn', '--cwd', '..', 'node', '--version'], review],
  ['missing-cwd', ['yarn', '--cwd'], review],
  ['missing-version', ['yarn', '--cwd', '.', 'node'], review],
  ['yarn-version', ['yarn', '--cwd', 'node', '--version'], ['allow', 'allow', 'allow']],
  ['repeat-cwd', ['yarn', '--cwd', '.', '--cwd', '.', 'node', '--version'], review],
  ['delimiter', ['yarn', '--cwd', '.', '--', 'node', '--version'], review],
  ['inline-code', ['yarn', '--cwd', '.', 'node', '-e', 'process.version'], review],
  ['preload', ['yarn', '--cwd', '.', 'node', '--version', '--require=./hook.cjs'], review],
  ['different-manager', ['yarn', '--cwd', '.', 'node', '--version'], deny, {package_manager: 'pnpm'}],
].flatMap(([name, argv, decisions, variables]) => profiles.map((profile, index) => ({
  name: `yarn-cwd-node-${name}-${profile}`, profile, argv, expected: decisions[index],
  ...(variables && {variables}),
})));

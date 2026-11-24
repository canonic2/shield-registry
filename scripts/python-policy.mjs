import {executableForms} from './tool-pack.mjs';
import {ecosystemCommands, ecosystemRules} from './python-ecosystem-policy.mjs';

export const commands = ['python', 'python3', 'pip', 'pip3', 'pytest', ...ecosystemCommands];
const execution = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const routine = {loose: 'allow', recommended: 'allow', strict: 'ask'};
const protectedPaths = ['.git', '.shield', '.ssh', '.aws', '.codex', '.claude', '.env', '.mcp.json'];

export function pythonPack() {
  const rules = [];
  const add = (id, names, args, decision, reason, extra = {}) => {
    const rule = {id, conditions: {domain: 'argv', executable: {one_of: names.flatMap(executableForms)}, arguments: args}, decision, reason, ...extra};
    rules.push(rule);
    return rule;
  };
  for (const name of ['python', 'python3', 'pip', 'pip3']) {
    const versions = name.startsWith('python') ? ['--version', '-V', '-VV'] : ['--version'];
    for (const flag of versions) add(`${name}-version-${flag.replaceAll('-', '')}`, [name], {kind: 'exact', values: [flag]}, 'allow', 'Print the installed tool version using its trusted installation.');
  }
  const grammar = {kind: 'options', prefix: ['-I', '-S', '-m', 'venv'],
    flags: ['--system-site-packages', '--symlinks', '--copies', '--upgrade', '--without-pip', '--without-scm-ignore-files'],
    values: ['--prompt'], operands: {match: {regex: '[^\\x00\\r\\n]+'}, min: 1, max: 32}};
  const venv = add('isolated-venv', ['python', 'python3'], grammar, routine,
    'Create virtual environments at approved destinations using the isolated standard library.');
  venv.conditions.cwd = {within: {root: 'write'}};
  venv.requirements = {argument_paths: {grammar, operands: {path: {within: {root: 'write'},
    exclude: protectedPaths.map(path => ({root: 'project', path}))}, recursive: true}}};
  venv.on_unmet = {decision: 'deny', message: 'Create virtual environments inside approved writable folders away from protected state.'};

  add('python-execution', ['python', 'python3'], {kind: 'any'}, execution,
    'Python scripts, modules, inline code, stdin and interactive sessions execute code and require review.', {fallback: true});
  add('pip-review', ['pip', 'pip3'], {kind: 'any'}, execution,
    'Review package operations, build backends, configuration, explicit paths and registry access.', {fallback: true});
  add('pytest-review', ['pytest'], {kind: 'any'}, execution,
    'Tests and pytest plugins execute project code and require review.');
  rules.push(...ecosystemRules());
  return {schema_version: 1, kind: 'pack', id: 'canonic/python', version: '0.1.0', license: 'MIT', maintainers: ['Canonic'],
    description: 'Python ecosystem permissions: interpreters, package/environment managers, Ruff/Black, type checking, tests, coverage, hooks/watchers and security auditing, with checked paths and reviewed execution, global changes and publication.',
    engines: {shield: '>=0.53.0, <1.0.0'},
    capabilities: ['structured-rules-v1', 'argument-rules-v1', 'argument-paths-v1', 'location-v1', 'access-paths-v1',
      'requirements-v1', 'regex-v1', 'fallback-rules-v1', 'unknown-options-v1', 'negated-selectors-v1'], rules};
}

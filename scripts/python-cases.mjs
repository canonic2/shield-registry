// Independent expectations, kept separate from the policy constructors.
import {ecosystemCases} from './python-ecosystem-cases.mjs';
const allow = ['allow', 'allow', 'allow'];
const execute = ['ask', 'ask', 'deny'];
const routine = ['allow', 'allow', 'ask'];
const deny = ['deny', 'deny', 'deny'];
const rows = [
  [['python', '--version'], allow],
  [['python3', '-V'], allow],
  [['python3', '-VV'], allow],
  [['pip', '--version'], allow],
  [['pip3', '--version'], allow],
  [['pytest', '--version'], execute],
  [['python3', '-I', '-S', '-m', 'venv', '.venv'], routine],
  [['python', '-I', '-S', '-m', 'venv', '--without-pip', '--prompt', 'Example', '.venv'], routine],
  [['python3', '-I', '-S', '-m', 'venv', 'env-one', 'env-two'], routine],
  [['python3', '-I', '-S', '-m', 'venv', '/outside/environment'], deny],
  [['python3', '-I', '-S', '-m', 'venv', '.git/environment'], deny],
  [['python3', '-I', '-S', '-m', 'venv', '.shield/environment'], deny],
  [['python3', '-I', '-S', '-m', 'venv', '.codex/environment'], deny],
  [['python3', '-I', '-S', '-m', 'venv', '.venv', '/outside/environment'], deny],
  [['python3', '-I', '-S', '-m', 'venv'], execute],
  [['python3', '-I', '-S', '-m', 'venv', '--prompt'], execute],
  [['python3', '-I', '-S', '-m', 'venv', '--clear', '.venv'], execute],
  [['python3', '-I', '-S', '-m', 'venv', '--upgrade-deps', '.venv'], execute],
  [['python3', '-m', 'venv', '.venv'], execute],
  [['python3', '-I', '-m', 'venv', '.venv'], execute],
  [['python3', '-c', 'print(1)'], execute],
  [['python3', '-cprint(1)'], execute],
  [['python3', '-m', 'http.server'], execute],
  [['python3', '-m', 'pip', 'install', '-r', 'requirements.txt'], execute],
  [['python3', '-m', 'pytest', '-q'], execute],
  [['python3', 'script.py', '--version'], execute],
  [['python3', '--version', 'script.py'], execute],
  [['python3', '-'], execute],
  [['python3'], execute],
  [['python3', '--help'], execute],
  [['pip', 'install', '--dry-run', 'example'], execute],
  [['pip3', 'install', '--target', '/outside', 'example'], execute],
  [['pip', 'uninstall', '-y', 'example'], execute],
  [['pip', 'list', '--log', '/outside/log.txt'], execute],
  [['pip', 'config', 'debug'], execute],
  [['pip', 'freeze'], execute],
  [['pytest', '--collect-only'], execute],
  [['pytest', '-p', 'example'], execute],
  [['/usr/bin/python3', '-V'], allow],
  [['/opt/homebrew/bin/python3', '-V'], allow],
  [['.venv/bin/python', '-c', 'print(1)'], ['ask', 'ask', 'ask']],
  [['python3.15', '-V'], ['ask', 'ask', 'ask']],
];

export function pythonCases() {
  return {schema_version: 1, cases: [...['loose', 'recommended', 'strict'].flatMap((profile, index) =>
    rows.map(([argv, expected], row) => ({name: `python-${row}-${profile}`, profile, argv, expected: expected[index]}))), ...ecosystemCases()]};
}

// Independently reviewed composition expectations. Baseline 0.17.0's broad
// project-tools rule asks in Strict even when Python allows built-in metadata.
// Across packs an Ask retains authority over another pack's Allow.
export function withBaselineCases(document) {
  const reviewedTools = new Set(['pytest', 'mypy', 'ruff', 'black'].flatMap(name =>
    [name, `/bin/${name}`, `/usr/bin/${name}`]));
  return {...document, cases: document.cases.map(row =>
    row.profile === 'strict' && row.expected === 'allow' && reviewedTools.has(row.argv?.[0])
      ? {...row, expected: 'ask'} : row)};
}

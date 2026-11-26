import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {rustDevelopmentCases} from './rust-development-cases.mjs';

export const previous = new URL('../packs/canonic/rust/0.2.1/', import.meta.url);
export const destination = new URL('../packs/canonic/rust/0.2.2/', import.meta.url);

const nextestSelection = {
  flags: ['--ignore-default-filter', '--release', '-r', '--bins', '--tests', '--examples', '--benches', '--lib',
    '--all-targets', '--cargo-quiet', '--cargo-verbose', '-v', '--verbose'],
  values: ['--run-ignored', '--filterset', '--partition', '--build-jobs', '--color', '--cargo-message-format',
    '-F', '-p', '--package', '--exclude', '--bin', '--example', '--test', '--bench'],
};
const nextestRunner = {
  flags: ['--no-capture', '--hide-progress-bar', '--no-output-indent'],
  values: ['-j', '--jobs', '--retries', '--no-tests', '--max-fail', '--stress-duration', '--show-progress',
    '--status-level', '--final-status-level', '--failure-output', '--success-output', '--message-format'],
};
const toolValidatedValues = new Set(['-j', '--jobs', '--run-ignored']);
const nextestListing = {
  flags: [],
  values: ['--list-type', '-T', '--show-progress'],
};

function updateArguments(grammar) {
  if (grammar.kind !== 'options') return;
  // Cargo and Nextest own validation of values that select tests or job counts.
  // Keep declarations for option arity and keep the predicates on path options.
  grammar.values = grammar.values.map(option => toolValidatedValues.has(option.name) ? option.name : option);

  const [tool, verb] = grammar.prefix.slice(-2);
  if (tool !== 'nextest' || !['run', 'list'].includes(verb)) return;
  const mode = verb === 'run' ? nextestRunner : nextestListing;
  grammar.flags = [...new Set([...grammar.flags, ...nextestSelection.flags, ...mode.flags])];
  grammar.values = [...new Set([...grammar.values, ...nextestSelection.values, ...mode.values])];
  // Nextest treats operands as test filters and emulates libtest flags after --.
  grammar.operands = true;
}

export async function rustPack() {
  const pack = JSON.parse(await readFile(new URL('pack.yml', previous)));
  pack.version = '0.2.2';
  pack.engines.shield = '>=0.55.0, <1.0.0';
  pack.capabilities.push('executable-path-lists-v1');
  pack.capabilities.sort();
  for (const [name, previous] of Object.entries(pack.variables)) {
    const tool = name.replace(/_executable$/, '');
    pack.variables[name] = {
      type: 'list',
      description: `Exact paths to local ${tool} executables.`,
      layer: 'local',
      items: {type: 'string', match: {regex: `[^\\x00\\r\\n]*[/\\\\]${tool}(?:\\.exe)?`}, max_length: previous.max_length},
      max_items: 16,
      setup: {question: `Which additional ${tool} paths should Shield use?`, unset: 'Standard command spellings'},
      discover: [
        ...previous.discover,
        {env: 'CARGO_HOME', path: `bin/${tool}.exe`},
        {home: `.cargo/bin/${tool}.exe`},
        {path_search: tool},
      ],
    };
  }
  for (const rule of pack.rules) {
    updateArguments(rule.conditions.arguments);
    if (rule.requirements?.argument_paths) updateArguments(rule.requirements.argument_paths.grammar);
  }
  return pack;
}

export async function rustCases() {
  const fixtures = JSON.parse(await readFile(new URL('cases.json', previous)));
  fixtures.cases.push(...rustDevelopmentCases);
  return fixtures;
}

export async function guide() {
  const prior = await readFile(new URL('README.md', previous), 'utf8');
  return prior.replace('# Rust permissions 0.2.1', '# Rust permissions 0.2.2')
    .replace('>=0.53.0, <1.0.0', '>=0.55.0, <1.0.0')
    .replace('build-rust-executables.mjs', 'build-rust-development.mjs')
    .replace('rust-executables.test.mjs', 'rust-development.test.mjs')
    .replace('## Installed rustup executables', `## Local builds and tests

Loose and Recommended allow routine Cargo builds and Nextest runs in approved
projects. Cargo and Nextest validate job counts, ignored-test modes and other
test selection values. For example, run a focused ignored test with
\`cargo nextest run --locked --test integration --run-ignored only smoke_test\`,
or use \`cargo nextest run -- --ignored --exact smoke_test\` for libtest-style
selection. Test listing, retries and console reporting use the same profile
decisions. Strict continues to ask for these operations.

Explicit manifest, target and output paths must stay within approved roots.
Configuration overrides, custom debuggers and tracers, and reusing archived
builds through Nextest run or list require review.

## Local Rust executable paths`)
    .replace(/Shield 0\.53\.0 or later with executable-discovery-v1[\s\S]*$/, `Shield with executable path list support checks CARGO_HOME/bin, ~/.cargo/bin
and its own PATH for Cargo, rustc, rustdoc, rustfmt and rustup. The ordinary
pack review shows the exact paths and saves them in ignored local settings.
Discovery preserves existing bindings and local opt-outs. Run pack configure,
or call MCP pack_configure with the installed reference and no assignments, to
discover missing settings on an existing installation.

Use an explicit local list for installations outside those locations. Include
each path you want to use for that tool.

\`\`\`sh
shield pack configure canonic/rust --local --set 'rustfmt_executable=["/opt/rust/bin/rustfmt","/opt/rust-dev/bin/rustfmt"]'
\`\`\`

The same arguments, path requirements and profiles apply to each configured
executable. A path must match literally to use the binding.
`);
}

async function build() {
  await mkdir(destination, {recursive: true});
  await writeFile(new URL('pack.yml', destination), JSON.stringify(await rustPack()) + '\n');
  await writeFile(new URL('cases.json', destination), JSON.stringify(await rustCases(), null, 2) + '\n');
  await writeFile(new URL('README.md', destination), await guide());
  for (const name of ['commands.json', 'LICENSE'])
    await copyFile(new URL(name, previous), new URL(name, destination));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();

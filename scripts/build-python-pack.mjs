import {copyFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {commands, pythonPack} from './python-policy.mjs';
import {pythonCases} from './python-cases.mjs';
import {executableForms} from './tool-pack.mjs';
import {ecosystem, ecosystemAliases} from './python-ecosystem-policy.mjs';
import {splitCaseFiles} from './fixture-files.mjs';

export const directory = new URL('../packs/canonic/python/0.1.0/', import.meta.url);
export const guide = `# Python permissions 0.1.0

One Python ecosystem pack. Requires Shield >=0.53.0, <1.0.0.
Reviewed on 2026-11-23 against the
official references below. No tool installation, package download or network
operation is performed by installing the pack.

Coverage includes Python, pip, pytest, uv/uvx, pipx, Poetry, Pipenv, virtualenv,
Ruff, Black, Pyright/basedpyright, mypy/dmypy, ty, tox, Nox, Hatch, coverage.py,
Bandit, pip-audit, watchfiles and pre-commit.
The complete executable and rule inventory is in \`commands.json\`.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact Python and pip version requests | Allow | Allow | Allow |
| Isolated standard-library virtual environment creation at approved paths | Allow | Allow | Ask |
| Virtual environment destinations outside writable roots or in protected state | Deny | Deny | Deny |
| Ruff check/fix/format with checked project source, cache, config and output paths | Allow | Allow | Ask |
| Ruff built-in rule/config/linters/version information | Allow | Allow | Allow |
| uv directory metadata and installed-tool listings with checked explicit config paths | Allow | Allow | Allow |
| Reviewed tools' exact version/help forms (see below) | Allow | Allow | Allow |
| Scripts, modules, inline code, stdin, interactive sessions and tests | Ask | Ask | Deny |
| Package resolution, installation, builds, publishing, credentials and environment/toolchain changes | Ask | Ask | Deny |
| Type checking, plugin-based scanning, coverage and task runners | Ask | Ask | Deny |
| Ruff unsafe fixes, argfiles, inline TOML overrides, unchecked paths and unclassified Ruff modes | Ask | Ask | Ask |
| Ruff cache removal and language server | Ask | Ask | Deny |
| Black formatting/checks with checked source/configuration/cache paths | Allow | Allow | Ask |
| Black stdin/inline input, disabled AST safety checks or unchecked paths | Ask | Ask | Ask |
| pre-commit YAML validation with checked input paths | Allow | Allow | Ask |
| pre-commit built-in sample configuration and ty version/rule/help/completion text | Allow | Allow | Allow |
| Hatch operations, ty checking/server, watchfiles targets and pre-commit hook/environment operations | Ask | Ask | Deny |

## Python and virtual environments

Use \`python3 -I -S -m venv .venv\` for environment creation. Isolation ignores
Python environment overrides, excludes the working directory from module lookup,
and disables site startup hooks. The installed interpreter and standard library
remain trusted. Environment creation can bootstrap the bundled pip through
ensurepip. Clearing environments and upgrading dependencies require review.

The candidate's original interpreter, pip and pytest decisions are retained.
Unisolated \`python -m venv\` asks, and \`python -m ruff\`, \`python -m pip\`
and other module forms remain interpreter execution. A project module can shadow
an installed package; the pack does not transfer direct-tool permissions to a
module based on its name. pytest keeps review even for version/help and
\`--collect-only\`, because its plugin and test-import lifecycle executes code.

## Ruff paths and configuration

Check and format share a writable-source boundary because configuration and
flags can enable fixes. Check-only invocations conservatively require writable
source paths too. Explicit paths, repeated options, short attached \`-oFILE\`
and source operands are checked against approved roots, excluding version
control, Shield state, credential folders and agent settings. Config files use
read roots; cache directories, output files and stdin filenames use write roots.
An explicit directory is checked as a recursive tree: a tree overlapping
protected state asks. \`ruff check src\` is the usual bounded form.

With no explicit operand, Ruff uses its default working directory. The pack
checks that directory against write roots; implicit file discovery, ancestor
configuration, extended configuration, environment overrides such as
\`RUFF_OUTPUT_FILE\`, and files followed through imports remain host concerns.
These rules are argument checks, not OS-level filesystem confinement. Only use
Loose/Recommended with trusted project configuration; Strict reviews each run.

Display/selection options do not need individual allowances. The grammar lists
value-taking options to keep their values distinct from source operands, skips
other options, and checks every occurrence of a path option. Inline
\`--config KEY=VALUE\` asks because TOML can redirect paths; config-file paths
are checked. Argument files (\`@file\`) ask because they can add hidden flags
and paths. Unsafe fixes ask, including an explicitly false switch, because the
conservative risk scan matches the option name. Standard input asks when it is
selected as a checked operand. \`ruff analyze graph\` asks because it can use
an explicit Python environment to resolve dependencies.

## Black, Hatch, ty, watchers and hooks

Black checks explicit source trees against writable roots, including check/diff
mode, because formatting can rewrite files. Configuration uses read roots.
Explicit cache directories and stdin filenames use write roots. Repeated,
equals-form and attached short options retain their path checks. Other display
and style options need no separate allowance. Stdin, inline code, argument-file-like
operands and disabling AST safety with \`--fast\` retain review. Black parses
source rather than executing it. Implicit ancestor/user TOML, default caches,
environment overrides and symlink behavior remain host concerns, as for Ruff.

Hatch's project metadata, environment inspection and format/check commands can
load plugins or hooks and prepare environments. These operations retain review,
including dependency locks, scripts, tests, version edits, publication,
credential-bearing configuration and removal. Only exact root help/version
forms receive installed-tool allowances.

ty checks retain review for source/configuration access, fixes, baseline writes
and persistent watchers. The reviewed
[uv integration](https://github.com/astral-sh/ruff/blob/main/crates/ty_project/src/uv/command.rs)
can launch uv workspace metadata and synchronize standalone-script environments.
Type checking therefore does not establish a read-only boundary. Built-in
version/rule/help/completion text and exact subcommand help are allowed.

watchfiles launches and restarts shell-like commands or imported Python
callables. Custom filters can import code. Target selection, persistent watches
and child arguments retain execution review, including a child's help/version.

pre-commit hook runs, installation, updates, migration, cache deletion and
\`hazmat\` command wrappers retain review. Hooks can download environments and
execute configured commands that rewrite files or contact services. YAML
\`validate-config\` and \`validate-manifest\` only inspect structure, so they
receive path-checked allowances. Their default files are resolved from the
checked working directory. \`sample-config\` prints built-in YAML and is allowed.
Validation never grants permission to run the hooks it describes.

## Package managers, checks and execution

Review covers explicit files/URLs, selected projects and environments, caches,
build backends, credentials, remote indexes and generated outputs for every
operation that does not receive a positive allowance. \`uv run\`, \`uvx\`,
\`pipx run\`, \`poetry run\` and \`pipenv run\` execute commands; a child
\`--version\`, \`--help\`, dry run or frozen lock does not establish a safe
boundary. Dependency metadata resolution can execute build backends even before
an installation completes. Package publication, global/user installs,
interpreter acquisition, cache deletion, shell startup changes and credential
operations all retain review in Loose/Recommended and Deny in Strict.

Pyright can execute a selected Python interpreter for import discovery and
generate stubs. basedpyright can also update baselines and reports. mypy and
dmypy load configured Python plugins and write caches/reports; the daemon adds
process and socket state. tox loads plugins and can provision environments.
Nox imports its noxfile even to list sessions. Coverage can load configured file
tracers while reporting. Bandit uses scanner/formatter plugins. pip-audit can
invoke dependency resolution, send dependency metadata to services and install
fixes. These workflows remain reviewed, with explicit operations inventoried
where the CLI uses subcommands.

Exact \`--version\`, \`--help\` and \`-h\` forms are allowed for uv, pipx,
Poetry, Pipenv, Ruff, Pyright/basedpyright, mypy/dmypy, coverage/coverage3 and
pip-audit, Hatch, Black, ty, watchfiles and pre-commit, trusting the selected
installed tool's startup. pre-commit also accepts exact \`-V\`. tox, Nox, virtualenv
and Bandit retain review for these forms because plugin/configuration startup
is part of their boundary. uvx and the language-server binaries retain execution
review for every invocation. uv and Ruff's exact subcommand help is allowed;
other tools retain their plugin-aware review. Ask follows the host's approval
or fallback behavior and does not guarantee a displayed prompt.
Poetry's plugin-provided \`export\` and \`shell\` commands remain covered when
installed; the pack does not install those plugins.

uv's allowed metadata operations are \`cache dir\`, \`tool dir\`,
\`tool list\`, \`auth dir\` and \`python dir\`. Explicit configuration paths
are checked against read roots; project/directory selectors ask. Reading
\`auth dir\` prints a location, while \`auth token\` remains sensitive review.
\`uv version\` can change project metadata and is reviewed; \`uv --version\`
prints the installed tool version.

## Complete ecosystem operation inventory

Every listed operation has an explicit rule and independent profile fixtures.
Tools without subcommands have a reviewed whole-invocation rule, including
unknown flags and empty invocations. Unknown execution-tool operations retain
Ask/Ask/Deny; unclassified Ruff syntax asks in all profiles.

| Tool | Reviewed operations | Official source |
| --- | --- | --- |
${Object.entries(ecosystem).map(([name, tool]) => `| ${name} | ${tool.operations.length ? tool.operations.map(operation => `\`${operation}\``).join(', ') : 'Whole invocation'} | [Reference](${tool.source}) |`).join('\n')}

Aliases: ${Object.entries(ecosystemAliases).map(([alias, name]) => `\`${alias}\` → \`${name}\``).join(', ')}.
Language-server binaries retain execution review; coverage3 shares coverage's
operation rules. The registry's 16 discovery hints name representative tools;
they do not limit this inventory or split the ecosystem into separate packs.

## Installation identity and limits

Executable matching covers each command basename, \`/usr/bin/\`,
\`/usr/local/bin/\` and \`/opt/homebrew/bin/\`. Matching a name does not
authenticate executable bytes. Version-specific interpreter names, Windows
launchers and paths, virtual-environment executables and other custom install
locations use ordinary host fallback. The pack does not infer a permission from
an arbitrary Python package name or a wrapper's child arguments. Conda/Mamba,
pyenv and third-party MCP servers have separate scopes and are not included.
Environment variables, interpreter startup hooks, configured plugin behavior
and implicit files/network access require host enforcement or project review.

## Sources and verification

Reviewed in November 2026 against the official
[Python command-line reference](https://docs.python.org/3/using/cmdline.html),
[venv reference](https://docs.python.org/3/library/venv.html) and
[pip reference](https://pip.pypa.io/en/stable/cli/pip/) and
[pytest plugin reference](https://docs.pytest.org/en/stable/how-to/plugins.html).

Policy sources are \`python-policy.mjs\` and \`python-ecosystem-policy.mjs\`.
Independent fixtures are \`python-cases.mjs\` and
\`python-ecosystem-cases.mjs\`, all under \`scripts/\`.
Fixtures validate decisions through the production Shield evaluator and do not
run tools, install packages or contact services. Live tool execution and native
agent-hook acceptance are separate from this policy verification.
No interfaces have been retired from the original candidate.

Composition correction, 2026-11-23: Baseline 0.17.0 has broad project-tool
allowances for pytest, mypy, Ruff and Black. Python's reviewed catch-alls for
those tools are regular restrictions, so Baseline cannot replace execution or
unclassified-input review with Allow. This tightens combined-pack behavior while
retaining standalone decisions and the more specific checked-path allowances.
Every independent decision is verified both alone and with Baseline/Node.
Baseline's own Strict Ask still applies to its listed project tools, including
Python-allowed built-in metadata. The independent composition expectations
retain that restriction.

Regenerate with \`node scripts/build-python-pack.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/python-pack.test.mjs\`.
`;

export async function buildPythonPack() {
  const pack = pythonPack();
  await mkdir(directory, {recursive: true});
  const inventory = {schema_version: 1, commands: commands.map(name => ({name,
    rule_ids: pack.rules.filter(rule => rule.conditions.executable.one_of.includes(executableForms(name)[0])).map(rule => rule.id)}))};
  for (const [name, data] of [['pack.yml', pack], ...splitCaseFiles(pythonCases()), ['commands.json', inventory]])
    await writeFile(new URL(name, directory), JSON.stringify(data, null, 2) + '\n');
  await writeFile(new URL('README.md', directory), guide);
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', directory));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildPythonPack();

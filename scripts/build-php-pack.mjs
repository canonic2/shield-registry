import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {commands, engine, phpPack, tools, version} from './php-policy.mjs';
import {phpCases} from './php-cases.mjs';
import {writePack, destinationOf} from './tool-pack.mjs';
import {splitCaseFiles} from './fixture-files.mjs';

export const directory = destinationOf(phpPack());
export function guide() {
  return `# PHP, Composer and Laravel permissions ${version}

Requires Shield \`${engine}\`. Reviewed against the official sources below
on 2026-11-23. This source candidate keeps PHP, its development tools and
Laravel application workflows in one pack.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact php -n version, help and compiled-module queries | Allow | Allow | Allow |
| PHP syntax checks with php.ini disabled and approved source paths | Allow | Allow | Ask |
| Isolated lint reading outside approved roots or protected state | Deny | Deny | Deny |
| PHP scripts, inline/stdin/interactive code, servers and other startup modes | Ask | Ask | Deny |
| Composer dependencies, plugins, scripts, configuration, global tools, archives and publication helpers | Ask | Ask | Deny |
| Test runners, analyzers, formatters, refactoring and mutation testing | Ask | Ask | Deny |
| Laravel installation, inspection, tests, serving, caches, queues, migrations, seeds and generators | Ask | Ask | Deny |
| Artisan migration rollback/reset/fresh/refresh, database wipe, key generation, decrypted secrets and queue deletion | Ask | Deny | Deny |

## Runtime and file effects

Use \`php -n -l path/to/source.php\` for automatic syntax checking.
The parser requires an explicit no-php-ini switch and lint mode before source
operands. Every source must be inside approved readable roots and outside
protected state. Multiple source files are supported by PHP 8.3 and later.
Competing execution modes, custom INI files, INI overrides, extensions, stdin
and unknown syntax require review. Ordinary PHP startup can load native
extensions and configured prepend files, so plain php -v and php -l also ask.
Compiled-in extensions and the selected interpreter remain trusted.

The isolated allowance grants source reads only. Other commands remain complete
review requests covering explicit and implicit files, credentials, network
targets and processes. Composer can load global and project plugins, dispatch
events, execute scripts, resolve dependencies and write caches or global state.
Even --no-plugins --no-scripts installation retains review for downloads and
writes. Project scripts and publish helpers can perform arbitrary actions.

PHPUnit, Pest and ParaTest execute tests, bootstrap code and extensions. PHPStan
and Larastan can load bootstrap/configuration and application code. Psalm, Phan,
coding standards, PHP CS Fixer, Rector and Pint can load custom PHP code or
rules, inspect source and write caches, baselines, reports or fixes. Dry runs,
test listing and check-only switches retain review for configuration execution.
Larastan uses the phpstan entry point. Infection executes mutated tests.

## Laravel ownership

Artisan boots the application and registered service providers, including for
inspection. Tinker executes arbitrary PHP. Migration names do not establish
whether a database is disposable; --pretend and --force retain their operation's
decision. Key rotation can invalidate encrypted application data. Cache, queue,
schedule, storage-link, maintenance and worker commands affect shared services,
files, data or persistent processes. Sail wraps Docker and can expose listeners,
mount host files or execute container commands.

PHP, direct Artisan and Sail argument scans tighten explicit destructive command
tokens wherever they occur, including php -f artisan and Sail forwarding. The
scans can conservatively flag a token used as a value. Hidden operations inside
scripts retain execution review. There is no claim of parsing PHP source or
establishing a database, Docker or deployment sandbox. Host enforcement owns
effective environment, credentials and resource boundaries. Ask follows host
approval or fallback behavior.

## Launch forms and inventory

The pack covers command basenames and standard Unix executable paths, plus
vendor/bin and ./vendor/bin forms for Composer and project tools and ./artisan.
PHP scripts, composer.phar and tool PHARs run through php's execution decision.
Project-specific aliases and other executable paths use host fallback.
The signed discovery list has 16 hints; commands.json retains every tool name.

${Object.entries(tools).map(([name, tool]) => `- \`${name}\` — ${tool.operations.map(operation => `\`${operation}\``).join(', ')}. [Source](${tool.source})`).join('\n')}

The operation list includes modes selected by switches as well as subcommands.
Unknown commands for these executables retain execution review. Custom Composer
scripts and Artisan commands belong to the same execution boundary. Existing
interfaces are retained; retirement requires first verified absence and three
subsequent published feature releases. This pack provides CLI permissions;
native PHP build tools, web-server administration, remote deployment utilities
and MCP servers retain their host policy.

## Reproduce

Generate with \`node scripts/build-php-pack.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/php-pack.test.mjs\`.
Independent fixtures use Shield's evaluator without executing PHP applications,
installing dependencies or contacting databases. Live PHP and Laravel runtime
acceptance remains unverified.
`;
}
export async function buildPhpPack() {
  const pack = phpPack();
  await writePack(pack);
  const inventory = {schema_version: 1, commands: commands.map(name => ({name,
    rule_ids: pack.rules.filter(rule => rule.conditions.executable.one_of.includes(name)).map(rule => rule.id)}))};
  await writeFile(new URL('commands.json', directory), JSON.stringify(inventory, null, 2) + '\n');
  for (const [file, cases] of splitCaseFiles(phpCases()))
    await writeFile(new URL(file, directory), JSON.stringify(cases, null, 2) + '\n');
  await writeFile(new URL('README.md', directory), guide());
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildPhpPack();

# PHP, Composer and Laravel permissions 0.1.0

Requires Shield `>=0.53.0, <1.0.0`. Reviewed against the official sources below
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

Use `php -n -l path/to/source.php` for automatic syntax checking.
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

- `php` — `script`, `inline`, `stdin`, `interactive`, `server`, `lint`. [Source](https://www.php.net/manual/en/features.commandline.options.php)
- `composer` — `init`, `install`, `i`, `update`, `u`, `upgrade`, `require`, `remove`, `reinstall`, `bump`, `check-platform-reqs`, `global`, `search`, `show`, `info`, `outdated`, `browse`, `home`, `suggests`, `fund`, `depends`, `why`, `prohibits`, `why-not`, `validate`, `status`, `diagnose`, `archive`, `create-project`, `dump-autoload`, `dumpautoload`, `clear-cache`, `clearcache`, `config`, `exec`, `run-script`, `run`, `licenses`, `audit`, `self-update`, `selfupdate`, `completion`, `list`, `help`. [Source](https://getcomposer.org/doc/03-cli.md)
- `phpunit` — `test`, `list`, `coverage`, `bootstrap`. [Source](https://docs.phpunit.de/en/12.5/textui.html)
- `pest` — `test`, `parallel`, `coverage`, `mutate`. [Source](https://pestphp.com/docs/cli-api-reference)
- `paratest` — `test`, `parallel`. [Source](https://github.com/paratestphp/paratest)
- `phpstan` — `analyse`, `analyze`, `clear-result-cache`, `diagnose`, `dump-parameters`. [Source](https://phpstan.org/user-guide/command-line-usage)
- `psalm` — `analyse`, `alter`, `init`, `baseline`, `language-server`. [Source](https://github.com/vimeo/psalm)
- `phpcs` — `check`, `report`, `config-set`, `config-delete`. [Source](https://github.com/PHPCSStandards/PHP_CodeSniffer)
- `phpcbf` — `fix`. [Source](https://github.com/PHPCSStandards/PHP_CodeSniffer)
- `php-cs-fixer` — `fix`, `check`, `describe`, `list-files`. [Source](https://cs.symfony.com/doc/usage.html)
- `pint` — `fix`, `test`, `dirty`, `repair`. [Source](https://laravel.com/framework/docs/13.x/pint)
- `rector` — `process`, `list-rules`, `setup-ci`. [Source](https://getrector.com/documentation/cli-options)
- `phan` — `analyse`, `daemon`, `language-server`. [Source](https://github.com/phan/phan)
- `phpmd` — `analyse`, `baseline`, `report`. [Source](https://phpmd.org/documentation/index.html)
- `infection` — `test`, `coverage`, `mutation`. [Source](https://infection.github.io/guide/command-line-options.html)
- `artisan` — `list`, `help`, `about`, `test`, `serve`, `tinker`, `route:list`, `route:cache`, `route:clear`, `config:show`, `config:cache`, `config:clear`, `cache:clear`, `cache:forget`, `optimize`, `optimize:clear`, `view:cache`, `view:clear`, `event:list`, `event:cache`, `event:clear`, `make:model`, `make:migration`, `make:controller`, `make:test`, `migrate`, `migrate:status`, `migrate:install`, `migrate:rollback`, `migrate:reset`, `migrate:refresh`, `migrate:fresh`, `db`, `db:show`, `db:table`, `db:seed`, `db:wipe`, `schema:dump`, `key:generate`, `env:encrypt`, `env:decrypt`, `queue:work`, `queue:listen`, `queue:restart`, `queue:retry`, `queue:clear`, `queue:flush`, `queue:forget`, `schedule:list`, `schedule:run`, `schedule:work`, `schedule:clear-cache`, `storage:link`, `storage:unlink`, `vendor:publish`, `package:discover`, `down`, `up`, `horizon`, `horizon:terminate`, `horizon:clear`. [Source](https://laravel.com/framework/docs/13.x/artisan)
- `laravel` — `new`, `install`, `list`, `help`. [Source](https://laravel.com/framework/docs/13.x/installation)
- `sail` — `up`, `down`, `build`, `test`, `artisan`, `php`, `composer`, `shell`, `root-shell`, `share`. [Source](https://laravel.com/framework/docs/13.x/sail)

The operation list includes modes selected by switches as well as subcommands.
Unknown commands for these executables retain execution review. Custom Composer
scripts and Artisan commands belong to the same execution boundary. Existing
interfaces are retained; retirement requires first verified absence and three
subsequent published feature releases. This pack provides CLI permissions;
native PHP build tools, web-server administration, remote deployment utilities
and MCP servers retain their host policy.

## Reproduce

Generate with `node scripts/build-php-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/php-pack.test.mjs`.
Independent fixtures use Shield's evaluator without executing PHP applications,
installing dependencies or contacting databases. Live PHP and Laravel runtime
acceptance remains unverified.

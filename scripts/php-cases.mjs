// Independent expected behavior. These inventories deliberately do not import
// the policy constructors or use evaluator output to determine expectations.
const allow = ['allow', 'allow', 'allow'];
const routine = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'deny'];
const destructive = ['ask', 'deny', 'deny'];
const deny = ['deny', 'deny', 'deny'];
const composerOperations = ['init', 'install', 'i', 'update', 'u', 'upgrade', 'require', 'remove', 'reinstall', 'bump', 'check-platform-reqs',
  'global', 'search', 'show', 'info', 'outdated', 'browse', 'home', 'suggests', 'fund', 'depends', 'why', 'prohibits', 'why-not',
  'validate', 'status', 'diagnose', 'archive', 'create-project', 'dump-autoload', 'dumpautoload', 'clear-cache', 'clearcache',
  'config', 'exec', 'run-script', 'run', 'licenses', 'audit', 'self-update', 'selfupdate', 'completion', 'list', 'help'];
const artisanOperations = ['list', 'help', 'about', 'test', 'serve', 'tinker', 'route:list', 'route:cache', 'route:clear', 'config:show',
  'config:cache', 'config:clear', 'cache:clear', 'cache:forget', 'optimize', 'optimize:clear', 'view:cache', 'view:clear',
  'event:list', 'event:cache', 'event:clear', 'make:model', 'make:migration', 'make:controller', 'make:test',
  'migrate', 'migrate:status', 'migrate:install', 'db', 'db:show', 'db:table', 'db:seed', 'schema:dump', 'env:encrypt',
  'queue:work', 'queue:listen', 'queue:restart', 'queue:retry', 'schedule:list', 'schedule:run', 'schedule:work', 'schedule:clear-cache',
  'storage:link', 'storage:unlink', 'vendor:publish', 'package:discover', 'down', 'up', 'horizon', 'horizon:terminate'];
const destructiveCommands = ['migrate:fresh', 'migrate:refresh', 'migrate:reset', 'migrate:rollback', 'db:wipe',
  'key:generate', 'env:decrypt', 'queue:clear', 'queue:flush', 'queue:forget', 'horizon:clear'];
export const toolRequests = [
  ['phpunit', ['--bootstrap', '/outside/bootstrap.php', '--coverage-html', '/outside/report']],
  ['pest', ['--parallel', '--coverage']], ['paratest', ['--processes=4']],
  ['phpstan', ['analyse', '--configuration=/outside/phpstan.neon']],
  ['psalm', ['--alter', '--issues=all']], ['phpcs', ['--standard=/outside/ruleset.xml', 'src']],
  ['phpcbf', ['--standard=PSR12', 'src']], ['php-cs-fixer', ['fix', '--dry-run']],
  ['pint', ['--test']], ['rector', ['process', '--dry-run']], ['phan', ['--config-file', '/outside/config.php']],
  ['phpmd', ['src', 'xml', '/outside/rules.xml']], ['infection', ['--threads=4']],
  ['laravel', ['new', 'example']], ['sail', ['up', '-d']],
];
const rows = [
  [['php', '-n', '-v'], allow], [['php', '-n', '--version'], allow],
  [['php', '-n', '-h'], allow], [['php', '-n', '--help'], allow],
  [['php', '-n', '-m'], allow], [['php', '-n', '--modules'], allow],
  [['php', '-n', '-l', 'example.php'], routine],
  [['php', '-l', '-n', 'example.php'], routine],
  [['php', '--no-php-ini', '--syntax-check', 'example.php', 'other.php'], routine],
  [['php', '-n', '-q', '-l', '--', 'example.php'], routine],
  [['php', '-n', '-l', '/outside/example.php'], deny],
  [['php', '-n', '-l', '.git/config'], deny], [['php', '-n', '-l', '.env'], deny],
  [['php', '-n', '-l', 'example.php', '/outside/example.php'], deny],
  [['php', '-n', '-l'], review], [['php', '-n', '-l', '-'], review],
  [['php', '-l', 'example.php'], review], [['php', '-n', '-d', 'extension=/outside/extension.so', '-l', 'example.php'], review],
  [['php', '-n', '-c', '/outside/php.ini', '-l', 'example.php'], review],
  [['php', '-n', '-r', 'echo 1;', '-l', 'example.php'], review],
  [['php', '-n', '-f', 'example.php'], review], [['php', '-r', 'echo 1;'], review],
  [['php', '-R', 'echo $argn;'], review], [['php', '-B', 'echo 1;', '-F', 'script.php'], review],
  [['php', '-S', '0.0.0.0:8000', '-t', '/outside'], review],
  [['php', '-v'], review], [['php', '--help'], review], [['php', '-i'], review],
  [['php', '-n', '-i'], review], [['php'], review], [['php', 'script.php', '--version'], review],
  [['php', 'composer.phar', 'install', '--no-plugins', '--no-scripts'], review],
  [['composer', '--no-plugins', '--no-scripts', 'install'], review],
  [['composer', '--working-dir=/outside', 'update'], review],
  [['composer', 'global', 'require', 'example/package'], review],
  [['composer', 'config', '--global', '--auth', 'github-oauth.github.com', 'example'], review],
  [['composer', 'exec', '--', 'php', '-r', 'echo 1;'], review],
  [['composer', 'publish'], review],
  [['php', '-n', 'vendor/bin/phpunit', '--list-tests'], review],
  [['php', './artisan', 'tinker', '--execute=echo 1;'], review],
  [['php', '-n', '-f', 'artisan', '--env=production', 'migrate:fresh', '--force'], destructive],
  [['php', '--file=artisan', 'db:wipe', '--force'], destructive],
  [['php', 'artisan', '--help', 'migrate:fresh'], destructive],
  [['artisan', 'migrate:fresh', '--pretend'], destructive],
  [['sail', 'artisan', 'migrate:fresh', '--force'], destructive],
  [['php', '-n', '-l', '--future-option', 'example.php'], review],
  [['php', 'script.php', '-n', '-l'], review],
  [['php', '-n', 'script.php', '-l'], review],
  [['composer', 'future-command'], review], [['artisan', 'future:command'], review],
];

export function phpCases() {
  return {schema_version: 1, cases: ['loose', 'recommended', 'strict'].flatMap((profile, index) => [
    ...rows.map(([argv, expected], n) => ({name: `request-${n}-${profile}`, profile, argv, expected: expected[index]})),
    ...composerOperations.map((command, n) => ({name: `composer-${n}-${profile}`, profile, argv: ['composer', command], expected: review[index]})),
    ...artisanOperations.map((command, n) => ({name: `artisan-${n}-${profile}`, profile, argv: ['php', 'artisan', command], expected: review[index]})),
    ...destructiveCommands.flatMap((command, n) => [
      {name: `php-artisan-delete-${n}-${profile}`, profile, argv: ['php', 'artisan', command, '--force'], expected: destructive[index]},
      {name: `artisan-delete-${n}-${profile}`, profile, argv: ['./artisan', command], expected: destructive[index]},
    ]),
    ...toolRequests.flatMap(([command, args], n) => [
      {name: `tool-${n}-${profile}`, profile, argv: [command, ...args], expected: review[index]},
      {name: `vendor-${n}-${profile}`, profile, argv: [`./vendor/bin/${command}`, '--version'], expected: review[index]},
    ]),
    {name: `absolute-php-${profile}`, profile, argv: ['/opt/homebrew/bin/php', '-n', '-v'], expected: 'allow'},
    {name: `unknown-php-${profile}`, profile, argv: ['/tmp/untrusted/php', '-n', '-v'], expected: 'ask'},
    ...[['php -n -l example.php', routine], ['php artisan migrate:fresh --force', destructive],
      ['composer install --no-plugins --no-scripts', review]].map(([source, expected], n) => ({name: `shell-${n}-${profile}`,
      profile, expected: expected[index], input: {kind: 'shell', source, dialect: 'bash', dialect_version: null, original_input: {}},
    })),
  ])};
}

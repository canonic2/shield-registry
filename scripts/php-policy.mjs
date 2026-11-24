import {executableForms} from './tool-pack.mjs';

export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
export const tools = {
  php: {operations: ['script', 'inline', 'stdin', 'interactive', 'server', 'lint'], source: 'https://www.php.net/manual/en/features.commandline.options.php'},
  composer: {operations: ['init', 'install', 'i', 'update', 'u', 'upgrade', 'require', 'remove', 'reinstall', 'bump', 'check-platform-reqs',
    'global', 'search', 'show', 'info', 'outdated', 'browse', 'home', 'suggests', 'fund', 'depends', 'why', 'prohibits', 'why-not',
    'validate', 'status', 'diagnose', 'archive', 'create-project', 'dump-autoload', 'dumpautoload', 'clear-cache', 'clearcache',
    'config', 'exec', 'run-script', 'run', 'licenses', 'audit', 'self-update', 'selfupdate', 'completion', 'list', 'help'],
  source: 'https://getcomposer.org/doc/03-cli.md'},
  phpunit: {operations: ['test', 'list', 'coverage', 'bootstrap'], source: 'https://docs.phpunit.de/en/12.5/textui.html'},
  pest: {operations: ['test', 'parallel', 'coverage', 'mutate'], source: 'https://pestphp.com/docs/cli-api-reference'},
  paratest: {operations: ['test', 'parallel'], source: 'https://github.com/paratestphp/paratest'},
  phpstan: {operations: ['analyse', 'analyze', 'clear-result-cache', 'diagnose', 'dump-parameters'], source: 'https://phpstan.org/user-guide/command-line-usage'},
  psalm: {operations: ['analyse', 'alter', 'init', 'baseline', 'language-server'], source: 'https://github.com/vimeo/psalm'},
  phpcs: {operations: ['check', 'report', 'config-set', 'config-delete'], source: 'https://github.com/PHPCSStandards/PHP_CodeSniffer'},
  phpcbf: {operations: ['fix'], source: 'https://github.com/PHPCSStandards/PHP_CodeSniffer'},
  'php-cs-fixer': {operations: ['fix', 'check', 'describe', 'list-files'], source: 'https://cs.symfony.com/doc/usage.html'},
  pint: {operations: ['fix', 'test', 'dirty', 'repair'], source: 'https://laravel.com/framework/docs/13.x/pint'},
  rector: {operations: ['process', 'list-rules', 'setup-ci'], source: 'https://getrector.com/documentation/cli-options'},
  phan: {operations: ['analyse', 'daemon', 'language-server'], source: 'https://github.com/phan/phan'},
  phpmd: {operations: ['analyse', 'baseline', 'report'], source: 'https://phpmd.org/documentation/index.html'},
  infection: {operations: ['test', 'coverage', 'mutation'], source: 'https://infection.github.io/guide/command-line-options.html'},
  artisan: {operations: ['list', 'help', 'about', 'test', 'serve', 'tinker', 'route:list', 'route:cache', 'route:clear', 'config:show',
    'config:cache', 'config:clear', 'cache:clear', 'cache:forget', 'optimize', 'optimize:clear', 'view:cache', 'view:clear',
    'event:list', 'event:cache', 'event:clear', 'make:model', 'make:migration', 'make:controller', 'make:test',
    'migrate', 'migrate:status', 'migrate:install', 'migrate:rollback', 'migrate:reset', 'migrate:refresh', 'migrate:fresh',
    'db', 'db:show', 'db:table', 'db:seed', 'db:wipe', 'schema:dump', 'key:generate', 'env:encrypt', 'env:decrypt',
    'queue:work', 'queue:listen', 'queue:restart', 'queue:retry', 'queue:clear', 'queue:flush', 'queue:forget',
    'schedule:list', 'schedule:run', 'schedule:work', 'schedule:clear-cache', 'storage:link', 'storage:unlink',
    'vendor:publish', 'package:discover', 'down', 'up', 'horizon', 'horizon:terminate', 'horizon:clear'],
  source: 'https://laravel.com/framework/docs/13.x/artisan'},
  laravel: {operations: ['new', 'install', 'list', 'help'], source: 'https://laravel.com/framework/docs/13.x/installation'},
  sail: {operations: ['up', 'down', 'build', 'test', 'artisan', 'php', 'composer', 'shell', 'root-shell', 'share'], source: 'https://laravel.com/framework/docs/13.x/sail'},
};
// Larastan is a PHPStan extension and uses phpstan's entry point.
export const commands = Object.keys(tools);
export const discoveryCommands = ['php', 'composer', 'phpunit', 'pest', 'paratest', 'phpstan', 'psalm', 'phpcs', 'phpcbf',
  'php-cs-fixer', 'pint', 'rector', 'phpmd', 'artisan', 'laravel', 'sail'];
const review = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const destructive = {loose: 'ask', recommended: 'deny', strict: 'deny'};
const routine = {loose: 'allow', recommended: 'allow', strict: 'ask'};
const protectedPaths = ['.git', '.shield', '.ssh', '.aws', '.env', '.mcp.json', '.codex', '.claude'];
export const destructiveArtisan = ['migrate:fresh', 'migrate:refresh', 'migrate:reset', 'migrate:rollback', 'db:wipe',
  'key:generate', 'env:decrypt', 'queue:clear', 'queue:flush', 'queue:forget', 'horizon:clear'];
const executable = name => ({one_of: [...executableForms(name), ...(name === 'php' ? []
  : [`vendor/bin/${name}`, `./vendor/bin/${name}`, ...(name === 'artisan' ? ['./artisan'] : [])])]});

export function phpPack() {
  const rules = [];
  const add = (name, id, args, decision, reason, extra = {}) => {
    const rule = {id: `${name}-${id}`, conditions: {domain: 'argv', executable: executable(name), arguments: args}, decision, reason, ...extra};
    rules.push(rule);
    return rule;
  };
  for (const name of commands) add(name, 'review', {kind: 'any'}, review,
    'Review PHP startup configuration, project code, plugins, dependencies, files, credentials, network access and persistent processes.', {fallback: true});
  for (const mode of ['-v', '--version', '-h', '--help', '-m', '--modules'])
    add('php', `isolated-${mode.replaceAll('-', '')}`, {kind: 'exact', values: ['-n', mode]}, 'allow',
      'Print PHP version, help or compiled module metadata without loading php.ini.');
  // Parse PHP options separately from permissions. Competing modes and INI
  // overrides remain reviewable. Unknown syntax cannot establish isolated lint.
  const flags = ['-n', '--no-php-ini', '-l', '--syntax-check', '-e', '--profile-info', '-q', '--no-header', '-H', '--hide-args',
    '-a', '--interactive', '-h', '--help', '--usage', '-i', '--info', '-m', '--modules', '-v', '--version',
    '-s', '--syntax-highlight', '--syntax-highlighting', '-w', '--strip', '--ini'];
  const values = ['-c', '--php-ini', '-d', '--define', '-f', '--file', '-r', '--run', '-B', '--process-begin',
    '-R', '--process-code', '-F', '--process-file', '-E', '--process-end', '-S', '--server', '-t', '--docroot',
    '-z', '--zend-extension', '--rf', '--rfunction', '--rc', '--rclass', '--re', '--rextension', '--rz', '--rzendextension', '--ri', '--rextinfo'];
  const forbid = [...flags.filter(flag => !['-n', '--no-php-ini', '-l', '--syntax-check', '-e', '--profile-info', '-q', '--no-header', '-H', '--hide-args'].includes(flag)), ...values];
  for (const isolated of ['-n', '--no-php-ini']) {
    const grammar = {kind: 'options', prefix: [], flags, values, parse: 'stop_at_operand', operands: {match: {regex: '[^-\\x00\\r\\n][^\\x00\\r\\n]*'}, min: 1, max: 32},
      require_all: [isolated], require_any: ['-l', '--syntax-check'], forbid};
    const lint = add('php', `isolated-lint-${isolated.replaceAll('-', '')}`, grammar, routine,
      'Parse PHP source for syntax errors without executing it or loading php.ini.');
    lint.conditions.cwd = {within: {root: 'read'}};
    lint.requirements = {argument_paths: {grammar, operands: {path: {within: {root: 'read'},
      exclude: protectedPaths.map(path => ({root: 'project', path}))}}}};
    lint.on_unmet = {decision: 'deny', message: 'Lint source files inside approved readable roots away from protected state.'};
  }
  // These scans only tighten decisions. A command token anywhere in the PHP
  // or Sail argv may be forwarded by an application or container entry point.
  for (const name of ['php', 'artisan', 'sail']) add(name, 'destructive-artisan',
    {kind: 'risk_tokens', prefix: [], any_of: destructiveArtisan}, destructive,
    'Review rollback/reset, database deletion, key rotation, decrypted secrets and queue deletion.');
  return {schema_version: 1, kind: 'pack', id: 'canonic/php', version,
    description: 'PHP, Composer, testing and quality tools, and Laravel/Artisan workflows with isolated lint and reviewed project execution.',
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    capabilities: ['structured-rules-v1', 'argument-rules-v1', 'argument-paths-v1', 'location-v1', 'access-paths-v1',
      'requirements-v1', 'regex-v1', 'fallback-rules-v1'], rules};
}

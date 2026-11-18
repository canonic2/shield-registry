// Reviewed Docker CLI surface of Docker 29.9.2 with Buildx and Compose v2:
// `docker --help`, `docker create --help` (the `run` table plus run's
// -d/--detach, --detach-keys and --sig-proxy), `docker exec`, `cp`,
// `buildx build`, `buildx bake` and `compose` help, and the Docker CLI
// reference for `volume create`, `save`, `load`, `import` and `export`.
// Expected decisions live independently in docker-cases.mjs.
//
// Containers are the sandbox: running, building and managing local containers,
// images, networks and volumes is allowed. The pack reviews the forms that
// break out of it or reach beyond the project: host bind mounts and driver
// options, privileged and host-namespace runtimes, the daemon socket, host
// files outside the project, build secrets and SSH agents, registry
// publication and credentials, daemon-wide configuration and data removal.
//
// Option tables below describe the tool so Shield can find operands; they are
// parsing data, not permissions. Decisions come from the value constraints,
// forbidden options, path checks and risk scans.

export const version = '0.1.0';
export const engine = '>=0.20.0, <1.0.0';

const profiles = (loose, recommended = loose, strict = recommended) => ({loose, recommended, strict});
export const decisions = {
  inspect: profiles('allow'),
  routine: profiles('allow', 'allow', 'ask'),
  configure: profiles('allow', 'ask', 'ask'),
  review: profiles('ask'),
  remote: profiles('ask', 'ask', 'deny'),
  credential: profiles('ask', 'ask', 'deny'),
  system: profiles('ask', 'ask', 'deny'),
  destroy: profiles('ask', 'ask', 'deny'),
  host: profiles('ask', 'ask', 'deny'),
  unlisted: profiles('ask'),
};

export const executables = {
  docker: ['docker', '/usr/bin/docker', '/usr/local/bin/docker', '/opt/homebrew/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker'],
  'docker-compose': ['docker-compose', '/usr/bin/docker-compose', '/usr/local/bin/docker-compose',
    '/opt/homebrew/bin/docker-compose', '/Applications/Docker.app/Contents/Resources/bin/docker-compose'],
};

// Named (`cache:/data`) and anonymous (`/data`) volumes stay inside Docker.
// Anything else names a host path: `.`, `/`, `~`, `..`, a drive letter or an
// unexpanded variable. Volume names are at least two characters, so `C:/x`
// cannot pass as one.
const volumeValue = {regex: '^(?:/[^:]*|[A-Za-z0-9][A-Za-z0-9_.-]+:/[^:]*(?::[A-Za-z,]+)?)$'};
// `--mount` with volume or tmpfs fields only: no bind, image or cluster type,
// volume driver or driver options (which can bind host directories).
const mountField = ['type=(?:volume|tmpfs)', '(?:source|src)=[A-Za-z0-9][A-Za-z0-9_.-]+', '(?:target|destination|dst)=/[^,]*',
  '(?:readonly|ro|volume-nocopy)(?:=(?:true|false|1|0))?', 'volume-subpath=[^,]*', 'tmpfs-(?:size|mode)=[^,]*', 'consistency=[a-z]+'];
const mountValue = {regex: `^(?:(?:${mountField.join('|')})(?:,|$))+$`};
const notHost = {not: {exact: 'host'}};
const securityValue = {regex: '^no-new-privileges(?:[:=]true)?$'};

const runFlags = ['--help', '--init', '-i', '--interactive', '--no-healthcheck', '--oom-kill-disable', '--privileged',
  '-P', '--publish-all', '-q', '--quiet', '--read-only', '--rm', '-t', '--tty', '--use-api-socket'];
const runValues = ['--add-host', '--annotation', '-a', '--attach', '--blkio-weight', '--blkio-weight-device', '--cap-add',
  '--cap-drop', '--cgroup-parent', '--cidfile', '--cpu-period', '--cpu-quota', '--cpu-rt-period', '--cpu-rt-runtime',
  '-c', '--cpu-shares', '--cpus', '--cpuset-cpus', '--cpuset-mems', '--device', '--device-cgroup-rule', '--device-read-bps',
  '--device-read-iops', '--device-write-bps', '--device-write-iops', '--dns', '--dns-option', '--dns-search', '--domainname',
  '--entrypoint', '-e', '--env', '--env-file', '--expose', '--gpus', '--group-add', '--health-cmd', '--health-interval',
  '--health-retries', '--health-start-interval', '--health-start-period', '--health-timeout', '-h', '--hostname', '--ip',
  '--ip6', '--isolation', '-l', '--label', '--label-file', '--link', '--link-local-ip', '--log-driver', '--log-opt',
  '--mac-address', '-m', '--memory', '--memory-reservation', '--memory-swap', '--memory-swappiness', '--name',
  '--network-alias', '--oom-score-adj', '--pids-limit', '--platform', '-p', '--publish', '--pull', '--restart', '--runtime',
  '--shm-size', '--stop-signal', '--stop-timeout', '--storage-opt', '--sysctl', '--tmpfs', '--ulimit', '--umask', '-u',
  '--user', '--volume-driver', '--volumes-from', '-w', '--workdir',
  {name: '-v', match: volumeValue}, {name: '--volume', match: volumeValue}, {name: '--mount', match: mountValue},
  {name: '--security-opt', match: securityValue},
  ...['--network', '--net', '--pid', '--ipc', '--uts', '--userns', '--cgroupns'].map(name => ({name, match: notHost}))];

const grammars = {
  create: {flags: runFlags, values: runValues, parse: 'stop_at_operand'},
  run: {flags: [...runFlags, '-d', '--detach'], values: [...runValues, '--detach-keys'], optional: ['--sig-proxy'], parse: 'stop_at_operand'},
  exec: {flags: ['--help', '-d', '--detach', '-i', '--interactive', '--privileged', '-t', '--tty'],
    values: ['--detach-keys', '-e', '--env', '--env-file', '-u', '--user', '-w', '--workdir'], parse: 'stop_at_operand'},
  build: {flags: ['--help', '--check', '-D', '--debug', '--load', '--no-cache', '--pull', '--push', '-q', '--quiet'],
    values: ['--add-host', '--allow', '--annotation', '--attest', '--build-arg', '--build-context', '--builder', '--cache-from',
      '--cache-to', '--call', '--cgroup-parent', '-f', '--file', '--iidfile', '--label', '--metadata-file',
      {name: '--network', match: notHost}, '--no-cache-filter', '-o', '--output', '--platform', '--policy', '--progress',
      '--provenance', '--resource', '--sbom', '--shm-size', '--ssh', '-t', '--tag', '--target', '--ulimit', '--secret']},
  bake: {flags: ['--help', '--check', '-D', '--debug', '--load', '--no-cache', '--print', '--pull', '--push'],
    values: ['--allow', '--builder', '--call', '-f', '--file', '-j', '--jobs', '--list', '--metadata-file', '--policy',
      '--progress', '--provenance', '--sbom', '--set', '--var']},
  cp: {flags: ['--help', '-a', '--archive', '-L', '--follow-link', '-q', '--quiet'], values: []},
  save: {flags: ['--help'], values: ['-o', '--output', '--platform']},
  load: {flags: ['--help', '-q', '--quiet'], values: ['-i', '--input', '--platform']},
  import: {flags: ['--help'], values: ['-c', '--change', '-m', '--message', '--platform']},
  export: {flags: ['--help'], values: ['-o', '--output']},
  volumeCreate: {flags: ['--help'], values: ['--availability', '-d', '--driver', '--group', '--label', '--limit-bytes',
    '-o', '--opt', '--required-bytes', '--scope', '--sharing', '--topology-preferred', '--topology-required', '--type', '--secret']},
  // Compose's own options come before its subcommand; parsing stops there, so
  // subcommand options such as `logs -f` are not mistaken for `--file`.
  compose: {flags: ['--help', '--all-resources', '--compatibility', '--dry-run'],
    values: ['--ansi', '--env-file', '-f', '--file', '--parallel', '--profile', '--progress', '--project-directory',
      '-p', '--project-name'], parse: 'stop_at_operand'},
};

// Explicitly named files must stay inside the approved roots and away from
// version control, Shield state, credentials and agent settings.
const protectedPaths = ['.shield', '.git', '.aws', '.ssh', '.env', '.mcp.json', '.codex', '.claude', '.docker'];
const pathCheck = root => ({path: {within: {root}, exclude: protectedPaths.map(path => ({root: 'project', path}))}});
const read = names => Object.fromEntries(names.map(name => [name, 'read']));
const write = names => Object.fromEntries(names.map(name => [name, 'write']));

// [id, executable, words, grammar, category, reason, {forbid, paths, operands}]
// Each becomes an allowance whose declared options all parse, whose values
// meet their constraints and whose files are in approved paths, plus a review
// rule for every other form of the same command.
const runtime = {forbid: ['--privileged', '--cap-add', '--device', '--device-cgroup-rule', '--volumes-from',
  '--volume-driver', '--use-api-socket'], paths: {...read(['--env-file', '--label-file']), ...write(['--cidfile'])}};
// Shield's credential scan reads the item after `--secret` as its value, so
// `--secret` ends every list that names it.
const build = {forbid: ['--allow', '--build-context', '--cache-to', '-o', '--output', '--push', '--ssh', '--secret'],
  paths: {...read(['-f', '--file']), ...write(['--iidfile', '--metadata-file'])}, operands: 'read'};
const runReason = 'Run a container from an image, with named or anonymous volumes and no host privileges.';
const checked = [
  ...[['run'], ['container', 'run']].map(words => [words, 'run', runReason, runtime]),
  ...[['create'], ['container', 'create']].map(words => [words, 'create', 'Create a container from an image, with named or anonymous volumes and no host privileges.', runtime]),
  ...[['exec'], ['container', 'exec']].map(words => [words, 'exec', 'Run a command in a running container.',
    {forbid: ['--privileged'], paths: read(['--env-file'])}]),
  ...[['build'], ['buildx', 'build'], ['buildx', 'b'], ['builder', 'build'], ['image', 'build']].map(words =>
    [words, 'build', 'Build an image from a project context, keeping the result in the local image store.', build]),
  ...[['bake'], ['buildx', 'bake'], ['buildx', 'f']].map(words => [words, 'bake', 'Build the project\'s bake targets.',
    {forbid: ['--allow', '--push', '--set'], paths: {...read(['-f', '--file']), ...write(['--metadata-file'])}}]),
  ...[['cp'], ['container', 'cp']].map(words => [words, 'cp', 'Copy files between a container and the project.', {operands: 'write'}]),
  ...[['save'], ['image', 'save']].map(words => [words, 'save', 'Save images to a project archive.', {paths: write(['-o', '--output'])}]),
  ...[['load'], ['image', 'load']].map(words => [words, 'load', 'Load images from a project archive.', {paths: read(['-i', '--input'])}]),
  ...[['import'], ['image', 'import']].map(words => [words, 'import', 'Create an image from a project archive.', {operands: 'read'}]),
  ...[['export'], ['container', 'export']].map(words => [words, 'export', 'Export a container filesystem to a project archive.', {paths: write(['-o', '--output'])}]),
  [['volume', 'create'], 'volumeCreate', 'Create a named volume with the default driver.', {forbid: ['-d', '--driver', '-o', '--opt']}],
].map(([words, grammar, reason, checks]) => ['docker', words, grammar, 'routine', reason, checks]);
const composeChecks = {paths: read(['-f', '--file', '--env-file', '--project-directory'])};
const composeReason = 'Run the project\'s Compose application; its compose files are project code.';
checked.push(['docker', ['compose'], 'compose', 'routine', composeReason, composeChecks],
  ['docker-compose', [], 'compose', 'routine', composeReason, composeChecks]);

const words = (rows, category, reason) => rows.map(row => [row.split(' '), category, reason]);
const commands = [
  ...words(['version', 'info', 'ps', 'images', 'inspect', 'logs', 'top', 'stats', 'port', 'diff', 'history', 'events', 'search',
    'wait', 'container ls', 'container list', 'container ps', 'container inspect', 'container logs', 'container top',
    'container stats', 'container port', 'container diff', 'container wait', 'image ls', 'image list', 'image inspect',
    'image history', 'network ls', 'network list', 'network inspect', 'volume ls', 'volume list', 'volume inspect',
    'context ls', 'context list', 'context show', 'context inspect', 'system df', 'system info', 'system events',
    'buildx ls', 'buildx inspect', 'buildx du', 'buildx version', 'buildx history ls', 'buildx history inspect',
    'buildx history logs', 'buildx imagetools inspect', 'manifest inspect', 'plugin ls', 'plugin list', 'plugin inspect',
    'node ls', 'node inspect', 'node ps', 'service ls', 'service inspect', 'service ps', 'service logs', 'stack ls',
    'stack ps', 'stack services', 'secret ls', 'secret inspect', 'config ls', 'config inspect', 'trust inspect'],
  'inspect', 'Inspect containers, images, builds and daemon state.'),
  ...words(['start', 'stop', 'restart', 'kill', 'pause', 'unpause', 'rename', 'update', 'attach', 'commit', 'rm', 'rmi', 'tag',
    'pull', 'container start', 'container stop', 'container restart', 'container kill', 'container pause',
    'container unpause', 'container rename', 'container update', 'container attach', 'container commit', 'container rm',
    'container remove', 'image rm', 'image remove', 'image tag', 'image pull', 'image prune', 'builder prune',
    'buildx prune', 'buildx rm', 'buildx stop', 'network create', 'network connect', 'network disconnect', 'network rm',
    'network remove'],
  'routine', 'Manage local containers, images, build cache and networks.'),
  ...words(['logout', 'buildx create', 'buildx use'], 'configure', 'Change the registry login or the builder that receives build contexts.'),
  ...words(['login'], 'credential', 'Store registry credentials.'),
  ...words(['push', 'image push', 'manifest create', 'manifest annotate', 'manifest push', 'buildx imagetools create', 'trust sign', 'trust revoke', 'trust key', 'trust signer'],
    'remote', 'Publish images or signatures to a registry.'),
  ...words(['context create', 'context update', 'context use', 'context rm', 'context remove', 'context import',
    'context export', 'plugin install', 'plugin enable', 'plugin disable', 'plugin upgrade', 'plugin rm', 'plugin remove',
    'plugin create', 'plugin push', 'plugin set', 'swarm', 'node update', 'node rm', 'node remove', 'node promote',
    'node demote', 'service create', 'service update', 'service rm', 'service remove', 'service scale', 'service rollback',
    'stack deploy', 'stack up', 'stack rm', 'stack remove', 'stack down', 'secret create', 'secret rm', 'secret remove',
    'config create', 'config rm', 'config remove'],
  'system', 'Change the daemon a context selects, privileged plugins or cluster state.'),
  ...words(['volume rm', 'volume remove', 'volume prune', 'container prune', 'network prune', 'system prune'],
    'destroy', 'Permanently remove volumes or other projects\' containers and networks.'),
];

// Conservative scans over every token after the prefix. They can only ask or
// deny, so they also catch the same text in a container's own command line.
const risks = [
  ['host-control', 'docker', [], ['--privileged', '--cap-add', '--device', '--device-cgroup-rule', '--use-api-socket',
    {regex: '.*docker\\.sock.*'}], 'host', 'Give a container host devices, capabilities or the Docker daemon, which control the host.'],
  ['build-credentials', 'docker', [], ['--ssh', '--secret'], 'review', 'Expose host secrets or the SSH agent to a build.'],
  ['publish', 'docker', [], ['--push'], 'remote', 'Publish a build to a registry.'],
  ...[['docker', ['compose']], ['docker-compose', []]].flatMap(([executable, prefix]) => {
    const id = executable === 'docker' ? 'compose' : 'docker-compose';
    return [[`${id}-publish`, executable, prefix, ['push', 'publish'], 'remote', 'Publish Compose images or the application to a registry.'],
      [`${id}-files`, executable, prefix, ['cp', '-v', '--volumes', '-o', '--output'], 'review',
        'Copy host files, mount or remove volumes, or write files outside Compose\'s own state.']];
  }),
];

// A project can name the Docker contexts agents may select, such as the one a
// workspace manager pins. Each command rule then has a twin accepting exactly
// one `--context NAME` (or `--context=NAME`) with a listed name before the
// command. The twins reference the setting, so they are inactive while it is
// unset and every global option keeps asking. `-c` and repeated contexts stay
// unlisted, so the Compose scans below cover every accepted prefix.
export const variables = {
  docker_contexts: {
    type: 'list',
    description: 'Docker contexts agents may select with --context, such as the context a workspace manager pins.',
    items: {type: 'string', match: {regex: '^[A-Za-z0-9][A-Za-z0-9_.+-]*$'}, max_length: 128},
    max_items: 16,
    setup: {question: 'Allow agents to select specific Docker contexts with --context?', unset: 'No context selection',
      value: 'These contexts', placeholder: 'desktop-linux'},
  },
};
const contextLeading = {flags: [], values: [{name: '--context', match: {var: 'docker_contexts'}, repeat: 'forbid'}]};
const contextPrefixes = [['--context', {not: {exact: ''}}], [{prefix: '--context='}]];
function withContext(row) {
  const twin = structuredClone(row);
  twin.id = `${row.id}-context`;
  twin.conditions.arguments.leading = structuredClone(contextLeading);
  const grammar = twin.requirements?.argument_paths?.grammar;
  if (grammar) grammar.leading = structuredClone(contextLeading);
  return twin;
}

const idOf = (executable, words) => [...(executable === 'docker' ? [] : [executable]), ...words].join('-') || executable;
const cwd = {within: {root: 'write'}};
const argv = (id, executable, args, category, reason, {project = true} = {}) => ({id,
  conditions: {domain: 'argv', executable: {one_of: executables[executable]}, arguments: args, ...(project ? {cwd} : {})},
  decision: decisions[category], reason});
const declare = values => values.map(value => typeof value === 'string' ? value : {...value, repeat: 'all'});
const options = (words, grammar, extra = {}) => ({kind: 'options', prefix: words, flags: grammar.flags,
  values: declare(grammar.values), ...(grammar.optional ? {optional_values: grammar.optional} : {}),
  operands: true, parse: grammar.parse ?? 'intermixed', ...extra});

export function dockerPack() {
  const rules = [];
  for (const [id, values] of [['version-flag', ['--version']], ['version-short', ['-v']], ['help', ['--help']], ['help-command', ['help']]])
    rules.push(argv(id, 'docker', {kind: 'exact', values}, 'inspect', 'Print the version or built-in help.', {project: false}));
  rules.push(argv('help-topic', 'docker', {kind: 'prefix', values: ['help']}, 'inspect', 'Print built-in help for a command.', {project: false}));
  rules.push(argv('docker-compose-version', 'docker-compose', {kind: 'exact', values: ['version']}, 'inspect', 'Print the version.', {project: false}));

  for (const [executable, words, name, category, reason, checks] of checked) {
    const id = idOf(executable, words);
    const grammar = grammars[name];
    const row = argv(id, executable, options(words, grammar, checks.forbid ? {forbid: checks.forbid} : {}), category, reason);
    if (checks.paths || checks.operands) {
      row.requirements = {argument_paths: {grammar: options(words, grammar),
        ...(checks.paths ? {options: Object.fromEntries(Object.entries(checks.paths).map(([option, root]) => [option, pathCheck(root)]))} : {}),
        ...(checks.operands ? {operands: pathCheck(checks.operands)} : {})}};
      row.on_unmet = {decision: decisions.review,
        message: 'Name files inside the project, away from version control, credentials and agent settings.'};
    }
    rules.push(row);
    if (executable === 'docker') rules.push(withContext(row));
    // Every other form: unparsed or global options, host mounts, privileges,
    // forbidden options or a folder outside the approved roots.
    rules.push(argv(`${id}-review`, executable, {kind: 'prefix', values: words.length ? words : [{not: {exact: ''}}]}, 'review',
      'Review host mounts, privileges, host namespaces, credentials, outputs and options this pack cannot verify.', {project: false}));
    if (words.length) for (const help of ['--help', '-h'].slice(0, name === 'run' || name === 'create' ? 1 : 2))
      rules.push(argv(`${id}-help${help === '-h' ? '-short' : ''}`, executable, {kind: 'exact', values: [...words, help]},
        'inspect', 'Print built-in help for a command.', {project: false}));
  }
  for (const [words, category, reason] of commands) {
    const id = words.join('-');
    const row = argv(id, 'docker', {kind: 'prefix', values: words}, category, reason);
    rules.push(row, withContext(row));
    rules.push(argv(`${id}-help`, 'docker', {kind: 'exact', values: [...words, '--help']}, 'inspect', 'Print built-in help for a command.', {project: false}));
  }
  for (const [id, executable, prefix, tokens, category, reason] of risks) {
    rules.push(argv(id, executable, {kind: 'risk_tokens', prefix, any_of: tokens}, category, reason, {project: false}));
    // Repeat each scan after any one `--context` so a selected context cannot skip it.
    if (executable === 'docker' && prefix.length) contextPrefixes.forEach((context, index) => rules.push(argv(
      `${id}-context${index ? `-${index + 1}` : ''}`, executable, {kind: 'risk_tokens', prefix: [...context, ...prefix], any_of: tokens},
      category, reason, {project: false})));
  }
  for (const executable of Object.keys(executables))
    rules.push({id: executable === 'docker' ? 'unlisted' : 'docker-compose-unlisted',
      conditions: {domain: 'argv', executable: {one_of: executables[executable]}, arguments: {kind: 'any'}}, decision: decisions.unlisted,
      reason: 'Global options, plugins and unlisted Docker commands require review.'});

  return {
    schema_version: 1, kind: 'pack', id: 'canonic/docker', version, license: 'MIT', maintainers: ['Canonic'],
    description: 'Docker containers, images, builds and Compose, reviewing host mounts, privileged runtimes, the daemon socket, build secrets, registry publication, credentials and data removal.',
    engines: {shield: engine},
    capabilities: ['access-paths-v1', 'argument-paths-v1', 'argument-rules-v1', 'location-v1', 'negated-selectors-v1',
      'prefix-leading-v1', 'regex-v1', 'requirements-v1', 'structured-rules-v1', 'variables-v1'],
    variables,
    rules,
  };
}

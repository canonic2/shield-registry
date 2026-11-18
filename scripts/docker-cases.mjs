// Independent expected decisions for canonic/docker, reviewed against Docker
// 29.9.2 with Buildx and Compose v2. Keep these explicit rather than importing
// the policy's tables or deriving expectations from its decisions.
const profiles = ['loose','recommended','strict'];
const allow = ['allow','allow','allow'];
const routine = ['allow','allow','ask'];
const configure = ['allow','ask','ask'];
const review = ['ask','ask','ask'];
const deny = ['ask','ask','deny'];

const d = (...args) => ['docker', ...args];
const cli = [
  // Version, help and inspection, from any folder.
  ['version', d('--version'), allow],
  ['version-short', d('-v'), allow],
  ['help', d('--help'), allow],
  ['help-run', d('help', 'run'), allow],
  ['run-help', d('run', '--help'), allow],
  ['exec-help-short', d('exec', '-h'), allow],
  ['volume-rm-help', d('volume', 'rm', '--help'), allow],
  ['version-command', d('version', '--format', 'json'), allow],
  ['info', d('info'), allow],
  ['ps', d('ps', '-a', '--filter', 'status=exited', '--format', '{{.Names}}'), allow],
  ['container-ls', d('container', 'ls', '--all', '--no-trunc'), allow],
  ['images', d('images', '--digests'), allow],
  ['image-ls', d('image', 'ls', '-q'), allow],
  ['inspect', d('inspect', '--type', 'container', 'acme-web'), allow],
  ['logs', d('logs', '-f', '--tail', '100', 'acme-web'), allow],
  ['container-logs', d('container', 'logs', '--since', '10m', 'acme-web'), allow],
  ['top', d('top', 'acme-web'), allow],
  ['stats', d('stats', '--no-stream'), allow],
  ['port', d('port', 'acme-web', '80'), allow],
  ['diff', d('diff', 'acme-web'), allow],
  ['history', d('history', 'acme/web:1.0'), allow],
  ['events', d('events', '--since', '1h'), allow],
  ['search', d('search', 'postgres'), allow],
  ['wait', d('wait', 'acme-web'), allow],
  ['network-ls', d('network', 'ls'), allow],
  ['volume-inspect', d('volume', 'inspect', 'acme-data'), allow],
  ['context-ls', d('context', 'ls'), allow],
  ['context-show', d('context', 'show'), allow],
  ['system-df', d('system', 'df', '-v'), allow],
  ['buildx-ls', d('buildx', 'ls'), allow],
  ['buildx-du', d('buildx', 'du'), allow],
  ['buildx-history-ls', d('buildx', 'history', 'ls'), allow],
  ['imagetools-inspect', d('buildx', 'imagetools', 'inspect', 'acme/web:1.0'), allow],
  ['manifest-inspect', d('manifest', 'inspect', 'acme/web:1.0'), allow],
  ['trust-inspect', d('trust', 'inspect', 'acme/web:1.0'), allow],
  ['service-logs', d('service', 'logs', 'acme_web'), allow],

  // Local container, image and network lifecycle.
  ['start', d('start', 'acme-web'), routine],
  ['stop', d('stop', '-t', '5', 'acme-web'), routine],
  ['restart', d('container', 'restart', 'acme-web'), routine],
  ['kill', d('kill', '--signal', 'HUP', 'acme-web'), routine],
  ['rm', d('rm', '-f', 'acme-web'), routine],
  ['rm-anonymous-volumes', d('rm', '-fv', 'acme-web'), routine],
  ['rmi', d('rmi', 'acme/web:old'), routine],
  ['image-rm', d('image', 'rm', 'acme/web:old'), routine],
  ['tag', d('tag', 'acme/web:1.0', 'acme/web:latest'), routine],
  ['pull', d('pull', '--platform', 'linux/amd64', 'postgres:17'), routine],
  ['commit', d('commit', 'acme-web', 'acme/web:debug'), routine],
  ['image-prune', d('image', 'prune', '-f'), routine],
  ['builder-prune', d('builder', 'prune', '--all', '-f'), routine],
  ['buildx-prune', d('buildx', 'prune', '-f'), routine],
  ['network-create', d('network', 'create', 'acme-net'), routine],
  ['network-connect', d('network', 'connect', 'acme-net', 'acme-web'), routine],
  ['volume-create', d('volume', 'create', 'acme-data'), routine],
  ['volume-create-label', d('volume', 'create', '--label', 'team=acme', 'acme-data'), routine],

  // Running containers: images execute inside Docker's isolation.
  ['run', d('run', '--rm', 'alpine', 'echo', 'hello'), routine],
  ['run-interactive-cluster', d('run', '-it', '--rm', 'alpine', 'sh'), routine],
  ['run-detached', d('run', '-d', '--name', 'acme-db', '-e', 'POSTGRES_PASSWORD=example', '-p', '5432:5432', 'postgres:17'), routine],
  ['run-attached-publish', d('run', '-dp', '127.0.0.1:8080:80', 'nginx'), routine],
  ['run-named-volume', d('run', '--rm', '-v', 'acme-data:/var/lib/postgresql/data', 'postgres:17'), routine],
  ['run-named-volume-ro', d('run', '--rm', '--volume=acme-cache:/cache:ro', 'alpine', 'ls', '/cache'), routine],
  ['run-anonymous-volume', d('run', '--rm', '-v', '/data', 'alpine'), routine],
  ['run-volume-mount', d('run', '--rm', '--mount', 'type=volume,src=acme-data,dst=/data', 'alpine'), routine],
  ['run-tmpfs-mount', d('run', '--rm', '--mount', 'type=tmpfs,destination=/tmp,tmpfs-size=64m', 'alpine'), routine],
  ['run-tmpfs', d('run', '--rm', '--tmpfs', '/run', 'alpine'), routine],
  ['run-network', d('run', '--rm', '--network', 'acme-net', 'alpine'), routine],
  ['run-container-pid', d('run', '--rm', '--pid', 'container:acme-web', 'alpine', 'ps'), routine],
  ['run-cap-drop', d('run', '--rm', '--cap-drop', 'ALL', '--read-only', 'alpine'), routine],
  ['run-no-new-privileges', d('run', '--rm', '--security-opt', 'no-new-privileges', 'alpine'), routine],
  ['run-sig-proxy', d('run', '--sig-proxy=false', '--rm', 'alpine'), routine],
  ['run-gpus', d('run', '--rm', '--gpus', 'all', 'acme/ml'), routine],
  ['run-env-file', d('run', '--rm', '--env-file', 'config/dev.env', 'alpine', 'env'), routine],
  ['run-container-args', d('run', '--rm', 'alpine', 'ls', '-v', '/etc:/x'), routine],
  ['container-run', d('container', 'run', '--rm', 'alpine', 'true'), routine],
  ['create', d('create', '--name', 'acme-web', '-p', '8080:80', 'nginx'), routine],
  ['container-create', d('container', 'create', '-v', 'acme-data:/data', 'alpine'), routine],
  ['exec', d('exec', '-it', 'acme-web', 'sh'), routine],
  ['exec-user', d('exec', '-u', 'root', '-w', '/app', 'acme-web', 'npm', 'test'), routine],
  ['container-exec', d('container', 'exec', '-e', 'DEBUG=1', 'acme-web', 'env'), routine],

  // Builds from the project.
  ['build', d('build', '-t', 'acme/web:dev', '.'), routine],
  ['build-file', d('build', '-f', 'docker/Dockerfile', '--target', 'test', '--build-arg', 'NODE_ENV=test', '.'), routine],
  ['build-load', d('buildx', 'build', '--load', '--platform', 'linux/arm64', '-t', 'acme/web:dev', '.'), routine],
  ['build-cache-from', d('buildx', 'build', '--cache-from', 'type=registry,ref=acme/web:cache', '.'), routine],
  ['build-iidfile', d('build', '--iidfile', 'build/image-id', '.'), routine],
  ['build-git-context', d('build', 'https://github.com/acme/web.git#main'), routine],
  // Shield reports `-` in a checked path operand as unavailable evidence, so a
  // stdin context asks until argument paths model standard input.
  ['build-stdin', d('build', '-'), review],
  ['builder-build', d('builder', 'build', '.'), routine],
  ['image-build', d('image', 'build', '-q', '.'), routine],
  ['bake', d('buildx', 'bake'), routine],
  ['bake-target', d('bake', '-f', 'docker-bake.hcl', 'test'), routine],
  ['bake-print', d('buildx', 'bake', '--print'), routine],

  // Files moved between Docker and the project.
  ['cp-out', d('cp', 'acme-web:/app/coverage', 'coverage'), routine],
  ['cp-in', d('cp', 'fixtures/seed.sql', 'acme-db:/tmp/seed.sql'), routine],
  ['container-cp', d('container', 'cp', '-a', 'acme-web:/var/log', 'logs'), routine],
  ['save', d('save', '-o', 'build/web.tar', 'acme/web:1.0'), routine],
  ['load', d('load', '-i', 'build/web.tar'), routine],
  ['import', d('import', 'build/rootfs.tar', 'acme/rootfs:1.0'), routine],
  ['export', d('export', '-o', 'build/web-fs.tar', 'acme-web'), routine],

  // Compose applications are project code.
  ['compose-up', d('compose', 'up', '-d', '--build'), routine],
  ['compose-file', d('compose', '-f', 'compose.yaml', '-f', 'compose.test.yaml', 'up', '--abort-on-container-exit'), routine],
  ['compose-logs-follow', d('compose', 'logs', '-f', 'web'), routine],
  ['compose-ps', d('compose', 'ps'), routine],
  ['compose-exec', d('compose', 'exec', 'web', 'npm', 'test'), routine],
  ['compose-run', d('compose', 'run', '--rm', 'web', 'npm', 'test'), routine],
  ['compose-down', d('compose', 'down', '--remove-orphans'), routine],
  ['compose-project', d('compose', '-p', 'acme', '--profile', 'debug', 'up'), routine],
  ['compose-env-file', d('compose', '--env-file', 'config/dev.env', 'up'), routine],
  ['docker-compose', ['docker-compose', 'up', '-d'], routine],
  ['docker-compose-file', ['docker-compose', '-f', 'compose.yaml', 'down'], routine],
  ['docker-compose-version', ['docker-compose', 'version'], allow],

  // Registry login and builder selection.
  ['logout', d('logout'), configure],
  ['buildx-create', d('buildx', 'create', '--use', '--driver', 'docker-container'), configure],
  ['buildx-use', d('buildx', 'use', 'acme-builder'), configure],

  // Host bind mounts: Shield cannot verify a compound volume value.
  ['run-bind-project', d('run', '--rm', '-v', '.:/app', 'node:24', 'npm', 'test'), review],
  ['run-bind-relative', d('run', '--rm', '-v', './src:/app/src', 'node:24'), review],
  ['run-bind-parent', d('run', '--rm', '-v', '..:/x', 'alpine'), review],
  ['run-bind-absolute', d('run', '--rm', '-v', '/etc:/host-etc:ro', 'alpine'), review],
  ['run-bind-home', d('run', '--rm', '-v', '~/.ssh:/root/.ssh', 'alpine'), review],
  ['run-bind-attached', d('run', '--rm', '-v/etc:/x', 'alpine'), review],
  ['run-bind-equals', d('run', '--rm', '--volume=/:/host', 'alpine'), review],
  ['run-bind-after-volume', d('run', '--rm', '-v', 'acme-data:/data', '-v', '/etc:/x', 'alpine'), review],
  ['run-bind-cluster', d('run', '-itv', '/etc:/x', 'alpine'), review],
  ['run-bind-drive', d('run', '--rm', '-v', 'C:/Users:/x', 'alpine'), review],
  ['run-mount-bind', d('run', '--rm', '--mount', 'type=bind,src=/,dst=/host', 'alpine'), review],
  ['run-mount-bind-late', d('run', '--rm', '--mount', 'src=acme-data,dst=/data,type=bind', 'alpine'), review],
  ['run-mount-driver-bind', d('run', '--rm', '--mount', 'src=acme,dst=/x,volume-opt=type=none,volume-opt=o=bind,volume-opt=device=/etc', 'alpine'), review],
  ['run-volumes-from', d('run', '--rm', '--volumes-from', 'acme-web', 'alpine'), review],
  ['run-volume-driver', d('run', '--rm', '--volume-driver', 'acme', '-v', 'acme-data:/data', 'alpine'), review],
  ['create-bind', d('create', '-v', '/var/lib:/x', 'alpine'), review],
  ['volume-create-bind', d('volume', 'create', '--opt', 'type=none', '--opt', 'o=bind', '--opt', 'device=/etc', 'acme-etc'), review],
  ['volume-create-driver', d('volume', 'create', '-d', 'acme-driver', 'acme-data'), review],
  // Host namespaces and weakened confinement.
  ['run-host-network', d('run', '--rm', '--network', 'host', 'alpine'), review],
  ['run-host-net-alias', d('run', '--rm', '--net=host', 'alpine'), review],
  ['run-host-pid', d('run', '--rm', '--pid=host', 'alpine'), review],
  ['run-host-pid-repeated', d('run', '--rm', '--pid', 'container:acme-web', '--pid', 'host', 'alpine'), review],
  ['run-host-ipc', d('run', '--rm', '--ipc', 'host', 'alpine'), review],
  ['run-host-userns', d('run', '--rm', '--userns=host', 'alpine'), review],
  ['run-host-cgroupns', d('run', '--rm', '--cgroupns', 'host', 'alpine'), review],
  ['run-host-uts', d('run', '--rm', '--uts', 'host', 'alpine'), review],
  ['run-seccomp', d('run', '--rm', '--security-opt', 'seccomp=unconfined', 'alpine'), review],
  ['run-apparmor', d('run', '--rm', '--security-opt=apparmor=unconfined', 'alpine'), review],
  // Host files outside the project.
  ['run-env-file-outside', d('run', '--rm', '--env-file', '/outside/prod.env', 'alpine'), review],
  ['run-env-file-dotenv', d('run', '--rm', '--env-file', '.env', 'alpine'), review],
  ['run-cidfile-outside', d('run', '-d', '--cidfile', '/outside/id', 'alpine'), review],
  ['exec-env-file-outside', d('exec', '--env-file', '/outside/prod.env', 'acme-web', 'env'), review],
  ['cp-out-outside', d('cp', 'acme-web:/etc/passwd', '/outside/passwd'), review],
  ['cp-in-ssh', d('cp', '.ssh/id_ed25519', 'acme-web:/root/key'), review],
  ['cp-in-parent', d('cp', '../secrets', 'acme-web:/tmp'), review],
  ['save-outside', d('save', '-o', '/outside/web.tar', 'acme/web:1.0'), review],
  ['load-outside', d('load', '--input', '/outside/web.tar'), review],
  ['export-outside', d('container', 'export', '--output=/outside/fs.tar', 'acme-web'), review],
  ['import-outside', d('import', '/outside/rootfs.tar'), review],
  ['build-context-outside', d('build', '/outside/acme'), review],
  ['build-context-parent', d('build', '-t', 'acme/web', '..'), review],
  ['build-file-outside', d('build', '-f', '/outside/Dockerfile', '.'), review],
  ['build-extra-context', d('buildx', 'build', '--build-context', 'home=/outside', '.'), review],
  ['build-output', d('buildx', 'build', '-o', 'type=local,dest=/outside', '.'), review],
  ['build-cache-to', d('buildx', 'build', '--cache-to', 'type=local,dest=/outside/cache', '.'), review],
  ['build-entitlement', d('buildx', 'build', '--allow', 'security.insecure', '.'), review],
  ['build-host-network', d('build', '--network', 'host', '.'), review],
  ['bake-file-outside', d('buildx', 'bake', '-f', '/outside/docker-bake.hcl'), review],
  ['bake-set', d('buildx', 'bake', '--set', '*.output=type=local,dest=/outside'), review],
  ['compose-file-outside', d('compose', '-f', '/outside/compose.yaml', 'up'), review],
  ['compose-project-directory-outside', d('compose', '--project-directory', '/outside/acme', 'up'), review],
  ['compose-env-outside', d('compose', '--env-file', '/outside/prod.env', 'up'), review],
  ['docker-compose-file-outside', ['docker-compose', '--file=/outside/compose.yaml', 'up'], review],
  ['compose-unknown-global', d('compose', '--acme', 'up'), review],
  // Build secrets and the SSH agent.
  ['build-secret', d('buildx', 'build', '--secret', 'id=npmrc,src=.npmrc', '.'), review],
  ['build-ssh', d('build', '--ssh', 'default', '.'), review],
  ['compose-build-ssh', d('compose', 'build', '--ssh', 'default'), review],
  // Compose file and volume effects.
  ['compose-down-volumes', d('compose', 'down', '-v'), review],
  ['compose-down-volumes-long', d('compose', '-f', 'compose.yaml', 'down', '--volumes'), review],
  // `rm -v` removes only anonymous volumes, but the conservative scan reads
  // short flags inside clusters and cannot tell it from `down -v`.
  ['compose-rm-volumes', d('compose', 'rm', '-fsv'), review],
  ['compose-run-bind', d('compose', 'run', '-v', '/etc:/x', 'web'), review],
  ['compose-cp', d('compose', 'cp', 'web:/etc/passwd', '/outside/passwd'), review],
  ['compose-config-output', d('compose', 'config', '-o', '/outside/out.yaml'), review],
  ['docker-compose-down-volumes', ['docker-compose', 'down', '-v'], review],
  // Global options select another daemon or configuration.
  ['global-host', d('-H', 'ssh://acme@prod.example.com', 'ps'), review],
  ['global-context', d('--context', 'prod', 'run', '--rm', 'alpine'), review],
  ['global-config', d('--config', '/outside/docker', 'pull', 'alpine'), review],
  ['global-debug', d('-D', 'ps'), review],
  ['global-compose', d('--context', 'prod', 'compose', 'up'), review],
  ['global-compose-down-volumes', d('-D', 'compose', 'down', '-v'), review],
  // Plugins and unknown commands run other programs.
  ['plugin-debug', d('debug', 'acme-web'), review],
  ['plugin-scout', d('scout', 'cves', 'acme/web:1.0'), review],
  ['plugin-init', d('init'), review],
  ['plugin-mcp', d('mcp', 'gateway', 'run'), review],
  ['unknown', d('acme-command'), review],
  ['empty', d(), review],
  ['buildx-dap', d('buildx', 'dap', 'build', '.'), review],
  ['run-unknown-option', d('run', '--acme', 'alpine'), review],
  ['run-missing-value', d('run', '--name'), review],
  // The host-control scan matches the option name before `=`, whatever its value.
  ['run-privileged-false', d('run', '--privileged=false', 'alpine'), deny],

  // Host control: devices, capabilities, privileged mode and the daemon socket.
  ['run-privileged', d('run', '--rm', '--privileged', 'alpine'), deny],
  ['run-privileged-late', d('run', '--rm', '-e', 'A=1', '--privileged', 'alpine', 'sh'), deny],
  ['run-cap-add', d('run', '--rm', '--cap-add', 'SYS_ADMIN', 'alpine'), deny],
  ['run-cap-add-equals', d('run', '--rm', '--cap-add=NET_ADMIN', 'alpine'), deny],
  ['run-device', d('run', '--rm', '--device', '/dev/sda', 'alpine'), deny],
  ['run-device-cgroup', d('run', '--rm', '--device-cgroup-rule', 'a *:* rwm', 'alpine'), deny],
  ['run-api-socket', d('run', '--rm', '--use-api-socket', 'docker:cli'), deny],
  ['run-docker-socket', d('run', '--rm', '-v', '/var/run/docker.sock:/var/run/docker.sock', 'docker:cli'), deny],
  ['run-docker-socket-mount', d('run', '--rm', '--mount', 'type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock', 'docker:cli'), deny],
  ['container-create-privileged', d('container', 'create', '--privileged', 'alpine'), deny],
  ['exec-privileged', d('exec', '--privileged', 'acme-web', 'sh'), deny],
  ['compose-exec-privileged', d('compose', 'exec', '--privileged', 'web', 'sh'), deny],
  ['compose-run-cap-add', d('compose', 'run', '--cap-add', 'SYS_ADMIN', 'web'), deny],
  ['global-run-privileged', d('-D', 'run', '--privileged', 'alpine'), deny],
  ['run-device-limit', d('run', '--rm', '--device-read-bps', '/dev/sda:1mb', 'alpine'), routine],
  // Registry publication.
  ['push', d('push', 'acme/web:1.0'), deny],
  ['image-push', d('image', 'push', '--all-tags', 'acme/web'), deny],
  ['build-push', d('buildx', 'build', '--push', '-t', 'acme/web:1.0', '.'), deny],
  ['bake-push', d('buildx', 'bake', '--push'), deny],
  ['compose-push', d('compose', 'push'), deny],
  ['compose-build-push', d('compose', 'build', '--push'), deny],
  ['compose-publish', d('compose', 'publish', 'acme/app:1.0'), deny],
  ['docker-compose-push', ['docker-compose', 'push'], deny],
  ['manifest-push', d('manifest', 'push', 'acme/web:1.0'), deny],
  ['imagetools-create', d('buildx', 'imagetools', 'create', '-t', 'acme/web:1.0', 'acme/web:amd64', 'acme/web:arm64'), deny],
  ['trust-sign', d('trust', 'sign', 'acme/web:1.0'), deny],
  // Credentials.
  ['login', d('login', '-u', 'acme', '--password-stdin', 'registry.example.com'), deny],
  // Daemon selection, plugins and cluster state.
  ['context-use', d('context', 'use', 'prod'), deny],
  ['context-create', d('context', 'create', 'prod', '--docker', 'host=ssh://acme@prod.example.com'), deny],
  ['plugin-install', d('plugin', 'install', 'acme/plugin'), deny],
  ['swarm-init', d('swarm', 'init'), deny],
  ['swarm-unlock-key', d('swarm', 'unlock-key'), deny],
  ['service-create', d('service', 'create', '--name', 'web', 'nginx'), deny],
  ['stack-deploy', d('stack', 'deploy', '-c', 'compose.yaml', 'acme'), deny],
  ['secret-create', d('secret', 'create', 'acme', '-'), deny],
  // Data removal across projects.
  ['volume-rm', d('volume', 'rm', 'acme-data'), deny],
  ['volume-prune', d('volume', 'prune', '-af'), deny],
  ['container-prune', d('container', 'prune', '-f'), deny],
  ['network-prune', d('network', 'prune'), deny],
  ['system-prune', d('system', 'prune', '-af', '--volumes'), deny],
];

// With `docker_contexts` bound to the context a workspace manager pins. These
// include the commands of a Hub workspace session that pinned desktop-linux.
const ctx = (...args) => d('--context', 'desktop-linux', ...args);
const contexts = {docker_contexts: ['desktop-linux', 'colima']};
const bound = [
  ['ps', ctx('ps', '-a', '--filter', 'name=hub_acme', '--format', '{{.Names}}\\t{{.Status}}'), allow],
  ['logs', ctx('logs', '--tail', '60', 'hub_acme-backend-auth-1'), allow],
  ['inspect', ctx('inspect', '--format', '{{json .State.Health}}', 'hub_acme-backend-auth-1'), allow],
  ['equals', d('--context=desktop-linux', 'ps'), allow],
  ['second-name', d('--context', 'colima', 'images'), allow],
  ['stats', ctx('stats', '--no-stream'), allow],
  ['run', ctx('run', '--rm', 'alpine', 'true'), routine],
  ['run-named-volume', ctx('run', '--rm', '-v', 'acme-data:/data', 'alpine'), routine],
  ['exec', ctx('exec', '-it', 'acme-web', 'sh'), routine],
  ['build', ctx('build', '-t', 'acme/web:dev', '.'), routine],
  ['compose-up', ctx('compose', '-f', 'docker-compose.hub.yml', 'up', '-d'), routine],
  ['compose-config', ctx('compose', '-f', 'docker-compose.hub.yml', 'config', '--quiet'), routine],
  ['container-rm', ctx('container', 'rm', '-f', 'acme-web'), routine],
  ['logout', ctx('logout'), configure],
  // The selected context keeps every other review.
  ['run-bind', ctx('run', '--rm', '-v', '/etc:/x', 'alpine'), review],
  ['run-host-network', ctx('run', '--rm', '--network', 'host', 'alpine'), review],
  ['cp-outside', ctx('cp', 'acme-web:/etc/passwd', '/outside/passwd'), review],
  ['build-file-outside', ctx('build', '-f', '/outside/Dockerfile', '.'), review],
  ['compose-file-outside', ctx('compose', '-f', '/outside/compose.yaml', 'up'), review],
  ['compose-down-volumes', ctx('compose', 'down', '-v'), review],
  ['compose-down-volumes-equals', d('--context=desktop-linux', 'compose', 'down', '--volumes'), review],
  ['compose-cp', ctx('compose', 'cp', 'web:/etc/passwd', '/outside/passwd'), review],
  ['build-secret', ctx('build', '--secret', 'id=npmrc,src=.npmrc', '.'), review],
  ['run-privileged', ctx('run', '--privileged', 'alpine'), deny],
  ['run-docker-socket', ctx('run', '-v', '/var/run/docker.sock:/var/run/docker.sock', 'docker:cli'), deny],
  ['push', ctx('push', 'acme/web:1.0'), deny],
  ['build-push', ctx('buildx', 'build', '--push', '.'), deny],
  ['compose-push', ctx('compose', 'push'), deny],
  ['compose-publish-equals', d('--context=desktop-linux', 'compose', 'publish', 'acme/app:1.0'), deny],
  ['login', ctx('login'), deny],
  ['volume-rm', ctx('volume', 'rm', 'acme-data'), deny],
  ['context-use', ctx('context', 'use', 'prod'), deny],
  // Other contexts, other spellings and other global options still ask.
  ['other-context', d('--context', 'prod', 'ps'), review],
  ['other-context-equals', d('--context=prod', 'logs', 'acme-web'), review],
  ['short-context', d('-c', 'desktop-linux', 'ps'), review],
  ['repeated-context', d('--context', 'desktop-linux', '--context', 'desktop-linux', 'ps'), review],
  ['context-then-host', ctx('-H', 'ssh://acme@prod.example.com', 'ps'), review],
  ['host-then-context', d('-H', 'ssh://acme@prod.example.com', '--context', 'desktop-linux', 'ps'), review],
  ['context-then-config', ctx('--config', '/outside/docker', 'ps'), review],
  ['context-empty', d('--context', '', 'ps'), review],
  ['context-missing', d('--context'), review],
  ['context-plugin', ctx('debug', 'acme-web'), review],
  ['context-help', ctx('--help'), review],
];
// Unset, the same context forms ask: the twins are inactive.
const unbound = [
  ['ps', ctx('ps'), review],
  ['logs', ctx('logs', '--tail', '60', 'acme-web'), review],
  ['compose-up', ctx('compose', 'up'), review],
  ['compose-down-volumes', ctx('compose', 'down', '-v'), review],
  ['run-privileged', ctx('run', '--privileged', 'alpine'), deny],
  ['compose-push', ctx('compose', 'push'), deny],
];

// Standard install locations decide like `docker`; lookalikes are not Docker.
const executables = [
  ['/usr/local/bin/docker', allow], ['/opt/homebrew/bin/docker', allow],
  ['/Applications/Docker.app/Contents/Resources/bin/docker', allow],
  ['/outside/bin/docker', null], ['docker-evil', null],
];

export function dockerCases() {
  const cases = [];
  for (const [index,profile] of profiles.entries()) {
    for (const [label,argv,expected] of cli) cases.push({name:`cli-${label}-${profile}`,profile,argv,expected:expected[index]});
    for (const [label,argv,expected] of bound)
      cases.push({name:`context-${label}-${profile}`,profile,variables:contexts,argv,expected:expected[index]});
    for (const [label,argv,expected] of unbound)
      cases.push({name:`context-unset-${label}-${profile}`,profile,argv,expected:expected[index]});
    for (const [executable,expected] of executables)
      cases.push({name:`executable-${executable.replaceAll('/','-')}-${profile}`,profile,argv:[executable,'ps'],
        expected:expected ? expected[index] : 'ask'});
  }
  return {schema_version:1,cases};
}

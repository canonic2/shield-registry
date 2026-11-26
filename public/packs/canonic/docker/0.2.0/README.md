# Docker permissions 0.2.0

Reviewed against Docker 29.9.2 with Buildx and Compose v2: the `docker` and
standalone `docker-compose` executables. Requires Shield `>=0.57.0, <1.0.0` with
`argument-paths-v1` and `docker-context-exec-trust-v1`. Shield 0.58.0 adds
the latter capability.

Containers are the sandbox. Running, building and managing local containers,
images, networks and volumes is allowed. The pack reviews the forms that break
out of that isolation or reach beyond the project.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Version, help and inspection: `ps`, `images`, `inspect`, `logs`, `stats`, `events`, `system df`, listings | Allow | Allow | Allow |
| `run`, `create` and `exec` with named or anonymous volumes; start, stop, remove, tag, pull, commit, networks, `volume create`, image and build-cache pruning | Allow | Allow | Ask |
| `build`, `buildx build`, `bake` from the project, keeping the result locally | Allow | Allow | Ask |
| `cp`, `save`, `load`, `import` and `export` with project files | Allow | Allow | Ask |
| Compose applications: `compose` and `docker-compose` commands with project compose files | Allow | Allow | Ask |
| `logout`, `buildx create` and `buildx use` | Allow | Ask | Ask |
| Host bind mounts, `--volumes-from`, volume drivers and driver options, host namespaces, `--security-opt` other than `no-new-privileges` | Ask | Ask | Ask |
| Files outside the project or in protected folders, build outputs, extra contexts, cache exports, entitlements, `--secret` and `--ssh` | Ask | Ask | Ask |
| Compose `cp`, `-v`/`--volumes` and `-o`/`--output` | Ask | Ask | Ask |
| Global options, plugins such as `debug`, `scout` and `mcp`, and unlisted commands | Ask | Ask | Ask |
| `--privileged`, `--cap-add`, `--device`, `--device-cgroup-rule`, `--use-api-socket` and the Docker socket | Ask | Ask | Deny |
| Publication: `push`, `--push`, Compose `push`/`publish`, manifests, imagetools and trust signing | Ask | Ask | Deny |
| `login`, context changes, plugin installation and Swarm services, stacks, secrets and configs | Ask | Ask | Deny |
| Volume removal and pruning containers, networks or the whole system | Ask | Ask | Deny |

## Containers and volumes

`-v`/`--volume` passes when it names a volume (`acme-data:/data`, optionally
with a mode) or an anonymous volume (`/data`). `--mount` passes with
`type=volume` or `type=tmpfs` fields only. Every occurrence must pass. A host
path in either asks: `.:/app`, `./src:/src`, `/etc:/x`, `~/.ssh:/x`, a drive
letter, `type=bind` or `volume-opt`. The same applies to `volume create`
driver options, which can bind a host directory into a named volume.
`--network`, `--pid`, `--ipc`, `--uts`, `--userns` and `--cgroupns` with
`host` ask; other values, such as `container:acme-web`, pass.

Options after the image belong to the container's command and are not read as
Docker options. The host-control, credential, publication and Compose scans
are conservative. They check every token, including option names before `=`
and short flags inside clusters, so the same text in a container's command
line also asks, `--privileged=false` is treated as `--privileged`, and
Compose `rm -v` asks like `down -v`.

`--env-file`, `--label-file` and `--cidfile`, build `-f`, `--iidfile`,
`--metadata-file` and the context, and the files of `cp`, `save`, `load`,
`import` and `export` must be in approved paths, away from `.git`, `.shield`,
`.aws`, `.ssh`, `.env`, `.docker`, `.mcp.json`, `.codex` and `.claude`.
URL build contexts pass; a `-` context read from standard input asks.

## Compose and Bake files

Compose and Bake files are project code: they can mount host folders, add
privileges or push, and the pack does not read them. Their location, and
`--env-file` and `--project-directory`, must be in approved paths. Choose
Strict, or add a project rule, to review each Compose or Bake run.

## Daemon selection

Global options such as `-H`, `--context`, `--config`, `--tls*` and `-D`
ask, as they can select another daemon or client configuration.

The optional `docker_contexts` setting lists contexts agents may select, such
as the context a workspace manager pins for the project's services:

```sh
shield pack configure canonic/docker --set 'docker_contexts=["desktop-linux"]'
```

A command may then start with one `--context NAME` or `--context=NAME` naming
a listed context, and it decides exactly as it would without one: inspection
is allowed, bind mounts ask and `--privileged` is still denied in Strict.
Other contexts, `-c`, a repeated `--context` and every other global option
keep asking. A listed context is trusted like the default daemon, so list only
contexts whose daemon you would let agents use. Without the setting, every
`--context` form asks.

`DOCKER_HOST`, `DOCKER_CONTEXT` and `DOCKER_CONFIG` in the environment, and
the current `docker context use` selection, are host responsibilities;
changing the context through the pack asks.

## Trust commands on a selected daemon

For a dedicated development daemon, optionally configure
`docker_trusted_exec_contexts` alongside `docker_contexts`:

```sh
shield pack configure canonic/docker --set 'docker_contexts=["desktop-linux"]' --set 'docker_trusted_exec_contexts=["desktop-linux"]'
```

Loose and Recommended can then allow otherwise unrecognized programs in
`docker --context NAME exec` and `docker --context=NAME container exec` when
the context is in both lists. The grant covers every container on that daemon,
including future containers, and the code and child processes those programs
run. It includes the files, credentials and network resources those containers
can access. Context selection is by name, so keep the Docker client
configuration and the daemon selected by that name under operator control.

Host-side shell operations and Docker options retain their ordinary decisions.
Explicit Ask and Deny decisions still apply to the program and child commands
Shield can inspect. Strict keeps exec under review. The setting is unset by
default and applies only to the direct Docker exec commands above.

Generate with `node scripts/build-docker-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/docker-pack.test.mjs`.

# Testrun permissions 0.1.0

Permissions for Testrun, which tests iOS and
Android apps and isolated Chrome, Firefox and WebKit browsers. The pack covers
the `testrun` CLI and Testrun's own MCP server (`testrun mcp serve`).
Requires Shield `>=0.18.0, <1.0.0` with `field-negation-v1`.

## Profiles

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Target lists, doctor, status, screenshots, accessibility reads, waits, app lists, build and manager status, configuration checks | Allow | Allow | Allow |
| Connecting devices and browsers, input (`act`), app installs, media, volume, network, previews, recordings, input control | Allow | Allow | Ask |
| Configured builds (`build start`/MCP `build_start`) of a project inside the approved project, without caller environment overrides; `config init` | Allow | Allow | Ask |
| `connect --setup/--prepare-support`, `app uninstall`, `developer-support install`, manager retry/stop/drain, clipboard reads, opaque `browser send` requests, `browser fixture-register` | Allow | Ask | Ask |
| Inline builds, caller build/launch environment overrides, app launches with `env` in `act`, `mcp setup`, `signing setup` | Ask | Ask | Deny |
| `mcp serve` from a shell; builds of a project outside the approved project | Ask | Ask | Ask |
| Unlisted syntax and commands outside approved project folders | Ask | Ask | Deny |

Device input acts on whatever the connected target shows. On a physical phone
that includes its signed-in apps; use Strict, or a project rule, where that
matters. A configured build trusts project code the way builds and tests do; an
inline build profile can name any command, and build or launch environment
overrides can change which programs run, so both need review. The same applies
to the `env` of an `app_launch` or `app_restart` action: a simulator app runs
on the host, so a variable such as `DYLD_INSERT_LIBRARIES` loads code there.

The `project` option and MCP argument name the app project whose
developer-configured build profiles run. A project inside the approved project
keeps the command's decision; any other folder asks in every profile, because
its build commands are not the approved project's code. On MCP, which cannot
check where a path resolves, that means `.` or a relative path whose segments
do not begin with a dot.

## MCP tools

Bind Testrun's server to the pack in `.shield/config.yml`:

```yaml
mcp:
  testrun:
    transport: {type: defaults, pack: main/canonic/testrun, integration: testrun}
    agents: {claude: testrun, codex: testrun}
    packs: {main/canonic/testrun: testrun}
```

Each tool takes its CLI command's decision. `browser_send` allows like device
input when its single request acts only inside the isolated browser: page
reads, actions, screenshots, evaluation, diagnostics, events, previews,
recordings and context or page management, plus navigation to web (`http`,
`https`) or relative URLs, reloads and history moves. Requests that read or
write host files, navigate to other URL schemes such as `file:`, export browser
storage, send arbitrary HTTP or combine requests in a `batch` ask in
Recommended. Context settings allow offline mode, simulated geolocation and
clearing permissions; permission grants and unknown settings ask in Recommended.
This includes grants for the host clipboard, camera and microphone on supported
backends, even though page evaluation itself stays inside the browser.

`act` asks in Recommended when any of its actions has a non-empty `env`.
`connect` with `setup` or `prepareSupport` follows its CLI options. Configured MCP
`build_start` calls allow in Loose and Recommended and ask in Strict when
`inline` is omitted or null and environment maps are omitted or empty. Non-empty
`env`, `baseline`, `bindings` or `overrides.launch_env` maps require review, as
does any non-null inline profile. These checks use `field-negation-v1` and do not
run or interpret the supplied command. Configured CLI builds without inline
profiles or environment options keep their listed decision. Unknown tools ask,
and deny in Strict.

## Coverage limits

- The CLI's `browser send` request is opaque JSON, so it asks in Recommended
  whatever it contains. The CLI's `act` actions are opaque JSON too: any
  argument containing `env`, or a `\u` escape that could spell it, asks in
  Recommended, including text that merely mentions it.
- `app install` and MCP `app_install` accept any `.app` or `.apk` path, because
  builds usually land outside the project. An app installed on a simulator runs
  as a host process when launched.
- A browser context's `recordHar.path` (`connect --context` or MCP `connect`)
  writes the traffic archive, which can include cookies and headers, to the new
  file it names in any private folder; the pack does not check that path.
- MCP build-start checks compare environment maps with the empty object;
  supplied nulls, arrays or other non-object values retain review and Testrun's
  own request validation. CLI environment options (`--set-env`, `--launch-env`)
  also need review.
- Executables are matched as `testrun`, `/usr/bin/testrun`, `/usr/local/bin/testrun`
  and `/opt/homebrew/bin/testrun`; other absolute paths ask.

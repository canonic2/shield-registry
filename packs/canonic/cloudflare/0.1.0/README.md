# Cloudflare permissions 0.1.0

One Cloudflare pack for Wrangler and cloudflared. Requires Shield >=0.53.0, <1.0.0.
Reviewed on 2026-11-24 using Cloudflare's
Wrangler source (4.167.0), official documentation and installed cloudflared
2026.10.5 help. Wrangler is not installed on the review host. Installing this
pack installs policy, not Cloudflare tools or account credentials.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed exact installed-tool help/version forms | Allow | Allow | Allow |
| Wrangler project/build/dev, deployment, account and resource operations | Ask | Ask | Deny |
| Storage reads/writes, SQL, migrations, exports, secrets and authentication | Ask | Ask | Deny |
| cloudflared tunnels, routes, Access, logs, service installation and updates | Ask | Ask | Deny |
| Explicit deletion, restore, queue purge, consumer removal and workflow termination | Ask | Deny | Deny |
| Explicit tunnel/route/network deletion, connector cleanup or service uninstall | Ask | Deny | Deny |
| Package-runner help/version, including pinned package versions | Ask | Ask | Deny |
| Unknown syntax on recognized tools and supported Wrangler runner routes | Ask | Ask | Deny |
| Unrelated executables, unmatched package routes or MCP requests | Host policy / Ask | Host policy / Ask | Host policy / Ask |

## Execution, accounts and data

Wrangler can run Workers locally, start listeners, prepare environments, invoke
bundlers/custom builds, acquire dependencies, write generated types and deploy
or upload assets. Local mode, dry runs, frozen inputs and temporary previews do
not establish a harmless boundary. Remote metadata can disclose account data.
KV/R2/D1 reads, SQL and exports can access sensitive records; writes and restore
can replace data. Secrets Store and Worker/Pages secret operations, account
authentication and token reads retain explicit review. This applies to current
experimental families as well as Workers, Pages, storage and tunnels.

No operation allowance is inferred from --local, --remote, --env, --profile,
--config, --cwd, an endpoint URL or a package version. This initial pack does not
implement account/zone/resource settings, SQL effect parsing or automatic proof
of runtime/configuration network and file effects. Review exact target accounts,
environments, object/database identifiers, source/destination paths, SQL, URLs,
credentials and generated output before execution. Effects that cannot be
established stay reviewed rather than receiving an unbounded allowance.

cloudflared can expose local origins and private networks, change DNS/routing,
obtain tokens, issue authenticated HTTP requests, start Access proxies, stream
logs and install or update a background service. Even loopback origin addresses
can become public through a tunnel. Configured origins, private routes, origin
certificates, tokens, output logs, metrics listeners and service identity remain
reviewed. Access curl keeps review for all delegated HTTP methods and body/file
arguments. Automatic updater controls do not establish a safe tunnel operation.

## Destructive forms and option parsing

Known deletion, removal, restore, purge and termination command families have
stricter profile decisions. Worker/Pages deployment and rollback still use
review, because release changes are independently reviewed operations.
Destructive commands retain their classification with the modeled global
config/environment and launcher selectors before or between command words.
Dry-run or force-looking flags do not relax these families. Malformed forms
never gain an allowance. Unparsed option phases retain whole-invocation review.

The leading-option tables describe parsing arity, not harmlessness. All ordinary
operation arguments already require review; the tables locate known destructive
commands behind options without individually permitting those options. No path,
host or URL outside an approved boundary is automatically allowed by this pack.

## Tool identity and package launchers

Direct basenames plus /usr/bin, /usr/local/bin and /opt/homebrew/bin are recognized.
Other locations and Windows launchers use host policy. Executable matching does
not authenticate bytes or configured toolchain identity. Inherited environment,
Node startup hooks, Wrangler configuration and cloudflared credential/config
discovery remain host concerns.

Wrangler routes cover npx, npm exec (with optional --), pnpm shorthand/exec/dlx,
Yarn shorthand/exec/dlx, bunx and bun x, including version/tag package selectors.
These routes always retain review, even for a child's help/version, because
package acquisition and project-selected binaries can execute code. Package
manager options outside the modeled route use the manager's own policy; the
pack does not inspect arbitrary package.json scripts or unrelated packages.
No general launcher parser or Cloudflare MCP integration is introduced.

## Current command inventory

The factual inventory is shared source data in scripts/cloudflare-inventory.mjs.
Policy decisions and fixture expectations are maintained separately. Namespace
entries are included, as are hidden/experimental registrations. Baseline/Node/Bun
composition cannot override this pack's regular review or destructive rules.

| Wrangler family | Registered command forms |
| --- | --- |
| docs | docs |
| complete | complete |
| init | init |
| dev | dev |
| deploy | deploy |
| preview | preview, preview delete, preview secret, preview secret put, preview secret delete, preview secret list, preview secret bulk, preview base-config, preview base-config secret, preview base-config secret put, preview base-config secret delete, preview base-config secret list, preview base-config secret bulk |
| setup | setup |
| deployments | deployments, deployments list, deployments status, deployments view |
| rollback | rollback |
| versions | versions, versions view, versions list, versions upload, versions deploy, versions secret, versions secret put, versions secret bulk, versions secret delete, versions secret list |
| triggers | triggers, triggers deploy |
| delete | delete |
| tail | tail |
| secret | secret, secret put, secret delete, secret list, secret bulk |
| types | types |
| kv | kv, kv namespace, kv key, kv bulk, kv namespace create, kv namespace list, kv namespace delete, kv namespace rename, kv key put, kv key list, kv key get, kv key delete, kv bulk get, kv bulk put, kv bulk delete |
| artifacts | artifacts, artifacts namespaces, artifacts namespaces list, artifacts namespaces get, artifacts repos, artifacts repos create, artifacts repos list, artifacts repos get, artifacts repos delete, artifacts repos issue-token |
| queues | queues, queues list, queues create, queues update, queues delete, queues info, queues consumer, queues pause-delivery, queues resume-delivery, queues purge, queues subscription, queues subscription create, queues subscription list, queues subscription get, queues subscription delete, queues subscription update, queues consumer add, queues consumer remove, queues consumer list, queues consumer http, queues consumer http add, queues consumer http remove, queues consumer http list, queues consumer worker, queues consumer worker add, queues consumer worker remove, queues consumer worker list |
| basin | basin, basin sql, basin sql query, basin catalog, basin catalog enable, basin catalog disable, basin catalog get, basin catalog compaction, basin catalog compaction enable, basin catalog compaction disable, basin catalog snapshot-expiration, basin catalog snapshot-expiration enable, basin catalog snapshot-expiration disable, basin pipelines, basin pipelines setup, basin pipelines create, basin pipelines list, basin pipelines get, basin pipelines update, basin pipelines delete, basin pipelines streams, basin pipelines streams create, basin pipelines streams list, basin pipelines streams get, basin pipelines streams delete, basin pipelines sinks, basin pipelines sinks create, basin pipelines sinks list, basin pipelines sinks get, basin pipelines sinks delete |
| r2 | r2, r2 object, r2 object get, r2 object put, r2 object delete, r2 bucket, r2 bucket create, r2 bucket update, r2 bucket update storage-class, r2 bucket list, r2 bucket info, r2 bucket delete, r2 bucket sippy, r2 bucket sippy enable, r2 bucket sippy disable, r2 bucket sippy get, r2 bucket catalog, r2 bucket notification, r2 bucket notification get, r2 bucket notification list, r2 bucket notification create, r2 bucket notification delete, r2 bucket domain, r2 bucket domain list, r2 bucket domain get, r2 bucket domain add, r2 bucket domain remove, r2 bucket domain update, r2 bucket dev-url, r2 bucket dev-url get, r2 bucket dev-url enable, r2 bucket dev-url disable, r2 bucket local-uploads, r2 bucket local-uploads get, r2 bucket local-uploads enable, r2 bucket local-uploads disable, r2 bucket lifecycle, r2 bucket lifecycle list, r2 bucket lifecycle add, r2 bucket lifecycle remove, r2 bucket lifecycle set, r2 bucket cors, r2 bucket cors delete, r2 bucket cors list, r2 bucket cors set, r2 bucket lock, r2 bucket lock list, r2 bucket lock add, r2 bucket lock remove, r2 bucket lock set, r2 sql, r2 bulk, r2 bulk put |
| d1 | d1, d1 create, d1 info, d1 list, d1 delete, d1 execute, d1 export, d1 time-travel, d1 time-travel info, d1 time-travel restore, d1 migrations, d1 migrations create, d1 migrations list, d1 migrations apply, d1 insights |
| vectorize | vectorize, vectorize create, vectorize delete, vectorize get, vectorize list, vectorize list-vectors, vectorize query, vectorize insert, vectorize upsert, vectorize get-vectors, vectorize delete-vectors, vectorize info, vectorize create-metadata-index, vectorize list-metadata-index, vectorize delete-metadata-index |
| hyperdrive | hyperdrive, hyperdrive create, hyperdrive delete, hyperdrive get, hyperdrive list, hyperdrive planetscale, hyperdrive planetscale signature, hyperdrive update |
| flagship | flagship, flagship apps, flagship apps create, flagship apps list, flagship apps ls, flagship apps get, flagship apps update, flagship apps delete, flagship apps rm, flagship flags, flagship flags create, flagship flags list, flagship flags ls, flagship flags get, flagship flags pull, flagship flags inspect, flagship flags update, flagship flags set, flagship flags rules, flagship flags rules list, flagship flags rules update, flagship flags rules delete, flagship flags rules reorder, flagship flags split, flagship flags rollout, flagship flags enable, flagship flags disable, flagship flags evaluate, flagship flags eval, flagship flags delete, flagship flags rm, flagship flags changelog, flagship flags history |
| turnstile | turnstile, turnstile widget, turnstile widget create, turnstile widget delete, turnstile widget get, turnstile widget list, turnstile widget update |
| tunnel | tunnel, tunnel create, tunnel delete, tunnel info, tunnel list, tunnel run, tunnel quick-start |
| ai-search | ai-search, ai-search list, ai-search create, ai-search get, ai-search update, ai-search delete, ai-search stats, ai-search search, ai-search namespace, ai-search namespace list, ai-search namespace create, ai-search namespace get, ai-search namespace update, ai-search namespace delete, ai-search jobs, ai-search jobs list, ai-search jobs create, ai-search jobs get, ai-search jobs cancel, ai-search jobs logs |
| cert | cert, cert upload, cert upload mtls-certificate, cert upload certificate-authority, cert list, cert delete |
| pages | pages, pages dev, pages functions, pages functions build, pages functions build-env, pages functions optimize-routes, pages project, pages project list, pages project create, pages project delete, pages project upload, pages project validate, pages deployment, pages deployment list, pages deployment create, pages deployment tail, pages deployment delete, pages deploy, pages publish, pages secret, pages download, pages download config, pages secret put, pages secret bulk, pages secret delete, pages secret list |
| mtls-certificate | mtls-certificate, mtls-certificate upload, mtls-certificate list, mtls-certificate delete |
| cloudchamber | cloudchamber, cloudchamber list, cloudchamber create, cloudchamber delete, cloudchamber modify, cloudchamber apply, cloudchamber curl, cloudchamber build, cloudchamber push, cloudchamber ssh, cloudchamber ssh list, cloudchamber ssh create, cloudchamber registries, cloudchamber registries configure, cloudchamber registries credentials, cloudchamber registries remove, cloudchamber registries list, cloudchamber images, cloudchamber images list, cloudchamber images delete |
| containers | containers, containers list, containers info, containers instances, containers delete, containers ssh, containers build, containers push, containers registries, containers registries configure, containers registries list, containers registries delete, containers registries credentials, containers images, containers images list, containers images delete |
| dispatch-namespace | dispatch-namespace, dispatch-namespace list, dispatch-namespace get, dispatch-namespace create, dispatch-namespace delete |
| ai | ai, ai models, ai models list, ai models schema, ai finetune, ai finetune list, ai finetune create |
| browser | browser, browser create, browser close, browser list, browser view |
| agent-memory | agent-memory, agent-memory namespace, agent-memory namespace create, agent-memory namespace list, agent-memory namespace get, agent-memory namespace delete |
| secrets-store | secrets-store, secrets-store store, secrets-store store create, secrets-store store delete, secrets-store store list, secrets-store secret, secrets-store secret create, secrets-store secret list, secrets-store secret get, secrets-store secret update, secrets-store secret delete, secrets-store secret duplicate |
| workflows | workflows, workflows list, workflows describe, workflows delete, workflows trigger, workflows instances, workflows instances list, workflows instances describe, workflows instances send-event, workflows instances terminate, workflows instances restart, workflows instances terminate-all, workflows instances pause, workflows instances resume, workflows instances delete |
| pipelines | pipelines, pipelines setup, pipelines create, pipelines list, pipelines get, pipelines update, pipelines delete, pipelines streams, pipelines streams create, pipelines streams list, pipelines streams get, pipelines streams delete, pipelines sinks, pipelines sinks create, pipelines sinks list, pipelines sinks get, pipelines sinks delete |
| k2 | k2, k2 streams, k2 streams create, k2 streams get, k2 streams list, k2 streams delete |
| vpc | vpc, vpc service, vpc service create, vpc service delete, vpc service get, vpc service list, vpc service update |
| email | email, email routing, email routing list, email routing settings, email routing enable, email routing disable, email routing dns, email routing dns get, email routing dns unlock, email routing rules, email routing rules list, email routing rules get, email routing rules create, email routing rules update, email routing rules delete, email routing addresses, email routing addresses list, email routing addresses get, email routing addresses create, email routing addresses delete, email sending, email sending list, email sending settings, email sending enable, email sending disable, email sending send, email sending send-raw, email sending dns, email sending dns get |
| hello-world | hello-world, hello-world get, hello-world set |
| login | login |
| logout | logout |
| whoami | whoami |
| auth | auth, auth token, auth keyring, auth create, auth delete, auth activate, auth deactivate, auth list |
| telemetry | telemetry, telemetry disable, telemetry enable, telemetry status |
| metrics | metrics |
| check | check, check startup |
| build | build |

cloudflared current forms: update, version, proxy-dns, tail, service install, service uninstall, access login, access curl, access token, access tcp, access rdp, access ssh, access smb, access ssh-config, access ssh-gen, forward login, forward curl, forward token, forward tcp, forward rdp, forward ssh, forward smb, forward ssh-config, forward ssh-gen, tunnel login, tunnel create, tunnel route dns, tunnel route lb, tunnel route ip add, tunnel route ip show, tunnel route ip list, tunnel route ip delete, tunnel route ip get, tunnel vnet add, tunnel vnet list, tunnel vnet delete, tunnel vnet update, tunnel run, tunnel list, tunnel ready, tunnel info, tunnel delete, tunnel cleanup, tunnel token, tunnel diag, tunnel proxy-dns.

## Compatibility and sources

Retained Wrangler compatibility spellings: publish, generate, kv:namespace create, kv:namespace list, kv:namespace delete, kv:key put, kv:key get, kv:key list, kv:key delete, kv:bulk put, kv:bulk delete.
Retained cloudflared compatibility spellings: tunnel ingress validate, tunnel ingress rule.
Installed cloudflared still advertises proxy-dns as unsupported. Compatibility
classification does not promise that current tools accept or implement a form.
No shipped permission is retired by this initial candidate. Removal is deferred
until the registry's three-subsequent-feature-release window has sufficient
release evidence; no eligible retirement date is asserted here.

Primary sources include
[Wrangler CLI registration](https://github.com/cloudflare/workers-sdk/blob/de6b171603576fd12afa4f32736c0c0ecb28eeab/packages/wrangler/src/index.ts),
[its command handler](https://github.com/cloudflare/workers-sdk/blob/de6b171603576fd12afa4f32736c0c0ecb28eeab/packages/wrangler/src/core/register-yargs-command.ts),
[Pipelines alias](https://github.com/cloudflare/workers-sdk/blob/de6b171603576fd12afa4f32736c0c0ecb28eeab/packages/wrangler/src/pipelines/index.ts),
[cloudflared source](https://github.com/cloudflare/cloudflared/tree/dc57315806d5faa8715f728fd37b5302c81c467b/cmd/cloudflared),
[Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/) and
[Tunnel commands](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/tunnel-useful-commands/).
Installed help supplied cloudflared command/alias and global-option evidence.

## Validation

Canonical sources are scripts/cloudflare-policy.mjs and the factual inventory.
Independent decision fixtures are scripts/cloudflare-cases.mjs. The policy
artifact is compact JSON to stay within the registry's 1 MiB source bound;
readable policy sources and this guide own reviewability.
Regenerate with node scripts/build-cloudflare-pack.mjs. Validate with
npm test -- --shield /absolute/path/to/shield scripts/cloudflare-pack.test.mjs.
Fixtures evaluate all profiles, source admission, operation coverage, malformed
inputs, secrets/storage/tunnel effects, runner forms and Baseline/Node/Bun
composition. Fixture commands are not executed. Live deployment/storage/accounts,
OAuth, tunnels, service changes and native-agent-hook acceptance remain unverified.

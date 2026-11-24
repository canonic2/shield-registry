import {copyFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cloudflarePack, cloudflareInventory} from './cloudflare-policy.mjs';
import {cloudflareCases} from './cloudflare-cases.mjs';
import {splitCaseFiles} from './fixture-files.mjs';
import {workersSdkRevision, cloudflaredRevision, wranglerOperations, wranglerCompatibilityOperations,
  cloudflaredOperations, cloudflaredCompatibilityOperations} from './cloudflare-inventory.mjs';

export const directory = new URL('../packs/canonic/cloudflare/0.1.0/', import.meta.url);
const families = [...new Set(wranglerOperations.map(operation => operation.split(' ')[0]))];
export const guide = `# Cloudflare permissions 0.1.0

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
${families.map(family => `| ${family} | ${wranglerOperations.filter(operation => operation.split(' ')[0] === family).join(', ')} |`).join('\n')}

cloudflared current forms: ${cloudflaredOperations.join(', ')}.

## Compatibility and sources

Retained Wrangler compatibility spellings: ${wranglerCompatibilityOperations.join(', ')}.
Retained cloudflared compatibility spellings: ${cloudflaredCompatibilityOperations.join(', ')}.
Installed cloudflared still advertises proxy-dns as unsupported. Compatibility
classification does not promise that current tools accept or implement a form.
No shipped permission is retired by this initial candidate. Removal is deferred
until the registry's three-subsequent-feature-release window has sufficient
release evidence; no eligible retirement date is asserted here.

Primary sources include
[Wrangler CLI registration](https://github.com/cloudflare/workers-sdk/blob/${workersSdkRevision}/packages/wrangler/src/index.ts),
[its command handler](https://github.com/cloudflare/workers-sdk/blob/${workersSdkRevision}/packages/wrangler/src/core/register-yargs-command.ts),
[Pipelines alias](https://github.com/cloudflare/workers-sdk/blob/${workersSdkRevision}/packages/wrangler/src/pipelines/index.ts),
[cloudflared source](https://github.com/cloudflare/cloudflared/tree/${cloudflaredRevision}/cmd/cloudflared),
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
`;

export async function buildCloudflarePack() {
  await mkdir(directory, {recursive: true});
  const pack = cloudflarePack();
  for (const [name, data] of [['pack.yml', pack], ...splitCaseFiles(cloudflareCases()), ['commands.json', cloudflareInventory(pack)]])
    await writeFile(new URL(name, directory), JSON.stringify(data, null, name === 'pack.yml' ? 0 : 2) + '\n');
  await writeFile(new URL('README.md', directory), guide);
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', directory));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildCloudflarePack();

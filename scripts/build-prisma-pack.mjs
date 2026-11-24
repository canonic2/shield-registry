import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {commands, engine, operationInventory, prismaPack, version} from './prisma-policy.mjs';
import {prismaCases} from './prisma-cases.mjs';
import {writePack, destinationOf} from './tool-pack.mjs';

export const directory = destinationOf(prismaPack());
export function guide() {
  return `# Prisma permissions ${version}

Requires Shield \`${engine}\`. Reviewed on 2026-11-23 against stable Prisma
7.10.1 source and official v6/v7 references, plus the documented v8 release
candidate command names. The candidate covers the Prisma CLI and selected
package-runner forms.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Validation, formatting, generation, introspection, Studio, migration inspection and ordinary operations | Ask | Ask | Deny |
| Help/version requests and package-runner acquisition/execution | Ask | Ask | Deny |
| Migration reset, database reset and selected platform resource deletion | Ask | Deny | Deny |
| Explicit force-reset or accept-data-loss switches | Ask | Deny | Deny |
| Unclassified direct Prisma operations | Ask | Ask | Deny |

## Effects

Prisma 7.10.1 loads executable configuration before parsing most commands,
including help and version requests. Version can also download engine binaries.
Validation and formatting inherit config execution; formatting writes schemas.
Generation can run custom generators and write configured destinations.
Introspection contacts the selected database and can overwrite schema files.
Studio starts a listener and offers database access. Seed scripts execute code.
SQL execution and migration commands can change remote or production data.
Even migrate dev --create-only can detect drift and request a reset.

Every such operation requires review for files, code execution, connection
identity, credentials, URLs, outputs and subprocesses. The pack grants no
automatic filesystem or network allowance. Host enforcement covers inherited
environment, configuration and runtime effects. Ask follows host approval or
fallback behavior. Prisma's own confirmations remain additional tool behavior.

## Launch forms

Direct \`prisma\` and \`prisma7\` commands match their standard Unix executable
paths. Runner forms include \`npx prisma\`, \`npm exec prisma\`,
\`npm exec -- prisma\`, \`pnpm prisma\`, \`pnpm exec prisma\`,
\`pnpm dlx prisma\`, \`yarn prisma\`, \`yarn exec prisma\`,
\`yarn dlx prisma\`, \`bunx prisma\` and \`bun x prisma\`.
These routes also recognize version/tag-qualified package names, \`prisma7\`
and \`@prisma/prisma7\`. Runner downloads and project scripts retain review.
An identically named package script is still executable code. Other package
names, shell wrappers, environment-specific executable paths and MCP servers
use their own policy. Existing Node pack decisions continue to apply in
composition; this pack contributes no blanket runner allowance.

Unknown arguments on reset and data-loss forms retain their restrictions.
Harmless display switches never create an allowance for the underlying
configuration, generator or database operation.

## Inventory and compatibility

${operationInventory.map(command => `- \`${command}\``).join('\n')}

The v7 workflows remain covered alongside v8's contract, db and migration
groups. Source review establishes config execution in v7; preview v8 names are
classified conservatively without claiming installed-v8 acceptance. Legacy
v6 options such as --skip-seed/--skip-generate and old db execute selectors keep
the parent operation's decision. None is retired by this candidate. Removal
requires evidence of first verified absence and three subsequent published
feature releases. v7 remains supported and preview releases do not count.

## Evidence and validation

- [Stable CLI dispatch](https://github.com/prisma/prisma/blob/7.10.1/packages/cli/src/bin.ts)
- [v7 CLI reference](https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference)
- [v6 CLI reference](https://www.prisma.io/docs/orm/v6/reference/prisma-cli-reference)
- [v8 CLI overview](https://www.prisma.io/docs/cli)
- [v7-to-v8 command mapping](https://www.prisma.io/docs/orm/coming-from-prisma-orm-7)

Generate with \`node scripts/build-prisma-pack.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/prisma-pack.test.mjs\`.
Fixtures evaluate policy without running Prisma, installing packages or
contacting a database. Installed-tool and live database acceptance are unverified.
`;
}
export async function buildPrismaPack() {
  const pack = prismaPack();
  await writePack(pack);
  const inventory = {schema_version: 1, commands: commands.map(name => ({name,
    rule_ids: pack.rules.filter(rule => rule.conditions.executable.one_of.includes(name)).map(rule => rule.id)}))};
  await writeFile(new URL('commands.json', directory), JSON.stringify(inventory, null, 2) + '\n');
  await writeFile(new URL('cases.json', directory), JSON.stringify(prismaCases(), null, 2) + '\n');
  await writeFile(new URL('README.md', directory), guide());
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildPrismaPack();

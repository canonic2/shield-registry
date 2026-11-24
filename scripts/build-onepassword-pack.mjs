import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {engine, version, onepasswordPack, onepasswordInventory} from './onepassword-policy.mjs';
import {onepasswordCases} from './onepassword-cases.mjs';
import {splitCaseFiles} from './fixture-files.mjs';

export const directory = new URL(`../packs/canonic/1password/${version}/`, import.meta.url);

export function guide() {
  return `# 1Password permissions ${version}

Reviewed against 1Password CLI 2.42.0 using its built-in help and
[official command reference](https://www.1password.dev/cli/reference).
Requires Shield \`${engine}\`.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact CLI version queries and built-in help forms | Allow | Allow | Allow |
| Account and identity metadata, vault/item/document lists, vault details, templates printed to stdout | Allow | Allow | Ask |
| User/group metadata, membership and vault-access listings, service-account rate limits, available shell plugin list | Allow | Allow | Ask |
| Item contents, secret references, OTPs, document downloads and Environment secret lists | Ask | Ask | Deny |
| Injection, \`run\`, shell plugin execution, login/logout, updates and account configuration | Ask | Ask | Deny |
| Item changes/sharing, vault/user/group lifecycle and permissions, service accounts, Connect, Events API and provisioning | Ask | Ask | Deny |
| Explicit configuration directories, session tokens, diagnostics and output files | Ask | Ask | Deny |
| Unclassified top-level commands and MCP calls | Ask | Ask | Ask |

## Metadata and secret values

\`op item list --vault Development --format=json\` allows discovery of item
titles, IDs and other metadata in Loose and Recommended. Account selection
with \`--account\` is supported before, between and after command words.
The CLI's authentication and selected account determine available vaults.
This release has no pack setting for account or vault restrictions.

\`op item get\` can return fields, notes, credentials and OTPs. It requires
review even with human-readable masking or a narrow \`--fields\` selection.
\`op environment secret list\` returns unconcealed secret values by default
and can reveal concealed fields with \`--reveal\`. Every Environment command
uses the sensitive-operation decision.

The pack checks CLI options by effect. It accepts harmless unlisted switches
on metadata list commands. The CLI validates extra operands on these leaf
commands. Malformed declared options prevent the metadata allowance.
Reviewed sensitive command families retain their
restrictions for other options and subcommands. The \`ls\` aliases and
\`service-account ratelimits\` are included.

## Files, injection and subprocesses

\`op read\`, \`op inject\`, \`op run\` and \`op plugin run\` require review in
Loose and Recommended. This includes stdin templates, referenced dotenv
files and credentials injected into subprocesses. Paths and child commands
within these reviewed operations need inspection when approving the call.
Explicit \`--out-file\`/\`-o\` asks even for an empty item template.
The conservative override scan checks literal tokens, equals forms and short
clusters. The scan can also match option-like text supplied as an operand.

The host controls executable identity, the 1Password application integration,
saved credentials and inherited variables such as \`OP_ACCOUNT\`,
\`OP_CONFIG_DIR\`, \`OP_CONNECT_HOST\`, \`OP_CONNECT_TOKEN\`, \`OP_SESSION_*\`
and \`OP_SERVICE_ACCOUNT_TOKEN\`. Inline shell assignments ask through Shield's
shell analysis. The pack defines CLI permissions. MCP calls follow the host's
other installed policy or unknown-request fallback.

Generate with \`node scripts/build-onepassword-pack.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/onepassword-pack.test.mjs\`.
`;
}

export async function buildOnepasswordPack() {
  await mkdir(directory, {recursive: true});
  const pack = onepasswordPack();
  for (const [file, document] of [['pack.yml', pack], ['commands.json', onepasswordInventory(pack)],
    ...splitCaseFiles(onepasswordCases())]) {
    await writeFile(new URL(file, directory), JSON.stringify(document, null, 2) + '\n');
  }
  await writeFile(new URL('README.md', directory), guide());
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', directory));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildOnepasswordPack();

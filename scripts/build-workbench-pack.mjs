import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {version, shieldEngine, imageFileTools, tools, workbenchPack} from './workbench-policy.mjs';
import {workbenchCases} from './workbench-cases.mjs';

export const directory = new URL(`../packs/canonic/workbench/${version}/`, import.meta.url);
export function guide() {
  const count = Object.keys(tools).length;
  const rows = Object.entries(tools).map(([name, reason]) => {
    const decision = imageFileTools.includes(name)
      ? 'Allow for approved paths, otherwise Ask (all profiles)'
      : 'Allow / Allow / Allow';
    return `| \`${name}\` | ${reason} | ${decision} |`;
  }).join('\n');
  return `# Workbench permission pack

Pack \`canonic/workbench@${version}\`. Requires Shield \`${shieldEngine}\` with MCP field path checks.

Workbench MCP tools are **Allow** in Loose, Recommended and Strict on a
verified connection. The pack checks caller-named image files and output
destinations against Shield’s approved folders in every profile. The ${count}
current tools are listed below. Unlisted tools on the verified connection are
also **Allow**.

## Coverage

| MCP tool | Operation | Loose / Recommended / Strict |
| --- | --- | --- |
${rows}

Use absolute paths for \`image_inspect.file\` and \`image_edit.file\`, every
mask’s \`file\`, and optional \`image_edit.out\`. Shield checks image inputs
against read roots and output destinations against write roots. Relative
paths require review because Workbench resolves them from the manifest’s
project, which can differ from the Shield project. Workbench writes to the
named destination when given \`out\` and replaces an existing output when
given \`replace: true\`.

## Connection

The pack matches the stdio launch \`workbench mcp serve\` with exactly those
arguments, as \`workbench mcp setup\` writes it. It accepts the PATH command,
standard Unix install paths, the extension’s macOS/Linux
\`~/.local/bin/workbench\` link, and its Windows \`workbench.cmd\` launcher
under the user’s \`.local/bin\`. A renamed server can bind to the
\`workbench\` integration. Extra launch arguments such as \`--project\`
or \`--config\`, wrapper commands, arbitrary executable paths and HTTP
connections require a separately reviewed connection. Executable identity
and PATH remain host responsibilities.

## Limits

This pack covers MCP. CLI, shell and general file tools follow other policy.
Rendering and interaction can run project code and trigger the project’s
requests. Workbench validates schemas and owns project trust, page lifetimes,
and resource limits. Other installed policies can make the effective decision
stricter. Native agent approval and hook trust remain separate.

## Evidence and maintenance

Reviewed against Workbench 0.24’s CLI, \`workbench mcp serve --check\`, and
native registration and launcher sources. The reviewed names, including the
bundled docs tools, remain available. There are no retirements to schedule.

Workbench’s image handlers resolve source, mask and output paths on the host
and accept absolute paths outside the manifest project. This version tightens
the image permissions from 0.2.0. Pass absolute paths inside Shield’s approved
folders to keep those requests allowed.

Regenerate with \`node scripts/build-workbench-pack.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield --workbench /absolute/path/to/workbench scripts/workbench-pack.test.mjs\`.
The independent cases live in \`scripts/workbench-cases.mjs\`. Fixture
validation exercises the policy decisions and catalog on the validation host.
`;
}

export async function buildWorkbenchPack() {
  await mkdir(directory, {recursive: true});
  for (const [name, value] of [['pack.yml', workbenchPack()], ['cases.json', workbenchCases()]])
    await writeFile(new URL(name, directory), JSON.stringify(value, null, 2) + '\n');
  await writeFile(new URL('README.md', directory), guide());
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', directory));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildWorkbenchPack();

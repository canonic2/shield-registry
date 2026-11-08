import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {version, tools, workbenchPack} from './workbench-policy.mjs';
import {workbenchCases} from './workbench-cases.mjs';

export const directory = new URL(`../packs/canonic/workbench/${version}/`, import.meta.url);
export function guide() {
  return `# Workbench permission pack\n\n` +
    `Pack: \`canonic/workbench@${version}\`. Requires Shield \`>=0.20.0, <1.0.0\`.\n\n` +
    `All 18 current Workbench MCP tools are **Allow** in Loose, Recommended and Strict, ` +
    `including canvas changes, private page creation, interaction and cleanup. Unknown tools are **Ask**.\n\n` +
    `## Coverage\n\n| MCP tool | Operation | Loose / Recommended / Strict |\n| --- | --- | --- |\n` +
    Object.entries(tools).map(([name, reason]) => `| \`${name}\` | ${reason} | Allow / Allow / Allow |`).join('\n') +
    `\n\n## Connection\n\nThe pack matches the stdio launch \`workbench mcp serve\` with exactly those arguments. ` +
    `It accepts the PATH command, standard Unix install paths, the extension’s macOS/Linux \`~/.local/bin/workbench\` ` +
    `link, and its Windows \`workbench.cmd\` launcher under the user’s \`.local/bin\`. ` +
    `A renamed MCP server can bind to the \`workbench\` integration. Merely naming a server Workbench grants no permissions. ` +
    `Extra launch arguments (including an explicit \`--project\`), wrapper commands, arbitrary executable paths and HTTP connections ` +
    `do not match this integration and require a separately reviewed connection. Executable identity and PATH remain host responsibilities.\n\n` +
    `## Limits\n\nThis is an MCP-only pack: CLI, shell and general file-tool requests remain outside its coverage. ` +
    `It authorizes these MCP tools’ documented effects, including saved captures and project code run for rendering and interaction. ` +
    `Page interaction can trigger the project’s requests. Workbench still owns schema validation, project ` +
    `trust, page lifetimes and resource limits; the pack allows known tool names even when arguments are missing or malformed. ` +
    `Other installed policies can make the effective decision stricter. Native agent approval and hook trust remain separate.\n\n` +
    `## Evidence and maintenance\n\nReviewed against Workbench 0.19’s \`server/src/mcp/catalog.rs\`, bundled documentation tools, ` +
    `\`extension/src/modules/command-link/index.ts\` and \`workbench mcp serve --check\`. ` +
    `The policy inventory and independent request fixtures are maintained separately in ` +
    `\`scripts/workbench-policy.mjs\` and \`scripts/workbench-cases.mjs\`. ` +
    `Regenerate with \`node scripts/build-workbench-pack.mjs\` and validate with ` +
    `\`npm test -- --shield /absolute/path/to/shield --workbench /absolute/path/to/workbench scripts/workbench-pack.test.mjs\`. ` +
    `Fixture validation does not establish native host or cross-platform launch acceptance.\n`;
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

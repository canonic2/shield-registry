// New revisions support the shared short docs tool names; frozen releases and
// legacy names remain usable while agent servers roll forward independently.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {addShortDocs} from './build-gate-switch-pack.mjs';
import {toolPack} from './tool-pack.mjs';

export const docsRevisions = {baseline:['0.11.0','0.11.1'], box:['0.2.0','0.2.1'], testrun:['0.2.0','0.2.1']};
export const docsDirectory = (name, version) => new URL(`../packs/canonic/${name}/${version}/`, import.meta.url);

export async function docsToolPack(name) {
  const [oldVersion, version] = docsRevisions[name];
  const pack = JSON.parse(await readFile(new URL('pack.yml', docsDirectory(name, oldVersion))));
  pack.version = version;
  if (name !== 'baseline') addShortDocs(pack, name);
  else for (const server of ['workbench']) {
    const template = toolPack({name:server, title:server, version, engine:pack.engines.shield,
      description:'Bundled documentation', leading:{flags:[], values:[]}, shortOptions:{flags:[], values:[]},
      homeInstall:'.local/bin', commands:[], mcpTools:{}});
    pack.mcp_integrations ??= {};
    pack.mcp_integrations[server] = template.mcp_integrations[server];
    const docs = {rules:[]};
    addShortDocs(docs, server);
    for (const rule of docs.rules) {
      rule.id = `${server}-${rule.id}`;
      pack.rules.push(rule);
      // Preserve support for the existing installed binaries, too.
      pack.rules.push({...structuredClone(rule), id:`${rule.id}-legacy`,
        conditions:{...rule.conditions, tool:`${server}_${rule.conditions.tool}`}});
    }
    pack.capabilities = [...new Set([...pack.capabilities, 'mcp-integrations-v1'])].sort();
  }
  return pack;
}

export async function docsToolCases(name) {
  const [oldVersion] = docsRevisions[name];
  const cases = JSON.parse(await readFile(new URL('cases.json', docsDirectory(name, oldVersion))));
  for (const server of name === 'baseline' ? ['workbench'] : [name]) {
    const mcp = {[server]:{transport:{type:'defaults', pack:`canonic/${name}`, integration:server},
      agents:{codex:server}, packs:{[`canonic/${name}`]:server}}};
    for (const profile of ['loose','recommended','strict']) {
      for (const verb of ['list','search','read']) for (const prefix of ['', `${server}_`]) {
        const tool = `${prefix}docs_${verb}`;
        cases.cases.push({name:`${server}-${tool}-${profile}`, profile, mcp,
          input:{kind:'mcp', server, tool, arguments:{}, original_input:{}}, expected:'allow'});
      }
    }
  }
  return cases;
}

export async function buildDocsToolPacks() {
  for (const [name, [oldVersion, version]] of Object.entries(docsRevisions)) {
    const directory = docsDirectory(name, version);
    await mkdir(directory, {recursive:true});
    await writeFile(new URL('pack.yml', directory), JSON.stringify(await docsToolPack(name), null, 2) + '\n');
    await writeFile(new URL('cases.json', directory), JSON.stringify(await docsToolCases(name), null, 2) + '\n');
    for (const file of ['commands.json','LICENSE'])
      await copyFile(new URL(file, docsDirectory(name, oldVersion)), new URL(file, directory));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildDocsToolPacks();

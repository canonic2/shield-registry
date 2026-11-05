// Install-time repository scope reuses the reviewed generated-scope gates.
import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {githubPack} from './build-github-pack.mjs';

export const destination = new URL('../packs/canonic/github/0.2.0/', import.meta.url);
const part = index => ({text: {var: 'repository', split: {separator: '/', index}}});

export function configurableGithubPack() {
  // These valid fixture names are replaced only inside scope predicates below.
  const pack = githubPack({repositories: ['scope-owner/scope-repo']}, 'acme/github', '0.2.0');
  const substitute = value => {
    if (value === 'scope-owner/scope-repo') return {var: 'repository'};
    if (Array.isArray(value)) return value.map(substitute);
    if (!value || typeof value !== 'object') return value;
    if (value.exact === 'scope-owner') return part(0);
    if (value.exact === 'scope-repo') return part(1);
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, substitute(child)]));
  };
  pack.id = 'canonic/github';
  pack.description = 'GitHub CLI and official MCP permissions. Optional repository setting restricts both to one explicit OWNER/REPO; omitted means no repository restriction.';
  pack.engines.shield = '>=0.19.0, <1.0.0';
  pack.capabilities.push('variables-v1', 'variable-parts-v1');
  pack.variables = {repository: {type: 'string',
    description: 'Optional exact OWNER/REPO allowed for GitHub CLI and MCP operations. Omit for no repository restriction. When set, CLI calls require -R/--repo; unknown targets and project operations deny.',
    match: {regex: '[A-Za-z0-9][A-Za-z0-9-]{0,38}/\\.*[A-Za-z0-9_-][A-Za-z0-9_.-]*'},
    max_length: 140,
    setup: {question: 'Limit GitHub operations to one repository?', unset: 'Any repository (no scope check)',
      value: 'Only this repository', placeholder: 'acme/web'}}};
  pack.preconditions = pack.preconditions.map(gate => ({...substitute(gate), when: [{var: 'repository', set: true}]}));
  return pack;
}

export async function buildConfigurableGithubPack() {
  const pack = configurableGithubPack();
  await mkdir(destination, {recursive: true});
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('commands.json', destination), JSON.stringify({schema_version: 1,
    commands: [{name: 'gh', rule_ids: pack.rules.filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]}, null, 2) + '\n');
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', destination));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildConfigurableGithubPack();
}

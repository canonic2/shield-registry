import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { profiles, network, destructive, execution, reason, guidance, forms, risks, exact } from './git-policy.mjs';

const root = new URL('../packs/canonic/git/0.4.1/', import.meta.url);
const inventory = JSON.parse(await readFile(new URL('commands.json', root)));
const rules = [];
const decisions = tier => Object.fromEntries(['loose', 'recommended', 'strict'].map((name, index) => [name, profiles[tier][index]]));
const baseTier = name => destructive.has(name) ? 'destructive' : network.has(name) ? 'network' : execution.has(name) ? 'execution' : 'review';
const wrappers = [[], ['--no-pager'], ['-P']];
const add = (id, arguments_, tier, explanation = reason[tier]) => {
  for (const [index, wrapper] of wrappers.entries()) {
    const args = structuredClone(arguments_);
    const field = 'prefix' in args ? 'prefix' : 'values';
    args[field] = [...wrapper, ...args[field]];
    if (args.kind === 'options') {
      args.optional_values = args.values.filter(name => args.flags.includes(name));
      args.flags = args.flags.filter(name => !args.optional_values.includes(name));
      args.values = args.values.filter(name => !args.optional_values.includes(name));
    }
    rules.push({ id: `w${index}-${id}`, conditions: { domain: 'argv', executable: 'git', arguments: args }, reason: explanation, decision: decisions(tier),
      ...(guidance[tier] ? { guidance: guidance[tier] } : {}) });
  }
};
for (const { name } of inventory.commands) add(`base-${name}`, { kind: 'prefix', values: [name] }, baseTier(name));
for (const [index, form] of forms.entries()) {
  const { tier, ...arguments_ } = form;
  add(`form-${index}-${form.prefix.join('-')}`, { kind: 'options', ...arguments_ }, tier);
}
for (const args of exact) add(`exact-${args.join('-').replaceAll('--', '')}`, { kind: 'exact', values: args }, 'inspect');
for (const risk of risks) {
  add(risk.label, risk.whole ? { kind: 'prefix', values: risk.prefix } : {
    kind: 'risk_tokens', prefix: risk.prefix, any_of: [...risk.tokens, ...(risk.token_prefixes ?? []).map(prefix => ({ prefix }))],
  }, 'destructive');
}
for (const prefix of ['remote show', 'remote update', 'submodule update', 'submodule add', 'submodule sync']) {
  add(`network-${prefix.replaceAll(' ', '-')}`, { kind: 'prefix', values: prefix.split(' ') }, 'network');
}
for (const command of ['merge', 'cherry-pick', 'revert']) add(`external-strategy-${command}`, { kind: 'risk_tokens', prefix: [command], any_of: command === 'merge' ? ['--strategy', '-s'] : ['--strategy'] }, 'execution');
const pack = { schema_version: 1, kind: 'pack', id: 'canonic/git', version: '0.4.1',
  description: 'Git permissions for inspection, staging, local changes, remote access and destructive operations.',
  license: 'MIT', maintainers: ['Canonic'], engine: '>=0.1.0, <0.2.0',
  capabilities: ['argument-rules-v1', 'structured-rules-v1'], rules };
const output = process.argv[2] ? pathToFileURL(resolve(process.argv[2]) + '/') : root;
await writeFile(new URL('pack.yml', output), JSON.stringify(pack, null, 2) + '\n');
console.log(`${inventory.commands.length} commands; ${rules.length} rules`);

// Published releases are immutable. Prepare a new source release whose Node
// project scripts require local policy; keep dependency inspection unchanged.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const previous = new URL('../packs/canonic/baseline/0.6.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.7.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));
const inspections = new Set(['ls', 'list', 'outdated', 'explain', 'why']);
const guidance = {
  message: 'Project scripts require project policy review; their names do not establish harmlessness.',
  alternatives: ['Inspect script definitions, hooks and arguments. If appropriate, propose a narrow project rule with shield_policy_propose and explain its effects in agent_reason. Submit its exact apply_arguments to shield_policy_apply for user review.'],
};

export async function scriptReviewPack() {
  const pack = await read('pack.yml');
  pack.version = '0.7.0';
  pack.engines = {shield: '>=0.2.0, <0.4.0'};
  pack.rules = pack.rules.flatMap(rule => {
    if (!rule.id.startsWith('scripts-')) return [rule];
    const review = structuredClone(rule);
    const choices = review.conditions.arguments.values.at(-1).one_of;
    review.conditions.arguments.values.at(-1).one_of = choices.filter(name => !inspections.has(name));
    review.decision = {loose: 'ask', recommended: 'ask', strict: 'ask'};
    review.reason = 'Project scripts need an explicit project rule.';
    review.guidance = guidance;
    const inspect = structuredClone(rule);
    inspect.id += '-inspection';
    inspect.conditions.arguments.values.at(-1).one_of = choices.filter(name => inspections.has(name));
    inspect.fallback = true; // Node can provide a narrower inspection grammar.
    return [review, inspect];
  });
  return pack;
}

export async function scriptReviewCases() {
  const cases = await read('cases.json');
  const reviewed = new Set(['npm-test', 'npm-run-args', 'npm-prefix', 'npm-workspace', 'pnpm-test', 'pnpm-dir', 'pnpm-dir-attached', 'pnpm-recursive', 'pnpm-filter', 'yarn-test', 'yarn-workspace', 'yarn-cwd']);
  for (const fixture of cases.cases) {
    if (reviewed.has(fixture.name.replace(/^usable-/, '').replace(/-(loose|recommended|strict)$/, ''))) fixture.expected = 'ask';
  }
  return cases;
}

export async function build() {
  await mkdir(destination, {recursive: true});
  const pack = await scriptReviewPack();
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('cases.json', destination), JSON.stringify(await scriptReviewCases(), null, 2) + '\n');
  const commands = await read('commands.json');
  for (const command of commands.commands) {
    command.rule_ids = pack.rules.filter(rule => rule.conditions.executable?.one_of?.some(name => name.split('/').at(-1) === command.name)).map(rule => rule.id);
    // Compact legacy source-member identities remain documented; new split
    // inspection rules are explicit in the effective inventory.
    for (const id of command.rule_ids.filter(id => id.endsWith('-inspection'))) command.source_rule_ids.push(id);
  }
  await writeFile(new URL('commands.json', destination), JSON.stringify(commands, null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();

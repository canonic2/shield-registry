import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sedExpressionCases} from './baseline-sed-expression-cases.mjs';
import {shieldInspectionCases} from './baseline-shield-cases.mjs';

export const previous = new URL('../packs/canonic/baseline/0.20.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.21.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));
const sourceIds = ['stdin-sed-read', 'read-sed', 'edit-sed'];
const expressionIds = sourceIds.map(id => `${id}-expressions`);

function expressionRule(rule) {
  const {prefix: [script], leading, operands, values} = rule.conditions.arguments;
  const args = {
    kind: 'options', prefix: [], flags: [...leading.flags],
    values: [{name: '-e', match: script}], operands, require_all: ['-e'],
    parse: 'stop_at_operand', short_clusters: false,
  };
  if (rule.id === 'edit-sed') {
    args.flags.push('--in-place');
    args.values.push({...values[0], repeat: 'forbid'});
    args.require_any = ['-i', '--in-place'];
  }
  return {...rule, id: `${rule.id}-expressions`, conditions: {...rule.conditions, arguments: args}};
}

export async function baselineSedExpressionsPack() {
  const pack = await read('pack.yml');
  pack.version = '0.21.0';
  pack.engines.shield = '>=0.57.0, <1.0.0';
  const rule = id => pack.rules.find(row => row.id === id);
  rule('review-sed').guidance.message = 'Use supported sed commands as a positional script or literal -e expressions. Review applies to -f script files, backup suffixes, blocks, shell execution and other unmodeled forms.';
  pack.rules.push(...sourceIds.map(id => expressionRule(rule(id))));
  return pack;
}

export async function baselineSedExpressionsCommands() {
  const inventory = await read('commands.json');
  const sed = inventory.commands.find(row => row.name === 'sed');
  sed.rule_ids.push(...expressionIds);
  sed.source_rule_ids.push(...expressionIds);
  return inventory;
}

export async function baselineSedExpressionsCases() {
  const fixtures = await read('cases.json');
  fixtures.cases.push(...sedExpressionCases());
  return fixtures;
}

export function baselineShieldInspectionCases() {
  return {schema_version: 1, cases: shieldInspectionCases()};
}

export const guide = `# Baseline permissions 0.21.0

This release extends [Baseline 0.20.0](../0.20.0/README.md) with literal
\`sed -e\` expressions. It requires Shield \`>=0.57.0, <1.0.0\` for checking
the files named by each expression.

## Sed expressions

Use one or more supported \`-e\` expressions for reads or in-place edits.
For example, \`sed -i '' -e '1s/old/new/' -e '2s/left/right/' README.md\`
edits an approved file on macOS. On GNU sed, use \`--in-place\` for this
expression form. Supported in-place edits allow in Loose and Recommended
and ask in Strict. Read-only expressions allow in all profiles when their
files are readable under policy. Named reads and writes in in-place scripts
follow the same path checks as positional scripts.

Script files (\`-f\`), backup suffixes, blocks, shell execution and standalone
\`-e\` scripts that write named files require review.

## Shield inspection

On a matching Shield MCP connection, all profiles allow \`rule_list\` with a
\`pack_selector\` from \`pack_list\`. The \`invocations\` and \`command_sets\`
sections require that selector. \`policy_evaluate\` previews that match an MCP
server automatically show its resolved rule identity in \`data.mcp_match.server\`.
Use that identity in a custom MCP rule. CLI help and version commands are also
allowed. The [Shield connection and review boundaries](../0.19.0/README.md#shield-mcp)
and [locked pack recovery](../0.20.0/README.md#restore-locked-shield-packs) apply.

Generate with \`node scripts/build-baseline-sed-expressions.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/baseline-sed-expressions.test.mjs scripts/baseline-shield.test.mjs\`.

Licensed under MIT.
`;

async function build() {
  await mkdir(destination, {recursive: true});
  for (const [name, document] of [['pack.yml', await baselineSedExpressionsPack()],
    ['commands.json', await baselineSedExpressionsCommands()], ['cases.json', await baselineSedExpressionsCases()],
    ['cases-2.json', baselineShieldInspectionCases()]])
    await writeFile(new URL(name, destination), JSON.stringify(document, null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), guide);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();

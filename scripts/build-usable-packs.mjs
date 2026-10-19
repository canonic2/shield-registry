// Reviewed usability changes layered over immutable compact releases.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { baselineReads, baselineReviews, baselineDenied, gitReads, gitLocal, gitReviews, gitDangerous, append, updateExpected } from './usable-cases.mjs';

const previous = { baseline: '0.2.2', git: '0.5.0' };
export const versions = { baseline: '0.3.0', git: '0.6.0' };
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url)));
const decisions = values => Object.fromEntries(['loose', 'recommended', 'strict'].map((p, i) => [p, values[i]]));
const allow = decisions(['allow', 'allow', 'allow']);
const local = decisions(['allow', 'allow', 'ask']);
const options = (flags, values = [], operands = false, prefix = []) => ({ kind: 'options', prefix, flags,
  values: values.map(([name, regex]) => ({ name, match: { regex } })), operands });
const aliases = name => ({ one_of: [name, `/bin/${name}`, `/usr/bin/${name}`] });
const files = { match: { regex: '.+' }, min: 1, max: 256 };

export async function baseline() {
  const pack = await read('../packs/canonic/baseline/0.2.2/pack.yml');
  pack.version = versions.baseline;
  pack.engine = '>=0.1.8, <0.2.0';
  pack.description = 'Usable standard reads and local file operations within approved paths, with review of execution and remote effects.';
  const resources = pack.rules.find(r => r.id === 'read-rg').requirements.targets;
  const addRead = (name, grammar, id = `read-${name}`) => pack.rules.push({ id,
    conditions: { domain: 'argv', executable: aliases(name), arguments: grammar },
    decision: allow, requirements: { targets: structuredClone(resources) },
    on_unmet: { decision: decisions(['deny', 'deny', 'deny']), message: 'Read regular files in approved paths; credential files and unresolved targets remain protected.' } });
  const add = (name, grammar, id) => pack.rules.push({ id, conditions: { domain: 'argv', executable: aliases(name), arguments: grammar }, decision: allow });
  for (const [name, flags, values, max] of [
    ['sort', '-b -d -f -g -h -i -M -n -r -R -s -u -V', [['-k','[0-9A-Za-z.,]+'],['-t','.+']], 256],
    ['uniq', '-c -d -i -u', [['-f','[0-9]+'],['-s','[0-9]+']], 1],
    ['cut', '-n -s', [['-b','[0-9,-]+'],['-c','[0-9,-]+'],['-f','[0-9,-]+'],['-d','.+']], 256],
    ['diff', '-a -b -B -i -q -s -u -w --text --brief --report-identical-files --ignore-case --ignore-all-space --ignore-space-change --ignore-blank-lines', [['-U','[0-9]+']], 2],
    ['cmp', '-b -c -l -s --print-bytes --verbose --quiet --silent', [], 2],
  ]) addRead(name, options(flags.split(' '), values, { ...files, max, ...(max === 2 ? { min: 2 } : {}) }));
  const scripts = [
    ['sed', '(?:(?:[0-9]+|\\$)(?:,(?:[0-9]+|\\$))?)?p', ['-n','-E','-r','-u'], []],
    ['awk', '\\{\\s*print\\s+\\$[0-9]+(?:\\s*,\\s*\\$[0-9]+)*\\s*\\}', [], [['-F','.+']]],
    ['jq', '(?s)(?:\\.[A-Za-z0-9_\\[\\]". -]*|keys|keys_unsorted|length|type|sort|unique|values|tostring)(?:\\s*\\|\\s*(?:\\.[A-Za-z0-9_\\[\\]". -]*|keys|keys_unsorted|length|type|sort|unique|values|tostring))*',
      ['-r','-c','-e','-S','-M','-C','-a','-s','-R','--raw-output','--compact-output','--exit-status','--sort-keys','--monochrome-output','--color-output','--ascii-output','--slurp','--raw-input'], []],
  ];
  for (const [name, regex, flags, values] of scripts) {
    const grammar = { ...options([], [], false, [{ regex }]), leading: { flags, values: values.map(([name, regex]) => ({ name, match: { regex } })) } };
    // Files use the core's fixed program model as well as these declarations.
    // Stdin programs need that same exact syntax: use the explicit selector below.
    if (name === 'jq') {
      const key = '(?:[A-Za-z_][A-Za-z0-9_]*|\\[(?:[0-9]+|"[A-Za-z0-9_.-]+")?\\])';
      const path = `\\.(?:${key}(?:\\.?${key})*)?`;
      const part = `(?:${path}|keys|keys_unsorted|length|type|sort|unique|values|tostring)`;
      grammar.prefix = [{ regex: `\\s*${part}(?:\\s*\\|\\s*${part})*\\s*` }];
    }
    add(name, grammar, `stdin-${name}-read`);
    addRead(name, { ...structuredClone(grammar), operands: files });
  }
  add('date', { kind: 'sequence', prefix: [{ regex: '\\+[^\\x00]*' }], rest: { kind: 'none' } }, 'date-format');
  add('df', options(['-h','-H','-k','-m','-i','-P','-T','--human-readable','--si','--inodes','--portability','--print-type','--total'], [], true), 'filesystem-space');
  for (const rule of pack.rules) {
    for (const feedback of [rule.guidance, rule.on_unmet]) {
      if (!feedback) continue;
      const executable = rule.conditions.executable?.one_of ?? [];
      if (executable.includes('sed') || executable.includes('awk') || executable.includes('sort')) {
        feedback.message = 'Simple read forms are allowed. Unlisted programs, file-writing options and helpers need review.';
        feedback.alternatives = ['Use sed -n RANGEp FILE, awk \'{print $1}\' FILE, jq .FIELD FILE, or supported sort/uniq/cut file reads.'];
      }
    }
  }
  return pack;
}

const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export async function git() {
  const pack = await read('../packs/canonic/git/0.5.0/pack.yml');
  pack.version = versions.git;
  pack.engine = '>=0.1.8, <0.2.0';
  pack.capabilities.push('regex-v1');
  pack.capabilities.sort();
  const find = id => pack.rules.find(r => r.id === id);
  const form = name => pack.rules.find(r => r.conditions.arguments?.kind === 'options' && r.conditions.arguments.prefix.join(' ') === name);
  const add = (id, grammar, decision, reason) => pack.rules.push({ id, invocation: 'git', conditions: { domain: 'argv', executable: 'git', arguments: grammar }, decision, reason });
  for (const command of ['log','show','rev-list','status']) {
    const grammar = form(command).conditions.arguments;
    const flags = [...grammar.flags, ...(grammar.optional_values ?? []).map(v => typeof v === 'string' ? v : v.name), '--', ...(command === 'status' ? ['-u'] : [])];
    const valued = [...grammar.values, ...(grammar.optional_values ?? [])].map(v => typeof v === 'string' ? v : v.name);
    const short = flags.filter(f => /^-[A-Za-z]$/.test(f)).map(f => f.slice(1)).join('');
    const patterns = ['[^-][\\s\\S]*', ...(command === 'status' ? [] : ['-[0-9]+']), ...flags.map(escape), ...(short ? [`-[${short}]+`] : []),
      ...valued.map(v => v.startsWith('--') ? `${escape(v)}=[\\s\\S]+` : `${escape(v)}[\\s\\S]+`)];
    add(`read-${command}-shorthand`, { kind: 'sequence', prefix: [command], rest: { kind: 'each', match: { regex: `(?:${patterns.join('|')})` }, min: 0, max: 256 } }, allow,
      'Inspect history with numeric count shorthand and known read-only flags; output files and explicit helpers still need review.');
  }
  const branch = structuredClone(form('branch').conditions.arguments);
  delete branch.require_any;
  branch.operands = false;
  add('read-branch-no-operands', branch, allow, 'List branches with familiar verbose flags without changing refs.');
  add('delete-merged-branch', options(['-d','--delete','-q','--quiet','-v','--verbose'], [], files, ['branch']), local,
    'Delete branches with Git’s merged-history check; forced deletion remains protected.');
  pack.rules.at(-1).conditions.arguments.require_any = ['-d','--delete'];
  const deletion = find('deleting-or-replacing-branch').conditions.arguments;
  deletion.any_of = deletion.any_of.filter(t => !['-d','--delete'].includes(t));
  const rewrite = find('rewrite-or-hook-bypass').conditions.arguments;
  rewrite.any_of = rewrite.any_of.filter(t => t !== '--amend');
  add('review-commit-amend', { kind: 'risk_tokens', prefix: ['commit'], any_of: ['--amend'] }, decisions(['ask','ask','ask']),
    'Amending changes the latest commit and needs review; bypassing hooks remains separately protected.');
  const destructiveSet = Object.values(pack.command_sets).find(set => set.rebase);
  delete destructiveSet.rebase;
  add('base-rebase', { kind: 'prefix', values: ['rebase'] }, decisions(['ask','ask','deny']), 'Review a local history rewrite before starting it.');
  add('rebase-hook-bypass', { kind: 'risk_tokens', prefix: ['rebase'], any_of: ['--no-verify'] }, decisions(['ask','deny','deny']),
    'Skipping the pre-rebase hook remains protected independently of ordinary rewrite review.');
  for (const flag of ['--continue','--abort','--quit']) {
    add(`rebase-${flag.slice(2)}`, options([flag], [], false, ['rebase']), local,
      'Continue or end an existing rebase transaction; Strict reviews local changes.');
    // An option-free rebase is not a transaction-control request.
    pack.rules.at(-1).conditions.arguments.require_any = [flag];
  }
  add('gc-routine', options(['--auto','--quiet','-q'], [], false, ['gc']), local,
    'Run Git’s ordinary garbage collection; explicit pruning overrides remain protected.');
  add('read-reflog', options([], [['-n','[0-9]+'],['--max-count','[0-9]+']], false, ['reflog']), allow, 'Read the default reflog without expiring or deleting entries.');
  add('stash-default', { kind: 'exact', values: ['stash'] }, local, 'Save local changes using Git’s default stash operation.');
  const init = structuredClone(form('init').conditions.arguments);
  init.operands = { match: '.', min: 1, max: 1 };
  add('init-current-directory', init, local, 'Initialize the current directory without arbitrary destination paths.');
  return pack;
}

export async function build(name) {
  const output = new URL(`../packs/canonic/${name}/${versions[name]}/`, import.meta.url);
  const pack = await ({ baseline, git })[name]();
  await mkdir(output, { recursive: true });
  await writeFile(new URL('pack.yml', output), JSON.stringify(pack, null, 2) + '\n');
  const fixtures = await read(`../packs/canonic/${name}/${previous[name]}/cases.json`);
  updateExpected(name, fixtures.cases);
  if (name === 'baseline') {
    append(fixtures.cases, baselineReads, ['allow','allow','allow']);
    append(fixtures.cases, baselineReviews, ['ask','ask','ask']);
    append(fixtures.cases, baselineDenied, ['deny','deny','deny']);
  } else {
    // Historical 1,023 cases run separately against this release: the core's
    // fixture admission limit is 1,024 per document. Keep new cases standalone.
    fixtures.cases = [];
    append(fixtures.cases, gitReads, ['allow','allow','allow'], 'git');
    append(fixtures.cases, gitLocal, ['allow','allow','ask'], 'git');
    append(fixtures.cases, gitReviews, ['ask','ask','ask'], 'git');
    append(fixtures.cases, gitDangerous, ['ask','deny','deny'], 'git');
  }
  await writeFile(new URL('cases.json', output), JSON.stringify(fixtures, null, 2) + '\n');
  for (const asset of ['LICENSE','commands.json']) await copyFile(new URL(`../packs/canonic/${name}/${previous[name]}/${asset}`, import.meta.url), new URL(asset, output));
  if (name === 'baseline') {
    const inventory = await read(`../packs/canonic/baseline/${previous.baseline}/commands.json`);
    for (const command of inventory.commands) {
      const matched = pack.rules.filter(r => r.conditions.executable?.one_of?.includes(command.name));
      const additions = matched.filter(r => !command.rule_ids.includes(r.id)).map(r => r.id);
      command.rule_ids = matched.map(r => r.id);
      command.source_rule_ids.push(...additions);
    }
    await writeFile(new URL('commands.json', output), JSON.stringify(inventory, null, 2) + '\n');
  }
  return pack;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const name of ['baseline','git']) console.log(`${name}: ${(await build(name)).rules.length} shared bodies`);
}

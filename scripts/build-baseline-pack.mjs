import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compactBaselinePack } from './baseline-compact.mjs';

export function buildBaselinePack({ version = '0.1.5', compact = false } = {}) {
const profiles = values => Object.fromEntries(['loose', 'recommended', 'strict'].map((p, i) => [p, values[i]]));
const allow = ['allow', 'allow', 'allow'];
const local = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'ask'];
const deny = ['deny', 'deny', 'deny'];
const rules = [];
// Agents can propose an outside folder; the user approves it.
const outsideFolder = 'To use a folder outside the project, propose it with shield_policy_propose (access_path_add); the user approves it with shield policy.';
const executableNames = name => [name, `/bin/${name}`, `/usr/bin/${name}`];
const executableSelector = name => ({ one_of: executableNames(name) });
const argv = (id, executable, arguments_, decisions = allow) => rules.push({ id, conditions: { domain: 'argv', executable: executableSelector(executable), arguments: arguments_ }, decision: profiles(decisions) });
const options = (flags = [], values = [], operands = false, prefix = []) => ({ kind: 'options', prefix, flags, values, operands });
const path = (root, write = false) => ({ within: { root }, ...(write ? {
  exclude: ['.git', '.shield', '.claude', '.codex', '.mcp.json'].map(path => ({ root: 'write', path })),
  match: { regex: '.+' },
} : { exclude:['.ssh','.aws','.config/gcloud','.kube'].map(path=>({root:'read',path})) }) });
const target = (action, root, write = false) => ({ action, all: path(root, write) });
const bounded = (id, executable, grammar, targets, decisions = allow, feedback = {}) => rules.push({
  id, conditions: { domain: 'argv', executable: executableSelector(executable) }, decision: profiles(decisions),
  requirements: { arguments: grammar, targets }, on_unmet: {
    decision: profiles(deny), message: 'Use supported literal options and approved paths; protected metadata and unverified targets are blocked.',
    alternatives: [outsideFolder],
    ...feedback,
  },
});

for (const executable of ['true', 'false', ':']) argv(`constant-${executable === ':' ? 'colon' : executable}`, executable, { kind: 'exact', values: [] });
for (const executable of ['echo', 'printf', 'basename', 'dirname']) argv(`text-${executable}`, executable, { kind: 'any' });
argv('pwd', 'pwd', options(['-L', '-P']));
argv('date', 'date', { kind: 'exact', values: [] });
argv('uname', 'uname', options(['-a', '-m', '-n', '-p', '-r', '-s', '-v']));
argv('sleep', 'sleep', { kind: 'sequence', prefix: [], rest: { kind: 'each', match: { regex: '[0-9]+(?:\\.[0-9]+)?' }, min: 1, max: 1 } });

const operands = { match: { regex: '.+' }, min: 1, max: 256 };
const readGuidance = {
  message: 'Use supported literal options and approved paths; protected metadata and unverified targets are blocked.',
  alternatives: [outsideFolder],
};
for (const [executable, flags, values] of [
  ['cat', ['-b','-e','-n','-s','-t','-u','-v','-E','-T'], []],
  ['head', ['-q','-v'], [{ name: '-n', match: { regex: '[0-9]+' } }, { name: '-c', match: { regex: '[0-9]+' } }]],
  ['tail', ['-q','-v'], [{ name: '-n', match: { regex: '\\+?[0-9]+' } }, { name: '-c', match: { regex: '\\+?[0-9]+' } }]],
  ['wc', ['-c','-l','-m','-w'], []],
  ['ls', ['-a','-A','-d','-F','-h','-i','-l','-m','-n','-p','-q','-r','-s','-S','-t','-1'], []],
]) {
  if (executable === 'ls') {
    bounded('read-ls', executable, options(flags, values, true), target('read', 'read'));
    continue;
  }
  // Each supported form is its own conditioned rule, so stdin forms such as
  // `| wc -l` and historical `head -50` counts never meet a file-form rule.
  // The argument-free fallback ranks below them and denies every other form.
  const prefixes = ['head', 'tail'].includes(executable) ? [[], [{ regex: '-[0-9]+' }]] : [[]];
  for (const prefix of prefixes) {
    const suffix = prefix.length ? '-count' : '';
    argv(`stdin-${executable}${suffix}`, executable, options(flags, values, false, prefix));
    rules.push({ id: `read-${executable}${suffix}`, conditions: { domain: 'argv', executable: executableSelector(executable), arguments: options(flags, values, operands, prefix) },
      decision: profiles(allow), requirements: { targets: target('read', 'read') }, on_unmet: { decision: profiles(deny), ...readGuidance } });
  }
  argv(`unsupported-${executable}`, executable, { kind: 'any' }, deny);
  rules.at(-1).guidance = readGuidance;
}
// Text filters reading a pipe open no file. File operands, output files and
// sort's temporary directory remain with their review rules.
const list = { regex: '[0-9,-]+' };
argv('stdin-sort', 'sort', options(['-b','-d','-f','-g','-h','-i','-M','-n','-r','-R','-s','-u','-V'], [{ name: '-k', match: { regex: '[0-9A-Za-z.,]+' } }, { name: '-t', match: { regex: '.+' } }]));
argv('stdin-uniq', 'uniq', options(['-c','-d','-i','-u'], [{ name: '-f', match: { regex: '[0-9]+' } }, { name: '-s', match: { regex: '[0-9]+' } }]));
argv('stdin-cut', 'cut', options(['-n','-s'], [{ name: '-b', match: list }, { name: '-c', match: list }, { name: '-f', match: list }, { name: '-d', match: { regex: '.+' } }]));
argv('text-tr', 'tr', options(['-c','-C','-d','-s'], [], { match: { regex: '.+' }, min: 1, max: 2 }));
bounded('remove-rm', 'rm', options(['-f','-i','-r','-R','-v'], [], operands), target('remove', 'write', true), local);
bounded('remove-rmdir', 'rmdir', options([], [], operands), target('remove', 'write', true), local);
bounded('copy-cp', 'cp', options(['-i','-n','-v'], [], { match: { regex: '.+' }, min: 2, max: 256 }), [target('read','read'),target('write','write',true)], local);
bounded('move-mv', 'mv', options(['-i','-n','-v'], [], { match: { regex: '.+' }, min: 2, max: 256 }), [target('remove','write',true),target('write','write',true)], local);
bounded('read-grep', 'grep', options(['-E','-F','-G','-i','-n','-l','-c','-q','-v','-w','-x','-H','-h'], [], { match: { regex: '.+' }, min: 2, max: 256 }), target('read','read'), allow, {
  message:'Search explicit regular files in approved readable paths; directory walks, pattern files and unknown options are blocked.',
  alternatives:['Use grep FLAGS -- PATTERN FILE... with supported flags before the pattern.'],
});
// Configuration can add helpers or link following, so --no-config is always
// required. Shield's model also needs --no-ignore and no -g to search a
// directory's contents, since ignore files and globs can include hidden files;
// explicit files and --files listings need only --no-config.
const rgNumber = { regex: '[0-9]+' }, rgType = { regex: '[A-Za-z0-9_+-]+' };
bounded('read-rg', 'rg', { ...options(
  ['--no-config','--no-ignore','--no-follow','--no-hidden','--files','--smart-case','--ignore-case','--line-number',
    '--files-with-matches','--count','--fixed-strings','--word-regexp','--no-heading','--with-filename',
    '-i','-n','-l','-c','-q','-F','-w','-x','-S','-H'],
  [['-g',{regex:'.+'}],['--glob',{regex:'.+'}],['-t',rgType],['--type',rgType],['-T',rgType],['--type-not',rgType],
    ...['-C','--context','-A','--after-context','-B','--before-context','-m','--max-count','-d','--max-depth'].map(name=>[name,rgNumber])]
    .map(([name,match])=>({ name, match })),
  { match: { regex: '.+' }, min: 0, max: 256 }), require_all:['--no-config'] }, target('read','read'), allow, {
  message:'Add --no-config: a ripgrep configuration can run helpers or follow links Shield cannot see. Searching a directory also needs --no-ignore and no -g, because ignore files and globs can include hidden files.',
  alternatives:['rg --no-config --no-ignore -n PATTERN [DIR...]','rg --no-config -n PATTERN FILE...','rg --no-config --files [DIR...]'],
});
// find lists the entries that exist in approved trees. Helper actions, output
// files and link following outrank that path decision and need review.
argv('review-find-actions','find',{kind:'risk_tokens',prefix:[],any_of:['-exec','-execdir','-ok','-okdir','-delete','-follow','-fls',{regex:'-fprint0?|-fprintf'},{regex:'-[EPXdsx]*[HL][EHLPXdsx]*'}]},review);
rules.at(-1).guidance = {
  message:'find actions run commands, delete or write files, or follow links, so they need approval; listing and reading do not.',
  alternatives:['List with find PATH -type f -name PATTERN, then read each file with head, cat or rg --no-config --no-ignore.'],
};
rules.push({ id:'read-find', conditions:{ domain:'argv', executable:executableSelector('find'), arguments:{ kind:'any' } }, decision:profiles(allow),
  requirements:{ targets:target('read','read') }, on_unmet:{ decision:profiles(deny),
    message:'List approved readable trees with supported tests; excluded credential directories, outside paths and unmodeled primaries are blocked.',
    alternatives:['Use find PATH... with tests such as -name, -path, -type, -maxdepth, -size or -mtime and -print/-print0 output.'] } });
bounded('write-mkdir', 'mkdir', options(['-p'], [], operands), target('write','write',true), local, {
  message:'Create directories only in approved writable paths, without parent traversal or protected metadata.',
  alternatives:['Use mkdir -p -- PATH... without .. components or unlisted options.'],
});
bounded('write-touch', 'touch', options(['-a','-m','-c'], [], operands), target('write','write',true), local, {
  message:'Touch only approved writable paths; reference files, date options, stdout and protected metadata are blocked.',
  alternatives:['Use touch -- PATH... or listed -a/-m/-c flags before the operands.'],
});
// A root itself must remain intact, including an approved root nested in another.
rules.push({ id: 'preserve-access-roots', conditions: { domain: 'argv', executable: { one_of: ['rm','rmdir','mv'].flatMap(executableNames) }, arguments: { kind: 'any' }, targets: { action:'remove', any:{ exact:{ root:'write' } } } }, decision:profiles(deny) });

for (const [action, targets, decisions] of [
  ['read', target('read','read'), allow],
  ['write', target('write','write',true), local],
  ['remove', target('remove','write',true), local],
  ['copy', [target('read','read'),target('write','write',true)], local],
  ['move', [target('remove','write',true),target('write','write',true)], local],
]) rules.push({ id:`file-${action}`, conditions:{ domain:'file',action }, decision:profiles(decisions), requirements:{ targets }, on_unmet:{ decision:profiles(deny), message:'Use approved access paths and preserve protected metadata.' } });
rules.push({ id:'preserve-file-access-roots', conditions:{ domain:'file',action:{one_of:['remove','move']},targets:{action:'remove',any:{exact:{root:'write'}}}},decision:profiles(deny) });

// Reviewed tools whose common reading forms have an allowed equivalent say so,
// so an agent can resubmit instead of waiting for approval.
const pipeFilter = name => ({
  message:`${name} with file operands or unlisted options needs approval; reading a pipe with listed options does not.`,
  alternatives:[`Pipe the input instead: cat FILE | ${name} ...`],
});
const reviewGuidance = {
  sed:{ message:'sed can edit files and run commands, so it needs approval.',
    alternatives:['Read line ranges with head -n N FILE or tail -n +N FILE, search with rg --no-config --no-ignore -n PATTERN FILE, and edit files with the edit tool.'] },
  awk:{ message:'awk can write files and run commands, so it needs approval.',
    alternatives:['Select fields from a pipe with cut -d SEP -f LIST, and search with rg --no-config --no-ignore -n PATTERN FILE.'] },
  sort:pipeFilter('sort'), uniq:pipeFilter('uniq'), cut:pipeFilter('cut'),
};
// Git's detailed vocabulary remains in its dedicated pack. These forms make
// baseline-only installations useful without permitting helpers or global options.
argv('git-version','git',{kind:'exact',values:['--version']});
argv('git-status','git',options(['--short','--branch','--porcelain','-s','-b','-z'],[],false,['status']));
// Version checks print a version and run no project code; agents use both
// the long flag and each tool's own short spelling.
const shortVersion = { node:'-v', npm:'-v', npx:'-v', pnpm:'-v', yarn:'-v', bun:'-v', python:'-V', python3:'-V', cargo:'-V', rustc:'-V', uv:'-V' };
for (const executable of ['cargo','rustc','node','python','python3','npm','npx','pnpm','yarn','bun','uv','go','rg','grep','jq','gh','docker','make']) {
  argv(`version-${executable}`,executable,{kind:'exact',values:[executable==='go' ? 'version' : '--version']});
  if (shortVersion[executable]) argv(`version-${executable}-short`,executable,{kind:'exact',values:[shortVersion[executable]]});
}
// A new package manifest stays in the working folder; without --yes npm prompts.
rules.push({ id:'init-npm', conditions:{ domain:'argv', executable:executableSelector('npm'), arguments:{ ...options(['-y','--yes'],[],false,['init']), require_any:['-y','--yes'] } }, decision:profiles(local) });
// Why each reviewed family asks; prompts quote it next to the part that asked.
const reviewReasons = [
  [['npm','pnpm','yarn'], 'Package manager commands can install dependencies from the network or run project scripts.'],
  [['npx'], 'npx can download and run packages.'],
  [['uv','cargo','go'], 'Build, test and dependency commands run project code or download dependencies.'],
  [['make'], 'make runs the project\'s build recipes.'],
  [['node','python','python3','bash','sh','zsh'], 'Runs a program or script whose effects Shield cannot inspect.'],
  [['curl','wget'], 'Makes network requests.'],
  [['ssh','scp','rsync'], 'Connects to or copies files between machines.'],
  [['gh'], 'GitHub CLI commands can read or change remote repositories.'],
  [['docker','kubectl','aws','az','gcloud','terraform','tofu'], 'Manages containers or cloud resources outside the working folder.'],
  [['chmod','chown'], 'Changes file permissions or ownership.'],
  [['awk','sed','rg','grep','jq','sort','uniq','cut','tr','diff','cmp','stat','du','df','mkdir','touch'], 'Uses options or operands the supported forms do not cover.'],
];
// Broad reviews are fallbacks: a pack dedicated to the tool decides instead.
// Denials and requirement branches stay regular, so they still bind.
for (const [executables, reason] of reviewReasons) for (const executable of executables) {
  argv(`review-${executable}`,executable,{kind:'any'},review);
  Object.assign(rules.at(-1), { reason, fallback: true });
  if (reviewGuidance[executable]) rules.at(-1).guidance = reviewGuidance[executable];
}
for (const executable of ['sudo','su','doas','dd','shred','mkfs','fdisk','diskutil','mount','umount','reboot','shutdown','halt','poweroff']) argv(`deny-${executable}`,executable,{kind:'any'},deny);
for (const [executable, prefix] of [
  ['docker',['system','prune']], ['docker',['volume','rm']], ['docker',['rm']], ['docker',['rmi']],
  ['kubectl',['delete']], ['aws',['s3','rm']], ['aws',['s3','rb']],
  ['terraform',['destroy']], ['tofu',['destroy']],
]) argv(`deny-${executable}-${prefix.join('-')}`,executable,{kind:'prefix',values:prefix},deny);

const pack = { schema_version:1, kind:'pack', id:'canonic/baseline', version,
  description:'Standard command and file permissions with approved read/write paths and conservative review of unmodeled effects.',
  license:'MIT',maintainers:['Canonic'],engine:'>=0.1.0, <0.2.0',
  capabilities:['access-paths-v1','argument-rules-v1','fallback-rules-v1','location-v1','regex-v1','requirements-v1','structured-rules-v1'],rules };
return compact ? compactBaselinePack({ ...pack, engine: '>=0.1.1, <0.2.0' }).pack : pack;
}

export function baselineCommands(pack) {
const rules = pack.rules;
const names = [...new Set(rules.filter(r=>r.conditions.domain==='argv')
  .flatMap(r=>r.conditions.executable.one_of).filter(name=>!name.includes('/')))].sort();
const commands = names.map(name=>({name,rule_ids:rules.filter(r=>r.conditions.domain==='argv' && r.conditions.executable.one_of.includes(name)).map(r=>r.id)}));
return {schema_version:1,commands};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.argv[2] ? pathToFileURL(resolve(process.argv[2]) + '/') : new URL('../packs/canonic/baseline/0.1.5/', import.meta.url);
  await mkdir(root, { recursive: true });
  const pack = buildBaselinePack();
  await writeFile(new URL('pack.yml',root),JSON.stringify(pack,null,2)+'\n');
  await writeFile(new URL('commands.json',root),JSON.stringify(baselineCommands(pack),null,2)+'\n');
  console.log(`${pack.rules.length} baseline rules`);
}

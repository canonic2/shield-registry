import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.argv[2] ? pathToFileURL(resolve(process.argv[2]) + '/') : new URL('../packs/canonic/baseline/0.1.0/', import.meta.url);
await mkdir(root, { recursive: true });
const profiles = values => Object.fromEntries(['loose', 'recommended', 'strict'].map((p, i) => [p, values[i]]));
const allow = ['allow', 'allow', 'allow'];
const local = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'ask'];
const deny = ['deny', 'deny', 'deny'];
const rules = [];
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
    alternatives: ['Ask the operator to review access_paths in .shield/config.yml and confirm with shield policy.'],
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
for (const [executable, flags, values] of [
  ['cat', ['-b','-e','-n','-s','-t','-u','-v','-E','-T'], []],
  ['head', ['-q','-v'], [{ name: '-n', match: { regex: '[0-9]+' } }, { name: '-c', match: { regex: '[0-9]+' } }]],
  ['tail', ['-q','-v'], [{ name: '-n', match: { regex: '[0-9]+' } }, { name: '-c', match: { regex: '[0-9]+' } }]],
  ['wc', ['-c','-l','-m','-w'], []],
  ['ls', ['-a','-A','-d','-F','-h','-i','-l','-m','-n','-p','-q','-r','-s','-S','-t','-1'], []],
]) {
  bounded(`read-${executable}`, executable, options(flags, values, executable === 'ls' ? true : operands), target('read', 'read'));
  if (executable !== 'ls') argv(`stdin-${executable}`, executable, { kind:'exact', values:[] });
}
bounded('remove-rm', 'rm', options(['-f','-i','-r','-R','-v'], [], operands), target('remove', 'write', true), local);
bounded('remove-rmdir', 'rmdir', options([], [], operands), target('remove', 'write', true), local);
bounded('copy-cp', 'cp', options(['-i','-n','-v'], [], { match: { regex: '.+' }, min: 2, max: 256 }), [target('read','read'),target('write','write',true)], local);
bounded('move-mv', 'mv', options(['-i','-n','-v'], [], { match: { regex: '.+' }, min: 2, max: 256 }), [target('remove','write',true),target('write','write',true)], local);
bounded('read-grep', 'grep', options(['-E','-F','-G','-i','-n','-l','-c','-q','-v','-w','-x','-H','-h'], [], { match: { regex: '.+' }, min: 2, max: 256 }), target('read','read'), allow, {
  message:'Search explicit regular files in approved readable paths; directory walks, pattern files and unknown options are blocked.',
  alternatives:['Use grep FLAGS -- PATTERN FILE... with supported flags before the pattern.'],
});
bounded('read-rg', 'rg', { ...options(['--no-config','--no-ignore','--no-follow','--no-hidden','-i','-n','-l','-c','-q','-F','-w','-x'], [], { match: { regex: '.+' }, min: 2, max: 256 }), require_all:['--no-config','--no-ignore'] }, target('read','read'), allow, {
  message:'Disable configuration and ignore-file loading; search approved readable files or visible directory trees without following descendant links.',
  alternatives:['Use rg --no-config --no-ignore FLAGS -- PATTERN PATH... with supported flags before the pattern.'],
});
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

// Git's detailed vocabulary remains in its dedicated pack. These forms make
// baseline-only installations useful without permitting helpers or global options.
argv('git-version','git',{kind:'exact',values:['--version']});
argv('git-status','git',options(['--short','--branch','--porcelain','-s','-b','-z'],[],false,['status']));
for (const executable of ['cargo','rustc','node','python3','npm','pnpm','yarn','go','rg','grep','jq']) argv(`version-${executable}`,executable,{kind:'exact',values:[executable==='go' ? 'version' : '--version']});
for (const executable of ['awk','sed','find','rg','grep','jq','sort','uniq','cut','tr','diff','cmp','stat','du','df','mkdir','touch','chmod','chown','make','cargo','node','python','python3','bash','sh','zsh','npm','pnpm','yarn','npx','uv','go','curl','wget','ssh','scp','rsync','gh','docker','kubectl','aws','az','gcloud','terraform','tofu']) {
  argv(`review-${executable}`,executable,{kind:'any'},review);
}
for (const executable of ['sudo','su','doas','dd','shred','mkfs','fdisk','diskutil','mount','umount','reboot','shutdown','halt','poweroff']) argv(`deny-${executable}`,executable,{kind:'any'},deny);
for (const [executable, prefix] of [
  ['docker',['system','prune']], ['docker',['volume','rm']], ['docker',['rm']], ['docker',['rmi']],
  ['kubectl',['delete']], ['aws',['s3','rm']], ['aws',['s3','rb']],
  ['terraform',['destroy']], ['tofu',['destroy']],
]) argv(`deny-${executable}-${prefix.join('-')}`,executable,{kind:'prefix',values:prefix},deny);

const pack = { schema_version:1, kind:'pack', id:'canonic/baseline', version:'0.1.0',
  description:'Standard command and file permissions with approved read/write paths and conservative review of unmodeled effects.',
  license:'MIT',maintainers:['Canonic'],engine:'>=0.1.0, <0.2.0',
  capabilities:['access-paths-v1','argument-rules-v1','location-v1','regex-v1','requirements-v1','structured-rules-v1'],rules };
await writeFile(new URL('pack.yml',root),JSON.stringify(pack,null,2)+'\n');
const names = [...new Set(rules.filter(r=>r.conditions.domain==='argv')
  .flatMap(r=>r.conditions.executable.one_of).filter(name=>!name.includes('/')))].sort();
const commands = names.map(name=>({name,rule_ids:rules.filter(r=>r.conditions.domain==='argv' && r.conditions.executable.one_of.includes(name)).map(r=>r.id)}));
await writeFile(new URL('commands.json',root),JSON.stringify({schema_version:1,commands},null,2)+'\n');
console.log(`${rules.length} baseline rules`);

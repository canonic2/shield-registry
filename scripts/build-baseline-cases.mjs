// Reviewed expectations are independent of the generated rule inventory.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=process.argv[2] ? pathToFileURL(resolve(process.argv[2])+'/') : new URL('../packs/canonic/baseline/0.1.4/',import.meta.url);
await mkdir(root,{recursive:true});
const cases=[];
const add=(name,argv,expected)=>['loose','recommended','strict'].forEach((profile,i)=>cases.push({name:`${name}-${profile}`,profile,argv,expected:expected[i]}));
const allow=['allow','allow','allow'], local=['allow','allow','ask'], ask=['ask','ask','ask'], deny=['deny','deny','deny'];
for(const [name,argv] of [
  ['pwd',['pwd']],['list',['ls','-la']],['read',['cat','README.md']],['head',['head','-n','10','README.md']],
  ['tail',['tail','-c','20','README.md']],['count',['wc','-l','README.md']],['stdin',['cat']],
  ['head-attached',['head','-qn10','README.md']],
  ['head-count',['head','-10','README.md']],['tail-count',['tail','-20','README.md']],
  ['stdin-head-count',['head','-50']],['stdin-head-lines',['head','-n','20']],
  ['stdin-tail-lines',['tail','-n','5']],['stdin-count-lines',['wc','-l']],['stdin-number',['cat','-n']],
  ['head-count-one',['head','-1','README.md']],['stdin-head-count-odd',['head','-51']],
  ['stdin-tail-count-large',['tail','-100000']],['stdin-head-attached-lines',['head','-n51']],
  ['stdin-tail-bytes',['tail','-c','4096']],['stdin-head-quiet-count',['head','-3','-q']],
  ['tail-from-start',['tail','-n','+5','README.md']],['stdin-tail-from-start',['tail','-n+5']],
  ['find-default',['find']],['find-tree',['find','.','-name','*.md','-type','f']],
  ['find-depth',['find','-P','scripts','.','-maxdepth','1','-print0']],
  ['find-grouped',['find','.','(','-name','*.md','-o','-iname','*.mjs',')','!','-path','./node_modules/*']],
  ['stdin-sort',['sort','-rn']],['stdin-sort-key',['sort','-t',':','-k2,2n']],['stdin-uniq-count',['uniq','-c']],
  ['stdin-cut',['cut','-d:','-f1,3']],['tr-delete',['tr','-d','\\n']],['tr-map',['tr','a-z','A-Z']],
  ['grep',['grep','-nF','Acme','README.md']],['rg',['rg','--no-config','--no-ignore','-n','Acme','README.md']],
  ['rg-tree',['rg','--no-config','--no-ignore','Acme','.']],
  ['grep-dash-pattern',['grep','--','-Acme','README.md']],
  ['echo',['echo','Acme']],['printf',['printf','%s','Acme']],['git-status',['git','status','--short']],
  ['version',['node','--version']],['sleep',['sleep','0.01']],
  ['version-short-node',['node','-v']],['version-short-npm',['npm','-v']],['version-short-python',['python3','-V']],
  ['version-short-cargo',['cargo','-V']],['version-long-gh',['gh','--version']],
])add(name,argv,allow);
for(const [name,argv] of [
  ['remove',['rm','-rf','generated']],['remove-multiple',['rm','a','b']],['remove-literal-option',['rm','--','-generated']],
  ['rmdir',['rmdir','generated']],['copy',['cp','README.md','copy.md']],['move',['mv','old.md','new.md']],
  ['absolute-remove',['/bin/rm','generated']],
  ['mkdir',['mkdir','-p','generated/nested']],['touch',['touch','-am','generated.txt']],
  ['touch-literal-option',['touch','--','-generated']],
  ['npm-init',['npm','init','-y']],['npm-init-long',['npm','init','--yes']],
])add(name,argv,local);
for(const [name,argv] of [
  ['outside-remove',['rm','/shield-baseline-unapproved/item']],['outside-read',['cat','/shield-baseline-unapproved/item']],
  ['mixed-remove',['rm','generated','/shield-baseline-unapproved/item']],['root-remove',['rm','-rf','.']],
  ['git-remove',['rm','-rf','.git']],['state-remove',['rm','-rf','.shield']],
  ['option-unknown',['rm','--unclassified','generated']],['copy-recursive',['cp','-R','src','dst']],
  ['read-helper-option',['ls','-R']],['follow-monitor',['tail','-F','README.md']],
  ['stdin-follow-monitor',['tail','-f']],['count-outside',['head','-5','/shield-baseline-unapproved/item']],
  ['count-follow-monitor',['tail','-5','-F','README.md']],['count-credential-read',['head','-5','.aws/config']],
  ['privilege',['sudo','echo','Acme']],['device-write',['dd','if=README.md','of=/dev/disk0']],
  ['cloud-remove',['aws','s3','rm','s3://acme/item']],['destroy',['terraform','destroy']],
  ['docker-prune',['docker','system','prune','-af']],
  ['absolute-outside-remove',['/bin/rm','/shield-baseline-unapproved/item']],
  ['credential-read',['cat','.aws/config']],
  ['grep-outside',['grep','Acme','/shield-baseline-unapproved/item']],
  ['grep-recursive',['grep','-r','Acme','.']],
  ['rg-config',['rg','Acme','README.md']],['rg-helper',['rg','--no-config','--no-ignore','--pre','sh','Acme','README.md']],
  ['grep-pattern-file',['grep','-f','README.md','README.md']],
  ['outside-mkdir',['mkdir','-p','/shield-baseline-unapproved/new']],
  ['outside-touch',['touch','/shield-baseline-unapproved/new']],
  ['protected-mkdir',['mkdir','-p','.git/new']],['protected-touch',['touch','.git/config']],
  ['mkdir-parent',['mkdir','-p','.git/../generated']],['touch-descriptor',['touch','-']],
  ['touch-reference',['touch','-r','README.md','generated.txt']],
  ['grep-trailing-option',['grep','Acme','README.md','-f/outside']],
  ['touch-trailing-reference',['touch','generated.txt','--reference=/outside']],
  ['rg-trailing-config',['rg','Acme','--no-config','README.md']],
  ['rg-ignore-loading',['rg','--no-config','Acme','.']],
  ['rg-hidden-tree',['rg','--no-config','--no-ignore','--hidden','Acme','.']],
  ['rg-follow-tree',['rg','--no-config','--no-ignore','--follow','Acme','.']],
  ['rg-unrestricted-tree',['rg','--no-config','--no-ignore','-uu','Acme','.']],
  ['rg-glob-override',['rg','--no-config','--no-ignore','-g','*','Acme','.']],
  ['rg-hidden-explicit',['rg','--no-config','--no-ignore','Acme','.aws']],
  ['find-outside',['find','/shield-baseline-unapproved','-name','item']],['find-credential',['find','.aws']],
  ['find-unmodeled',['find','.','-newer','README.md']],['head-from-start',['head','-n','+5','README.md']],
])add(name,argv,deny);
for(const [name,argv] of [
  ['unknown',['acme-unlisted','read']],['script',['node','script.mjs']],['build',['cargo','build']],
  ['npm-init-interactive',['npm','init']],['npm-install',['npm','install','express']],
  ['npm-init-initializer',['npm','init','-y','acme-app']],
  ['find-helper',['find','.','-exec','sh','-c','echo Acme',';']],
  ['cloud-inspect',['aws','ec2','describe-instances']],['docker-inspect',['docker','inspect','acme']],
  ['git-global-option',['git','-C','/other','status']],
  ['find-delete',['find','.','-name','*.tmp','-delete']],['find-follow',['find','-L','.']],
  ['find-output-file',['find','.','-fprint','list.txt']],
  ['sort-output',['sort','-o','sorted.txt','README.md']],['uniq-output',['uniq','in.txt','out.txt']],
  ['cut-file',['cut','-f1','README.md']],
])add(name,argv,ask);
await writeFile(new URL('cases.json',root),JSON.stringify({schema_version:1,cases},null,2)+'\n');
console.log(`${cases.length} baseline cases`);

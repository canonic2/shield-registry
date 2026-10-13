// Reviewed expectations are independent of the generated rule inventory.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=process.argv[2] ? pathToFileURL(resolve(process.argv[2])+'/') : new URL('../packs/canonic/baseline/0.1.0/',import.meta.url);
await mkdir(root,{recursive:true});
const cases=[];
const add=(name,argv,expected)=>['loose','recommended','strict'].forEach((profile,i)=>cases.push({name:`${name}-${profile}`,profile,argv,expected:expected[i]}));
const allow=['allow','allow','allow'], local=['allow','allow','ask'], ask=['ask','ask','ask'], deny=['deny','deny','deny'];
for(const [name,argv] of [
  ['pwd',['pwd']],['list',['ls','-la']],['read',['cat','README.md']],['head',['head','-n','10','README.md']],
  ['tail',['tail','-c','20','README.md']],['count',['wc','-l','README.md']],['stdin',['cat']],
  ['head-attached',['head','-qn10','README.md']],
  ['echo',['echo','Acme']],['printf',['printf','%s','Acme']],['git-status',['git','status','--short']],
  ['version',['node','--version']],['sleep',['sleep','0.01']],
])add(name,argv,allow);
for(const [name,argv] of [
  ['remove',['rm','-rf','generated']],['remove-multiple',['rm','a','b']],['remove-literal-option',['rm','--','-generated']],
  ['rmdir',['rmdir','generated']],['copy',['cp','README.md','copy.md']],['move',['mv','old.md','new.md']],
  ['absolute-remove',['/bin/rm','generated']],
])add(name,argv,local);
for(const [name,argv] of [
  ['outside-remove',['rm','/shield-baseline-unapproved/item']],['outside-read',['cat','/shield-baseline-unapproved/item']],
  ['mixed-remove',['rm','generated','/shield-baseline-unapproved/item']],['root-remove',['rm','-rf','.']],
  ['git-remove',['rm','-rf','.git']],['state-remove',['rm','-rf','.shield']],
  ['option-unknown',['rm','--unclassified','generated']],['copy-recursive',['cp','-R','src','dst']],
  ['read-helper-option',['ls','-R']],['follow-monitor',['tail','-F','README.md']],
  ['privilege',['sudo','echo','Acme']],['device-write',['dd','if=README.md','of=/dev/disk0']],
  ['cloud-remove',['aws','s3','rm','s3://acme/item']],['destroy',['terraform','destroy']],
  ['docker-prune',['docker','system','prune','-af']],
  ['absolute-outside-remove',['/bin/rm','/shield-baseline-unapproved/item']],
  ['credential-read',['cat','.aws/config']],
])add(name,argv,deny);
for(const [name,argv] of [
  ['unknown',['acme-unlisted','read']],['script',['node','script.mjs']],['build',['cargo','build']],
  ['find-helper',['find','.','-exec','sh','-c','echo Acme',';']],['rg-config',['rg','--pre','sh','Acme']],
  ['cloud-inspect',['aws','ec2','describe-instances']],['docker-inspect',['docker','inspect','acme']],
  ['git-global-option',['git','-C','/other','status']],
])add(name,argv,ask);
await writeFile(new URL('cases.json',root),JSON.stringify({schema_version:1,cases},null,2)+'\n');
console.log(`${cases.length} baseline cases`);

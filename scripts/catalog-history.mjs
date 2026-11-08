// Ordered, content-addressed history pages authenticated by the signed catalog.
import {createHash} from 'node:crypto';

export const PAGE_SIZE = 64;
export const MAX_DEPTH = 16;
export const MAX_RELEASES = 4096;
export const MAX_PAGES = 128;
export const MAX_BYTES = 8 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const encoded = value => Buffer.from(JSON.stringify(value,null,2)+'\n');
const safePath = path => typeof path === 'string' && /^[a-zA-Z0-9._~/-]+$/.test(path)
  && path.split('/').every(part => part && part !== '.' && part !== '..');
const version = value => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,19})\.(0|[1-9][0-9]{0,19})\.(0|[1-9][0-9]{0,19})$/.test(value))
    throw Error('Invalid history version');
  const parts=value.split('.').map(BigInt);
  if(parts.some(part=>part>18446744073709551615n)) throw Error('Invalid history version');
  return parts;
};
export function compareVersions(left,right) {
  const a=version(left), b=version(right);
  for(let index=0;index<3;index++) if(a[index]!==b[index]) return a[index]<b[index]?-1:1;
  return 0;
}
export function checkReference(reference) {
  if(!reference || Object.keys(reference).sort().join(',')!=='first,last,path,sha256'
    || !safePath(reference.path) || !/^[a-f0-9]{64}$/.test(reference.sha256)
    || compareVersions(reference.first,reference.last)>0) throw Error('Invalid history reference');
}

export function buildHistory(entries) {
  const groups=new Map(), artifacts=[];
  for(const entry of entries) {
    const rows=groups.get(entry.id)??[];
    rows.push(entry); groups.set(entry.id,rows);
  }
  const packs=[], histories={};
  if(groups.size>4096) throw Error('Discovery exceeds 4096 current heads');
  for(const [id,rows] of [...groups].sort(([a],[b])=>a<b?-1:a>b?1:0)) {
    if(rows.length>MAX_RELEASES) throw Error(`History for ${id} exceeds ${MAX_RELEASES} releases`);
    let pages=0, totalBytes=0;
    rows.sort((a,b)=>compareVersions(a.version,b.version));
    if(rows.some((entry,index)=>index && entry.version===rows[index-1].version)) throw Error('Duplicate history release');
    const page=(body,first,last)=>{
      const bytes=encoded({schema_version:1,id,...body});
      if(bytes.length>1_048_576) throw Error('History page exceeds byte limit');
      totalBytes+=bytes.length;
      if(++pages>MAX_PAGES || totalBytes>MAX_BYTES) throw Error(`History for ${id} exceeds full-lookup page or byte limits`);
      const sha256=hash(bytes), path=`metadata/${sha256}.json`;
      artifacts.push([path,bytes]);
      return {path,sha256,first,last};
    };
    let level=[];
    for(let index=0;index<rows.length;index+=PAGE_SIZE) {
      const entries=rows.slice(index,index+PAGE_SIZE);
      level.push(page({entries},entries[0].version,entries.at(-1).version));
    }
    let depth=1;
    while(level.length>1) {
      if(++depth>MAX_DEPTH) throw Error('History tree exceeds depth limit');
      const next=[];
      for(let index=0;index<level.length;index+=PAGE_SIZE) {
        const children=level.slice(index,index+PAGE_SIZE);
        next.push(page({children},children[0].first,children.at(-1).last));
      }
      level=next;
    }
    histories[id]=level[0]; packs.push(rows.at(-1));
  }
  return {packs,histories,artifacts};
}

export function checkHistoryPage(id,reference,bytes) {
  checkReference(reference);
  if(bytes.length>1_048_576 || hash(bytes)!==reference.sha256) throw Error('History page digest mismatch or byte limit');
  const page=JSON.parse(bytes);
  if(page.schema_version!==1 || page.id!==id
    || Object.keys(page).some(key=>!['schema_version','id','entries','children'].includes(key))) throw Error('Invalid history page identity');
  const entries=page.entries??[], children=page.children??[];
  if(!Array.isArray(entries)||!Array.isArray(children)||!entries.length===!children.length
    ||entries.length>PAGE_SIZE||children.length>PAGE_SIZE) throw Error('Invalid history page shape');
  if(entries.length) {
    for(const [index,entry] of entries.entries()) {
      if(Object.keys(entry).sort().join(',')!=='id,path,sha256,version' ||entry.id!==id
        ||!safePath(entry.path)||!/^[a-f0-9]{64}$/.test(entry.sha256)
        ||index && compareVersions(entries[index-1].version,entry.version)>=0) throw Error('Invalid history entry');
      version(entry.version);
    }
    if(entries[0].version!==reference.first||entries.at(-1).version!==reference.last) throw Error('History range mismatch');
  } else {
    for(const [index,child] of children.entries()) {
      checkReference(child);
      if(index && compareVersions(children[index-1].last,child.first)>=0) throw Error('Overlapping history ranges');
    }
    if(children[0].first!==reference.first||children.at(-1).last!==reference.last) throw Error('History range mismatch');
  }
  return {entries,children};
}

export async function historyEntries(catalog,read) {
  if(catalog.schema_version!==3) return catalog.packs;
  const releases=[];
  for(const head of catalog.packs) {
    const pending=[[catalog.histories[head.id],1]], seen=new Set();
    const rows=[];
    let totalBytes=0;
    while(pending.length) {
      const [reference,depth]=pending.pop();
      if(depth>MAX_DEPTH||seen.has(reference.path)) throw Error('History tree depth or cycle');
      seen.add(reference.path);
      const bytes=await read(reference.path);
      totalBytes+=bytes.length;
      if(seen.size>MAX_PAGES || totalBytes>MAX_BYTES) throw Error(`History for ${head.id} exceeds full-lookup page or byte limits`);
      const page=checkHistoryPage(head.id,reference,bytes);
      rows.push(...page.entries);
      if(rows.length>MAX_RELEASES) throw Error(`History for ${head.id} exceeds ${MAX_RELEASES} releases`);
      pending.push(...page.children.map(child=>[child,depth+1]));
    }
    rows.sort((a,b)=>compareVersions(a.version,b.version));
    const latest=rows.at(-1);
    if(!latest||['id','version','path','sha256'].some(key=>latest[key]!==head[key])) throw Error('History head mismatch');
    releases.push(...rows);
  }
  return releases;
}

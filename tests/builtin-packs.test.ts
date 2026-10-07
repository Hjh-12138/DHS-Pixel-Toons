import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFile,writeFile,unlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {randomUUID} from 'node:crypto'
import {resolvePackClip,checkFrameBounds,PACK_LIMITS,type LocalPack} from '../src/client/resource-pack'
import {readBuiltinPackArchive} from '../src/builtin-pack-files'
type Library=typeof import('../src/client/builtin-packs')
async function withLibrary(run:(library:Library)=>Promise<void>){
  // A fresh module gives each test an independent selected-pack cache.
  const bundle=await build({entryPoints:['src/client/builtin-packs.ts'],bundle:true,write:false,platform:'node',format:'esm',metafile:true})
  assert.ok(!Object.keys(bundle.metafile!.inputs).some(path=>path.endsWith('.zip')),'production descriptors must not import any ZIP')
  const path=join(tmpdir(),`dsh-toons-builtins-${randomUUID()}.mjs`)
  await writeFile(path,bundle.outputFiles[0]!.contents)
  try{await run(await import(pathToFileURL(path).href))}finally{await unlink(path)}
}
const archive=async(id:string)=>new Blob([await readFile(new URL(`../examples/character-packs/${id.slice('builtin-'.length)}.toons.zip`,import.meta.url))])

test('six named descriptors load selected local Host archives and preserve imported IDs',async()=>withLibrary(async library=>{
  assert.equal(library.builtinPacks.length,6)
  assert.deepEqual(library.builtinPacks.map(p=>p.manifest.name),['Kimi','Gemini','Claude','Qwen','Grok','GLM'])
  let reads=0
  const reader=async(id:string)=>{reads++;return library.builtinArchiveFromResponse(id,await readBuiltinPackArchive(id))}
  assert.equal(reads,0,'descriptors do not fetch or unpack archives eagerly')
  for(const descriptor of library.builtinPacks){
    assert.ok(descriptor.id.startsWith('builtin-'));assert.ok(library.isBuiltinPack(descriptor.id));assert.deepEqual(descriptor.assets,{})
    const pack=await library.resolveLibraryPack(descriptor,reader)
    assert.equal(pack.id,descriptor.id);assert.equal(pack.manifest.id,descriptor.id)
    assert.equal(await library.resolveLibraryPack(descriptor,reader),pack)
    assert.ok(pack.assets['walk-left.png'])
    const character=pack.manifest.character!
    checkFrameBounds(character,{core:{width:1024,height:1536},work:{width:1024,height:1536},reaction:{width:1024,height:1536},walk:{width:1024,height:512}})
    const left=resolvePackClip(character,'walk-left'),right=resolvePackClip(character,'walk-right')
    assert.equal(left.clip.frames.length,8);assert.ok(left.clip.frames.every(f=>f.atlas==='walk'&&f.durationMs===100));assert.ok(right.mirror)
    for(const action of ['idle','think','search','read','type','check','success','failed'] as const)assert.equal(resolvePackClip(character,action).clip.frames.length,8)
  }
  assert.equal(reads,6)
  const original:LocalPack={...library.builtinPacks[0]!,id:'silver-music'}
  assert.equal(await library.resolveLibraryPack(original,reader),original);assert.equal(reads,6)
  assert.equal(library.withBuiltinPacks([original]).length,7);assert.equal(library.withBuiltinPacks([library.builtinPacks[0]!]).length,6)
}))

test('selected builtin loads deduplicate pending work, retry failures and reject another character archive',async()=>withLibrary(async library=>{
  const [silver,purple,orange]=library.builtinPacks
  let attempts=0
  const flaky=async(id:string)=>{if(++attempts===1)throw new Error('Host unavailable');return archive(id)}
  await assert.rejects(library.resolveLibraryPack(silver!,flaky),/Host unavailable/)
  assert.equal((await library.resolveLibraryPack(silver!,flaky)).id,silver!.id);assert.equal(attempts,2)
  let release!:()=>void,reads=0
  const blocked=new Promise<void>(resolve=>{release=resolve})
  const reader=async(id:string)=>{reads++;await blocked;return archive(id)}
  const first=library.resolveLibraryPack(purple!,reader),second=library.resolveLibraryPack(purple!,reader)
  assert.equal(first,second);assert.equal(reads,1);release()
  assert.equal(await first,await second)
  await assert.rejects(library.resolveLibraryPack(orange!,()=>archive('builtin-blue-fan')),/内置角色读取失败/)
  assert.equal((await library.resolveLibraryPack(orange!,archive)).id,orange!.id,'wrong archive failure does not poison retry')
}))

test('builtin RPC responses validate identity, base64 and size before decoding',async()=>withLibrary(async library=>{
  const id='builtin-silver-music'
  assert.deepEqual(new Uint8Array(await library.builtinArchiveFromResponse(id,{id,archive:'AAECAw=='}).arrayBuffer()),new Uint8Array([0,1,2,3]))
  for(const value of [undefined,null,[],{}, {id:'builtin-blue-fan',archive:'AA=='}, {id,archive:1}, {id,archive:''}, {id,archive:'A==='}, {id,archive:'A=AA'}, {id,archive:'AA!A'}, {id,archive:'AAA'}, {id,archive:'data:application/zip;base64,AA=='}])assert.throws(()=>library.builtinArchiveFromResponse(id,value),/内置角色读取失败/)
  assert.throws(()=>library.builtinArchiveFromResponse('../silver-music',{id:'../silver-music',archive:'AA=='}))
  assert.throws(()=>library.builtinArchiveFromResponse(id,{id,archive:'A'.repeat(4*Math.ceil(PACK_LIMITS.archive/3)+4)}),/内置角色读取失败/)
}))

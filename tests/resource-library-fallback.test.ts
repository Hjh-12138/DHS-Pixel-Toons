/// <reference path="../src/client/assets.d.ts" />
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFile,writeFile,unlink} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {pathToFileURL} from 'node:url'
import {randomUUID} from 'node:crypto'
import {DEFAULT_PREFERENCES,type Preferences} from '../src/client/preferences'
import type {LocalPack} from '../src/client/resource-pack'
import type {useResourcePacks} from '../src/client/use-resource-packs'

// Model hook state, dependency changes, effect cleanup and async rerenders.
// The real useResourcePacks body and builtin resolver are bundled unchanged.
const hooks=`
let active;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const slot=()=>{const h=active,i=h.cursor++;return [h,i,h.slots[i]]};
export function useState(value){const [h,i,s]=slot();if(!s)h.slots[i]={value:typeof value==='function'?value():value};return [h.slots[i].value,next=>{const previous=h.slots[i].value,result=typeof next==='function'?next(previous):next;if(!Object.is(previous,result)){h.slots[i].value=result;h.dirty=true}}]}
export function useRef(value){const [h,i,s]=slot();if(!s)h.slots[i]={current:value};return h.slots[i]}
export function useCallback(callback,deps){const [h,i,s]=slot();if(!s||!same(s.deps,deps))h.slots[i]={value:callback,deps};return h.slots[i].value}
export function useEffect(effect,deps){const [h,i,s]=slot();if(!s||!same(s.deps,deps)){h.slots[i]={deps,cleanup:s?.cleanup};h.effects.push(()=>{h.slots[i].cleanup?.();h.slots[i].cleanup=effect()})}}
export function createHarness(run){const h={cursor:0,slots:[],effects:[],dirty:true,value:undefined};return {
 invalidate(){h.dirty=true},get value(){return h.value},
 async flush(){for(let i=0;i<400;i++){if(h.dirty){h.dirty=false;h.cursor=0;active=h;h.value=run();active=undefined;const effects=h.effects.splice(0);for(const effect of effects)effect()}await new Promise(resolve=>setTimeout(resolve,5));if(!h.dirty&&h.value.loaded&&!h.value.busy)return h.value}throw Error('Hook did not settle')},
 dispose(){for(const s of h.slots)s?.cleanup?.()}
}}
`
type Harness={value:ReturnType<typeof useResourcePacks>;invalidate:()=>void;flush:()=>Promise<ReturnType<typeof useResourcePacks>>;dispose:()=>void}
async function setup(initial:Partial<Preferences>,list:()=>Promise<LocalPack[]>,reader?:(id:string)=>Promise<Blob>){
  const bundle=await build({stdin:{contents:"export {useResourcePacks} from './src/client/use-resource-packs';export {createHarness} from 'react';export {setList,setLoadFailure} from './src/client/resource-store'",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',loader:{'.zip':'dataurl'},plugins:[{name:'hook-mocks',setup(b){
    b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'hooks'}))
    b.onLoad({filter:/.*/,namespace:'hooks'},()=>({contents:hooks}))
    b.onResolve({filter:/resource-store$/},()=>({path:'store',namespace:'store'}))
    b.onLoad({filter:/.*/,namespace:'store'},()=>({contents:"let list=async()=>[];export const setList=fn=>list=fn;export const listLocalPacks=()=>list();export const PACKS_CHANGED='packs-changed';export const deleteLocalPack=async()=>{};export const saveLocalPack=async()=>{};export let failure='';export const setLoadFailure=value=>failure=value;"}))
    b.onResolve({filter:/^\.\/resource-pack$/},args=>args.importer.endsWith('use-resource-packs.ts')?({path:'images',namespace:'images'}):undefined)
    b.onLoad({filter:/.*/,namespace:'images'},()=>({contents:"import {failure} from 'store';export const loadPackResources=async pack=>{if(failure)throw Error(failure);return {character:pack.manifest.character?{id:pack.id}:undefined,scene:pack.manifest.scene?{id:pack.id}:undefined}};export const readLocalPack=async()=>{throw Error('Import not expected')};"}))
    b.onResolve({filter:/^store$/},()=>({path:'store',namespace:'store'}))
  }}]})
  const path=join(tmpdir(),`dsh-toons-library-hook-${randomUUID()}.mjs`)
  await writeFile(path,bundle.outputFiles[0]!.contents)
  const module=await import(pathToFileURL(path).href)
  module.setList(list)
  const previousWindow=globalThis.window,events=new Map<string,()=>void>()
  globalThis.window={addEventListener:(name:string,callback:()=>void)=>events.set(name,callback),removeEventListener:(name:string)=>events.delete(name)} as unknown as Window & typeof globalThis
  let prefs:Preferences={...DEFAULT_PREFERENCES,...initial}
  const changes:Partial<Preferences>[]=[]
  const settings=(change:Partial<Preferences>)=>{changes.push(change);prefs={...prefs,...change};harness.invalidate()}
  const readArchive=reader??(async(id:string)=>new Blob([await readFile(new URL(`../examples/character-packs/${id.slice('builtin-'.length)}.toons.zip`,import.meta.url))]))
  const harness:Harness=module.createHarness(()=>module.useResourcePacks(prefs,settings,readArchive))
  return {harness,changes,get prefs(){return prefs},setList:module.setList as (fn:()=>Promise<LocalPack[]>)=>void,setLoadFailure:module.setLoadFailure as (message:string)=>void,refresh:()=>events.get('packs-changed')!(),dispose:async()=>{harness.dispose();globalThis.window=previousWindow;await unlink(path)}}
}
const local=(id:string,role:'character'|'scene')=>({id,manifest:{[role]:{}},assets:{},importedAt:1}) as LocalPack

test('failed initial enumeration preserves saved IDs and storage error while builtin choices remain usable',async()=>{
  const state=await setup({characterPackId:'custom-character',scenePackId:'custom-scene'},async()=>{throw Error('IndexedDB blocked')})
  try{
    const library=await state.harness.flush()
    assert.equal(library.loaded,true);assert.equal(library.error,'IndexedDB blocked');assert.equal(library.packs.length,6)
    assert.deepEqual(state.changes,[]);assert.equal(state.prefs.characterPackId,'custom-character');assert.equal(state.prefs.scenePackId,'custom-scene')
    library.chooseCharacter('builtin-silver-music')
    const chosen=await state.harness.flush()
    assert.equal(chosen.resources.character?.id,'builtin-silver-music');assert.equal(state.prefs.scenePackId,'custom-scene')
    assert.equal(state.changes.length,1,'loading a builtin must not erase the unenumerated saved scene')
  }finally{await state.dispose()}
})
test('failed refresh retains last known local packs and only confirmed absence clears selections',async()=>{
  const state=await setup({characterPackId:'custom-character',scenePackId:'custom-scene'},async()=>[local('custom-character','character'),local('custom-scene','scene')])
  try{
    await state.harness.flush()
    state.setList(async()=>{throw Error('IndexedDB temporarily unavailable')});state.refresh()
    const failed=await state.harness.flush()
    assert.equal(failed.packs.length,8);assert.equal(failed.error,'IndexedDB temporarily unavailable')
    assert.equal(failed.resources.character?.id,'custom-character');assert.equal(failed.resources.scene?.id,'custom-scene');assert.deepEqual(state.changes,[])
    state.setList(async()=>[]);state.refresh()
    const removed=await state.harness.flush()
    assert.equal(state.prefs.characterPackId,undefined);assert.equal(state.prefs.scenePackId,undefined)
    assert.match(removed.error,/已移除/);assert.equal(state.changes.length,1)
  }finally{await state.dispose()}
})
test('transient selected resource reads fall back without overwriting saved selections',async()=>{
  const state=await setup({characterPackId:'custom-character',scenePackId:'custom-scene'},async()=>[local('custom-character','character'),local('custom-scene','scene')])
  try{
    state.setLoadFailure('Image decoding unavailable')
    const failed=await state.harness.flush()
    assert.equal(failed.error,'Image decoding unavailable');assert.deepEqual(failed.resources,{})
    assert.equal(state.prefs.characterPackId,'custom-character');assert.equal(state.prefs.scenePackId,'custom-scene');assert.deepEqual(state.changes,[])
  }finally{await state.dispose()}
})

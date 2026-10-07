import {PACK_LIMITS,parsePackManifest,readLocalPack,type LocalPack} from './resource-pack'
import silverManifest from '../../assets/characters/silver-music/manifest.json'
import purpleManifest from '../../assets/characters/purple-star-cat/manifest.json'
import orangeManifest from '../../assets/characters/orange-flower/manifest.json'
import blueManifest from '../../assets/characters/blue-fan/manifest.json'
import blondeManifest from '../../assets/characters/blonde-goth/manifest.json'
import blackManifest from '../../assets/characters/black-beast/manifest.json'

// Separate IDs preserve users' imported versions and keep bundled updates selectable.
const definitions=[
  silverManifest,purpleManifest,orangeManifest,blueManifest,blondeManifest,blackManifest,
] as const
const rawIds=new Map<string,string>()
export const builtinPacks:LocalPack[]=definitions.map(raw=>{
  const manifest=parsePackManifest({...raw,id:`builtin-${raw.id}`})
  rawIds.set(manifest.id,raw.id)
  return {id:manifest.id,manifest,assets:{},importedAt:0}
})
export const isBuiltinPack=(id:string)=>rawIds.has(id)
export const withBuiltinPacks=(local:LocalPack[])=>[...builtinPacks,...local.filter(p=>!isBuiltinPack(p.id))]
export type BuiltinArchiveReader=(id:string)=>Promise<Blob>
/** Reject malformed or oversized RPC responses before allocating decoded ZIP bytes. */
export function builtinArchiveFromResponse(id:string,value:unknown):Blob{
  const fail=()=>{throw new Error('内置角色读取失败')}
  if(!isBuiltinPack(id)||!value||typeof value!=='object'||Array.isArray(value))return fail()
  const response=value as Record<string,unknown>,encoded=response.archive
  if(response.id!==id||typeof encoded!=='string'||!encoded.length||encoded.length>4*Math.ceil(PACK_LIMITS.archive/3)||encoded.length%4!==0)return fail()
  const padding=encoded.endsWith('==')?2:encoded.endsWith('=')?1:0
  if(encoded.length/4*3-padding>PACK_LIMITS.archive||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return fail()
  let binary:string
  try{binary=atob(encoded)}catch{return fail()}
  if(!binary.length||binary.length>PACK_LIMITS.archive)return fail()
  const bytes=new Uint8Array(binary.length)
  for(let at=0;at<binary.length;at++)bytes[at]=binary.charCodeAt(at)
  return new Blob([bytes],{type:'application/zip'})
}
const pending=new Map<string,Promise<LocalPack>>()
/** Unpack only the selected character, once per client, without IndexedDB writes. */
export function resolveLibraryPack(pack:LocalPack,readArchive:BuiltinArchiveReader):Promise<LocalPack>{
  const rawId=rawIds.get(pack.id)
  if(!rawId)return Promise.resolve(pack)
  let result=pending.get(pack.id)
  if(!result){
    result=(async()=>{
      const loaded=await readLocalPack(await readArchive(pack.id))
      if(loaded.manifest.id!==rawId)throw new Error('内置角色读取失败')
      return {...loaded,id:pack.id,manifest:pack.manifest}
    })().catch(error=>{pending.delete(pack.id);throw error})
    pending.set(pack.id,result)
  }
  return result
}

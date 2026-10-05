import {parsePackManifest,type LocalPack} from './resource-pack'

export const PACKS_CHANGED='dsh-toons-packs-changed'
const DB_NAME='dsh-toons-resources',STORE='packs'
function openDatabase():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('当前界面不支持本地资源存储'));return}
    const request=indexedDB.open(DB_NAME,1)
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'})
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(new Error('无法打开本地资源库'))
    request.onblocked=()=>reject(new Error('本地资源库正在更新，请关闭其他旧版界面后重试'))
  })
}
/** Resolve writes on transaction commit so failed imports never claim persistence. */
async function transaction<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode),request=action(tx.objectStore(STORE))
    tx.oncomplete=()=>{db.close();resolve(request.result)}
    tx.onabort=tx.onerror=()=>{db.close();reject(new Error(tx.error?.name==='QuotaExceededError'?'本地存储空间不足，请删除一些资源包后重试':'本地资源保存失败，请重试'))}
  })
}
export async function listLocalPacks():Promise<LocalPack[]>{
  const packs=await transaction<LocalPack[]>('readonly',store=>store.getAll())
  return packs.map(p=>({...p,manifest:parsePackManifest(p.manifest)})).sort((a,b)=>b.importedAt-a.importedAt)
}
export async function saveLocalPack(pack:LocalPack):Promise<void>{
  await transaction('readwrite',store=>store.put(pack));window.dispatchEvent(new Event(PACKS_CHANGED))
}
export async function deleteLocalPack(id:string):Promise<void>{
  await transaction('readwrite',store=>store.delete(id));window.dispatchEvent(new Event(PACKS_CHANGED))
}

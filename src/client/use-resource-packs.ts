import {useCallback,useEffect,useRef,useState} from 'react'
import {loadPackResources,readLocalPack,type LocalPack,type PackResources} from './resource-pack'
import {deleteLocalPack,listLocalPacks,PACKS_CHANGED,saveLocalPack} from './resource-store'
import type {Preferences} from './preferences'
import exampleUrl from '../../examples/mint-robot.toons.zip'
import {builtinPacks,isBuiltinPack,resolveLibraryPack,withBuiltinPacks,type BuiltinArchiveReader} from './builtin-packs'

export function useResourcePacks(prefs:Preferences,settings:(change:Partial<Preferences>)=>void,readArchive:BuiltinArchiveReader){
  const [packs,setPacks]=useState<LocalPack[]>(builtinPacks),[loaded,setLoaded]=useState(false),[resources,setResources]=useState<PackResources>({})
  const [enumerated,setEnumerated]=useState(false)
  const [busy,setBusy]=useState(false),[resolving,setResolving]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
  const settingsRef=useRef(settings);settingsRef.current=settings
  const alive=useRef(true),operation=useRef(false),refreshGeneration=useRef(0)
  const refresh=useCallback(async()=>{
    const generation=++refreshGeneration.current
    try{const list=await listLocalPacks();if(alive.current&&generation===refreshGeneration.current){setPacks(withBuiltinPacks(list));setEnumerated(true);setLoaded(true)}}
    catch(e){if(alive.current&&generation===refreshGeneration.current){setPacks(previous=>withBuiltinPacks(previous));setEnumerated(false);setLoaded(true);setError(e instanceof Error?e.message:'本地资源库不可用')}}
  },[])
  useEffect(()=>{alive.current=true;void refresh();window.addEventListener(PACKS_CHANGED,refresh);return()=>{alive.current=false;window.removeEventListener(PACKS_CHANGED,refresh)}},[refresh])
  useEffect(()=>{
    if(!loaded||busy)return
    let canceled=false
    setResolving(true)
    const character=packs.find(p=>p.id===prefs.characterPackId&&p.manifest.character),scene=packs.find(p=>p.id===prefs.scenePackId&&p.manifest.scene)
    const selected=[...new Set([character,scene].filter((p):p is LocalPack=>!!p))]
    void Promise.all(selected.map(async pack=>({id:pack.id,resources:await loadPackResources(await resolveLibraryPack(pack,readArchive))}))).then(results=>{
      if(canceled)return
      setResources({character:results.find(p=>p.id===character?.id)?.resources.character,scene:results.find(p=>p.id===scene?.id)?.resources.scene})
      // A failed IndexedDB read does not establish that a saved pack was removed.
      if(enumerated&&((prefs.characterPackId&&!character)||(prefs.scenePackId&&!scene))){
        settingsRef.current({characterPackId:character?.id,scenePackId:scene?.id});setError('之前选择的资源包已移除，已恢复对应的默认素材')
      }
    }).catch(e=>{
      if(canceled)return
      setError(e instanceof Error?e.message:'资源包加载失败');setResources({})
    }).finally(()=>{if(!canceled)setResolving(false)})
    return()=>{canceled=true}
  },[loaded,enumerated,packs,prefs.characterPackId,prefs.scenePackId,busy,readArchive])
  const apply=(pack:LocalPack)=>{
    setError('');setMessage(`已应用「${pack.manifest.name}」`)
    settingsRef.current({...(pack.manifest.character?{characterPackId:pack.id}:{}),...(pack.manifest.scene?{scenePackId:pack.id,source:'ready-made only' as const}:{})})
  }
  const importFile=async(file:Blob&{name?:string})=>{
    if(operation.current)return
    operation.current=true;setBusy(true);setError('');setMessage('')
    try{
      const pack=await readLocalPack(file)
      if(isBuiltinPack(pack.id))throw new Error('这个 ID 用于内置角色，请修改资源包 ID 后再导入')
      // Validate every image and frame before replacing an existing pack with the same ID.
      await loadPackResources(pack);await saveLocalPack(pack)
      if(alive.current){setPacks(previous=>[pack,...previous.filter(p=>p.id!==pack.id)]);setLoaded(true);apply(pack);setMessage(`已导入并应用「${pack.manifest.name}」`)}
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:'导入失败，请检查资源包')}
    finally{operation.current=false;if(alive.current)setBusy(false)}
  }
  const tryExample=async()=>{
    try{await importFile(await (await fetch(exampleUrl)).blob())}catch{setError('示例资源包读取失败')}
  }
  const remove=async(pack:LocalPack)=>{
    if(isBuiltinPack(pack.id))return
    if(operation.current)return
    operation.current=true;setBusy(true);setError('')
    try{
      await deleteLocalPack(pack.id)
      if(alive.current){
        settingsRef.current({...(prefs.characterPackId===pack.id?{characterPackId:undefined}:{}),...(prefs.scenePackId===pack.id?{scenePackId:undefined}:{})})
        setMessage(`已删除「${pack.manifest.name}」`);await refresh()
      }
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:'删除失败')}
    finally{operation.current=false;if(alive.current)setBusy(false)}
  }
  const chooseCharacter=(id:string)=>{setError('');setMessage('');settingsRef.current({characterPackId:id||undefined})}
  const chooseScene=(id:string)=>{setError('');setMessage('');settingsRef.current({scenePackId:id||undefined,...(id?{source:'ready-made only' as const}:{})})}
  const reset=()=>{setError('');setMessage('已恢复默认人物和预制场景');settingsRef.current({characterPackId:undefined,scenePackId:undefined,source:'ready-made only'})}
  return {packs,resources,busy:busy||resolving,error,message,loaded,apply,importFile,tryExample,remove,chooseCharacter,chooseScene,reset}
}

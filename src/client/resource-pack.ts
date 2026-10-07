import {strFromU8,unzipSync} from 'fflate'
import type {Action} from './animation'
import {assertPackFrameScanBudget,scanPackFrameBounds,type FrameInkBounds} from './pack-frame-bounds'

export const PACK_LIMITS={archive:20*1024*1024,expanded:32*1024*1024,image:8*1024*1024,manifest:128*1024,entries:32,pixels:16*1024*1024}
export const ACTIONS:readonly Action[]=['idle','think','read','type','search','check','success','failed','walk-left','walk-right']
export type PackFrame={atlas:string;x:number;y:number;w:number;h:number;anchorX:number;anchorY:number;durationMs:number}
export type PackClip={frames:PackFrame[];loop:boolean;stance:'standing'|'prone'}
export type PackCharacter={atlases:Record<string,string>;referenceHeight:number;actions:Partial<Record<Action,PackClip>>&{idle:PackClip}}
export type PackScene={background:string;foreground?:string;fit:'cover'|'contain'|'stretch';color:string;centerX:number;footY:number;scale:number}
export type PackManifest={format:'dsh-toons-pack';version:1;id:string;name:string;author?:string;description?:string;character?:PackCharacter;scene?:PackScene}
export type LocalPack={id:string;manifest:PackManifest;assets:Record<string,Blob>;importedAt:number}
export type LoadedCharacter={id:string;spec:PackCharacter;images:Record<string,HTMLImageElement>;bounds?:ReadonlyMap<PackFrame,FrameInkBounds>}
export type LoadedScene={id:string;spec:PackScene;background:HTMLImageElement;foreground?:HTMLImageElement}
export type PackResources={character?:LoadedCharacter;scene?:LoadedScene}

function record(value:unknown,label:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label} 必须是对象`)
  return value as Record<string,unknown>
}
function string(value:unknown,label:string,max=120):string{
  if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`${label} 不能为空，且最多 ${max} 个字符`)
  return value.trim()
}
function number(value:unknown,label:string,min:number,max:number,fallback?:number,integer=false):number{
  if(value===undefined&&fallback!==undefined)return fallback
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw new Error(`${label} 必须在 ${min} 到 ${max} 之间${integer?'，且为整数':''}`)
  return value
}
export function assetPath(value:unknown):string{
  const path=string(value,'图片路径',160)
  if(!/^[a-zA-Z0-9_./-]+\.(png|webp)$/i.test(path)||path.startsWith('/')||path.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('图片必须使用包内 PNG / WebP 相对路径')
  return path
}
/** Normalize only declared fields; resource packs never provide executable code. */
export function parsePackManifest(raw:unknown):PackManifest{
  const p=record(raw,'资源包配置')
  if(p.format!=='dsh-toons-pack'||p.version!==1)throw new Error('不支持的资源包格式，请使用 dsh-toons-pack 第 1 版')
  const id=string(p.id,'资源包 ID',64)
  if(!/^[a-z0-9][a-z0-9_-]*$/.test(id))throw new Error('资源包 ID 只能包含小写字母、数字、下划线和短横线')
  const manifest:PackManifest={format:'dsh-toons-pack',version:1,id,name:string(p.name,'资源包名称',80)}
  if(p.author!==undefined)manifest.author=string(p.author,'作者',80)
  if(p.description!==undefined)manifest.description=string(p.description,'介绍',400)
  if(p.character!==undefined){
    const c=record(p.character,'角色'),atlases=record(c.atlases,'角色图集'),actions=record(c.actions,'角色动作')
    if(Object.keys(atlases).length<1||Object.keys(atlases).length>8)throw new Error('角色需要 1 到 8 张图集')
    const images:Record<string,string>=Object.create(null),clips:Partial<Record<Action,PackClip>>={}
    for(const [key,path] of Object.entries(atlases)){
      if(!/^[a-z][a-z0-9_-]{0,31}$/.test(key))throw new Error('图集名称只能包含小写字母、数字、下划线和短横线')
      images[key]=assetPath(path)
    }
    for(const [action,value] of Object.entries(actions)){
      if(!ACTIONS.includes(action as Action))throw new Error(`不支持的动作：${action.slice(0,40)}`)
      const clip=record(value,`${action} 动作`)
      if(!Array.isArray(clip.frames)||clip.frames.length<1||clip.frames.length>32)throw new Error(`${action} 动作需要 1 到 32 帧`)
      if(clip.loop!==undefined&&typeof clip.loop!=='boolean')throw new Error(`${action}.loop 必须为布尔值`)
      if(clip.stance!==undefined&&clip.stance!=='standing'&&clip.stance!=='prone')throw new Error(`${action}.stance 必须为 standing 或 prone`)
      const frames=clip.frames.map((value,i)=>{
        const f=record(value,`${action} 第 ${i+1} 帧`),atlas=string(f.atlas,'帧图集名称',32)
        if(!Object.hasOwn(images,atlas))throw new Error(`找不到图集：${atlas}`)
        const w=number(f.w,'帧宽',1,4096,undefined,true),h=number(f.h,'帧高',1,4096,undefined,true)
        return {atlas,x:number(f.x,'帧 X',0,4096,undefined,true),y:number(f.y,'帧 Y',0,4096,undefined,true),w,h,
          anchorX:number(f.anchorX,'水平锚点',0,w,w/2),anchorY:number(f.anchorY,'落脚锚点',0,h,h),durationMs:number(f.durationMs,'帧时长',40,10000,240)}
      })
      clips[action as Action]={frames,loop:typeof clip.loop==='boolean'?clip.loop:action!=='success'&&action!=='failed',stance:clip.stance==='prone'?'prone':'standing'}
    }
    if(!clips.idle)throw new Error('角色包必须包含 idle 待机动作')
    manifest.character={atlases:images,referenceHeight:number(c.referenceHeight,'角色参考高度',1,4096),actions:clips as PackCharacter['actions']}
  }
  if(p.scene!==undefined){
    const s=record(p.scene,'场景')
    if(s.fit!==undefined&&!['cover','contain','stretch'].includes(s.fit as string))throw new Error('场景缩放方式必须为 cover、contain 或 stretch')
    const color=s.color===undefined?'#152536':string(s.color,'场景底色',7)
    if(!/^#[0-9a-f]{6}$/i.test(color))throw new Error('场景底色必须是六位十六进制颜色')
    manifest.scene={background:assetPath(s.background),foreground:s.foreground===undefined?undefined:assetPath(s.foreground),fit:(s.fit??'cover') as PackScene['fit'],color,
      centerX:number(s.centerX,'人物水平位置',.05,.95,.5),footY:number(s.footY,'人物落脚位置',.2,1,.94),scale:number(s.scale,'人物比例',.25,2,1)}
  }
  if(!manifest.character&&!manifest.scene)throw new Error('资源包至少需要包含角色或场景')
  return manifest
}
export function referencedAssets(manifest:PackManifest):string[]{
  return [...new Set([...Object.values(manifest.character?.atlases??{}),...(manifest.scene?[manifest.scene.background,...(manifest.scene.foreground?[manifest.scene.foreground]:[])]:[])])]
}
export function imageType(bytes:Uint8Array):'image/png'|'image/webp'{
  const dimensions=(w:number,h:number)=>{if(!w||!h||w>4096||h>4096||w*h>PACK_LIMITS.pixels)throw new Error('图片尺寸过大，最大 4096 × 4096')}
  if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),w=view.getUint32(16),h=view.getUint32(20)
    if(strFromU8(bytes.subarray(12,16))!=='IHDR')throw new Error('PNG 缺少有效的图片头')
    dimensions(w,h)
    return 'image/png'
  }
  if(bytes.length>=25&&strFromU8(bytes.subarray(0,4))==='RIFF'&&strFromU8(bytes.subarray(8,12))==='WEBP'){
    // Check VP8/VP8L/VP8X dimensions before the browser allocates decoded pixels.
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),kind=strFromU8(bytes.subarray(12,16))
    if(kind==='VP8X'&&bytes.length>=30){
      if(bytes[20]!&2)throw new Error('请使用静态 WebP 图集，动作由资源包配置控制')
      const u24=(at:number)=>bytes[at]!|bytes[at+1]!<<8|bytes[at+2]!<<16
      dimensions(u24(24)+1,u24(27)+1)
    }else if(kind==='VP8L'&&bytes[20]===0x2f){const bits=view.getUint32(21,true);dimensions((bits&0x3fff)+1,((bits>>>14)&0x3fff)+1)}
    else if(kind==='VP8 '&&bytes.length>=30&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a)dimensions(view.getUint16(26,true)&0x3fff,view.getUint16(28,true)&0x3fff)
    else throw new Error('WebP 缺少有效的图片头')
    return 'image/webp'
  }
  throw new Error('图片内容不是有效的 PNG / WebP')
}
/** Limit entry sizes before decompression, including files not referenced by the manifest. */
export function unpackArchive(bytes:Uint8Array):Record<string,Uint8Array>{
  if(bytes.byteLength>PACK_LIMITS.archive)throw new Error('资源包不能超过 20 MB')
  let total=0,count=0
  const names=new Set<string>()
  try{
    return unzipSync(bytes,{filter:file=>{
      if(++count>PACK_LIMITS.entries)throw new Error('资源包最多包含 32 个文件或目录')
      if(names.has(file.name))throw new Error('资源包包含重复文件名')
      names.add(file.name)
      if(file.name.endsWith('/')&&file.originalSize===0)return false
      if(file.name!=='manifest.json')assetPath(file.name)
      const limit=file.name==='manifest.json'?PACK_LIMITS.manifest:PACK_LIMITS.image
      total+=file.originalSize
      if(file.originalSize>limit||total>PACK_LIMITS.expanded)throw new Error('资源包解压后过大：每张图片最多 8 MB，总计最多 32 MB')
      return true
    }})
  }catch(e){throw new Error(e instanceof Error&&/[\u4e00-\u9fff]/.test(e.message)?e.message:'ZIP 文件损坏或格式不支持')}
}
export function packFromEntries(entries:Record<string,Uint8Array>):LocalPack{
  const config=entries['manifest.json']
  if(!config||config.byteLength>PACK_LIMITS.manifest)throw new Error('资源包根目录需要 manifest.json（最多 128 KB）')
  let raw:unknown
  try{raw=JSON.parse(strFromU8(config))}catch{throw new Error('manifest.json 不是有效的 JSON')}
  const manifest=parsePackManifest(raw),assets:Record<string,Blob>=Object.create(null)
  for(const path of referencedAssets(manifest)){
    const data=entries[path]
    if(!data)throw new Error(`资源包缺少图片：${path}`)
    if(data.byteLength>PACK_LIMITS.image)throw new Error(`图片 ${path} 超过 8 MB`)
    const type=imageType(data)
    if((path.toLowerCase().endsWith('.png')?'image/png':'image/webp')!==type)throw new Error(`图片扩展名与内容不一致：${path}`)
    assets[path]=new Blob([new Uint8Array(data)],{type})
  }
  return {id:manifest.id,manifest,assets,importedAt:Date.now()}
}
/** JSON imports are self contained, with an assets map of PNG / WebP data URLs. */
export function packFromJson(text:string):LocalPack{
  if(text.length>PACK_LIMITS.archive)throw new Error('资源包不能超过 20 MB')
  let raw:Record<string,unknown>
  try{raw=record(JSON.parse(text),'资源包')}catch{throw new Error('资源包不是有效的 JSON 对象')}
  const manifest=parsePackManifest(raw),embedded=record(raw.assets,'内嵌图片'),entries:Record<string,Uint8Array>=Object.create(null)
  const config=new TextEncoder().encode(JSON.stringify(manifest))
  if(config.length>PACK_LIMITS.manifest)throw new Error('资源包配置超过 128 KB')
  entries['manifest.json']=config
  let total=0
  for(const path of referencedAssets(manifest)){
    const data=embedded[path]
    if(typeof data!=='string'||!/^data:image\/(png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data))throw new Error(`图片 ${path} 需要 PNG / WebP base64 数据`)
    let decoded:string
    try{decoded=atob(data.slice(data.indexOf(',')+1))}catch{throw new Error(`图片 ${path} 的 base64 无效`)}
    total+=decoded.length
    if(decoded.length>PACK_LIMITS.image||total>PACK_LIMITS.expanded)throw new Error('内嵌图片过大')
    entries[path]=Uint8Array.from(decoded,c=>c.charCodeAt(0))
  }
  return packFromEntries(entries)
}
export async function readLocalPack(file:Blob&{name?:string}):Promise<LocalPack>{
  if(file.size>PACK_LIMITS.archive)throw new Error('资源包不能超过 20 MB')
  const bytes=new Uint8Array(await file.arrayBuffer())
  if(bytes[0]===80&&bytes[1]===75)return packFromEntries(unpackArchive(bytes))
  return packFromJson(new TextDecoder().decode(bytes))
}
export function resolvePackClip(character:PackCharacter,action:Action):{clip:PackClip;action:Action;mirror:boolean}{
  if(character.actions[action])return {clip:character.actions[action]!,action,mirror:false}
  const opposite=action==='walk-left'?'walk-right':action==='walk-right'?'walk-left':undefined
  if(opposite&&character.actions[opposite])return {clip:character.actions[opposite]!,action:opposite,mirror:true}
  return {clip:character.actions.idle,action:'idle',mirror:false}
}
export function packFrameAt(clip:PackClip,seconds:number):PackFrame{
  const total=clip.frames.reduce((sum,f)=>sum+f.durationMs,0)
  let time=Math.max(0,Number.isFinite(seconds)?seconds*1000:0)
  if(clip.loop)time%=total
  for(const frame of clip.frames){if(time<frame.durationMs)return frame;time-=frame.durationMs}
  return clip.frames[clip.frames.length-1]!
}
export function checkFrameBounds(character:PackCharacter,images:Record<string,{width:number;height:number}>):void{
  for(const [action,clip] of Object.entries(character.actions))for(const frame of clip!.frames){
    const image=images[frame.atlas]
    if(!image||frame.x+frame.w>image.width||frame.y+frame.h>image.height)throw new Error(`${action} 动作帧超出图片边界`)
  }
}
export async function loadPackResources(pack:LocalPack):Promise<PackResources>{
  if(pack.manifest.character)assertPackFrameScanBudget(pack.manifest.character)
  const images:Record<string,HTMLImageElement>=Object.create(null)
  await Promise.all(referencedAssets(pack.manifest).map(async path=>{
    const blob=pack.assets[path]
    if(!(blob instanceof Blob))throw new Error(`本地图片不可用：${path}`)
    const url=URL.createObjectURL(blob)
    try{
      const img=await new Promise<HTMLImageElement>((resolve,reject)=>{
        const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`图片无法解码：${path}`));image.src=url
      })
      if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth>4096||img.naturalHeight>4096||img.naturalWidth*img.naturalHeight>PACK_LIMITS.pixels)throw new Error('图片尺寸过大，最大 4096 × 4096')
      images[path]=img
    }finally{URL.revokeObjectURL(url)}
  }))
  const result:PackResources={}
  if(pack.manifest.character){
    const spec=pack.manifest.character,atlases:Record<string,HTMLImageElement>=Object.create(null)
    for(const [key,path] of Object.entries(spec.atlases))atlases[key]=images[path]!
    checkFrameBounds(spec,atlases)
    const pixels:Record<string,{pixels:Uint8ClampedArray;width:number;height:number}>=Object.create(null)
    const decoded=new Map<HTMLImageElement,{pixels:Uint8ClampedArray;width:number;height:number}>()
    for(const [key,image] of Object.entries(atlases)){
      const cached=decoded.get(image);if(cached){pixels[key]=cached;continue}
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight
      const context=canvas.getContext('2d');if(!context)throw new Error('无法读取角色图片')
      context.drawImage(image,0,0)
      pixels[key]={pixels:context.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height}
      decoded.set(image,pixels[key]!)
    }
    result.character={id:pack.id,spec,images:atlases,bounds:scanPackFrameBounds(spec,pixels)}
  }
  if(pack.manifest.scene){
    const spec=pack.manifest.scene,background=images[spec.background]!,foreground=spec.foreground?images[spec.foreground]:undefined
    if(foreground&&(foreground.width!==background.width||foreground.height!==background.height))throw new Error('场景前景和背景需要使用相同的图片尺寸')
    result.scene={id:pack.id,spec,background,foreground}
  }
  return result
}

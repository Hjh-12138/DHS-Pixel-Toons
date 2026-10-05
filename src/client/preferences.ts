import {isPixelTheme,type PixelTheme} from '../presets'

export type Preferences={compact:boolean;source:'ready-made only'|'mix';style:'pixel'|'all';theme?:PixelTheme;characterPackId?:string;scenePackId?:string}
export const DEFAULT_PREFERENCES:Preferences={compact:false,source:'ready-made only',style:'pixel'}
/** Merge legacy hide/collapse choices; ignore unknown or corrupt theme IDs. */
export function decodePreferences(raw:string|null):Preferences {
  try{
    const p=JSON.parse(raw||'{}') as Partial<Preferences>&{hidden?:boolean}
    const packId=(value:unknown)=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)?value:undefined
    const scenePackId=packId(p.scenePackId)
    return {compact:p.compact===true||p.hidden===true,source:scenePackId?'ready-made only':p.source==='mix'?'mix':'ready-made only',style:p.style==='all'?'all':'pixel',theme:isPixelTheme(p.theme)?p.theme:undefined,characterPackId:packId(p.characterPackId),scenePackId}
  }catch{return {...DEFAULT_PREFERENCES}}
}

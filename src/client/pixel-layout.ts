import type {Action} from './animation'

export type PixelLayout={centerX:number;footY:number;prone:boolean;heroWidth:number;left:number;right:number}
/** Furniture uses fixed pixel sizes, while the character bay stays centered. */
export function pixelLayout(width:number,height:number,action:Action):PixelLayout {
  const prone=action==='read'||action==='type',centerX=Math.round(width*.52)
  return {centerX,footY:height-(prone?20:8),prone,heroWidth:150,left:Math.max(16,Math.round(width*.18)-62),right:width-91}
}

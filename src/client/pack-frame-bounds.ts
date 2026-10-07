import type {PackCharacter,PackFrame} from './resource-pack'
export type FrameInkBounds={x:number;y:number;w:number;h:number}
type Pixels={pixels:Uint8ClampedArray;width:number;height:number}
/** Reject pathological overlapping layouts before decoding atlas bitmaps. */
export function assertPackFrameScanBudget(spec:PackCharacter,maxScanPixels=64*1024*1024):void{
 const unique=new Set<string>();let total=0
 for(const clip of Object.values(spec.actions))for(const frame of clip!.frames){
  const key=[spec.atlases[frame.atlas],frame.x,frame.y,frame.w,frame.h].join(':')
  if(unique.has(key))continue
  unique.add(key);total+=frame.w*frame.h
  if(total>maxScanPixels)throw new Error('角色帧扫描范围过大，请减少重叠帧或图集尺寸')
 }
}
/** Scan decoded atlases once per loaded pack, never during animation paint. */
export function scanPackFrameBounds(spec:PackCharacter,atlases:Record<string,Pixels>,maxScanPixels=64*1024*1024):Map<PackFrame,FrameInkBounds>{
 assertPackFrameScanBudget(spec,maxScanPixels)
 const result=new Map<PackFrame,FrameInkBounds>()
 const frames=Object.values(spec.actions).flatMap(clip=>clip!.frames)
 const imageIds=new Map<Uint8ClampedArray,number>(),keys=new Map<PackFrame,string>(),unique=new Set<string>()
 let scanned=0
 // Preflight the entire budget before examining even the first pixel.
 for(const frame of frames){
  const image=atlases[frame.atlas]!
  if(!imageIds.has(image.pixels))imageIds.set(image.pixels,imageIds.size)
  const key=[imageIds.get(image.pixels),image.width,frame.x,frame.y,frame.w,frame.h].join(':')
  keys.set(frame,key)
  if(unique.has(key))continue
  unique.add(key);scanned+=frame.w*frame.h
  if(scanned>maxScanPixels)throw new Error('角色帧扫描范围过大，请减少重叠帧或图集尺寸')
 }
 const cache=new Map<string,FrameInkBounds>()
 for(const frame of frames){
  const key=keys.get(frame)!,cached=cache.get(key)
  if(cached){result.set(frame,cached);continue}
  const image=atlases[frame.atlas]!
  let left=frame.w,top=frame.h,right=-1,bottom=-1
  for(let y=0;y<frame.h;y++)for(let x=0;x<frame.w;x++){
   if(image.pixels[((frame.y+y)*image.width+frame.x+x)*4+3]===0)continue
   left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)
  }
  const bounds=right<0?{x:0,y:0,w:0,h:0}:{x:left,y:top,w:right-left+1,h:bottom-top+1}
  cache.set(key,bounds);result.set(frame,bounds)
 }
 return result
}

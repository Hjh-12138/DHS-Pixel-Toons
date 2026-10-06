import type {RegisteredFrame} from '../../src/client/sprite'
import type {pngPixels} from './png'
export function thumbnail(png:ReturnType<typeof pngPixels>,frame:RegisteredFrame,scale:number,region={left:-65,right:65,top:-100,bottom:1}){
 const {pixels,width}=png,{crop,anchorX,anchorY,mirror}=frame,result=new Uint16Array((region.right-region.left)*(region.bottom-region.top))
 let index=0
 for(let y=region.top;y<region.bottom;y++)for(let x=region.left;x<region.right;x++){
  const sx=Math.round(crop.x+anchorX+(mirror?-x:x)/scale),sy=Math.round(crop.y+anchorY+y/scale)
  if(sx>=crop.x&&sx<crop.x+crop.w&&sy>=crop.y&&sy<crop.y+crop.h){const at=(sy*width+sx)*4;if(pixels[at+3]!>80)result[index]=1+((pixels[at]!>>5)<<6)+((pixels[at+1]!>>5)<<3)+(pixels[at+2]!>>5)}
  index++
 }
 return result
}
/** Ignore transparency and tiny color noise when comparing actual display pixels. */
export function difference(a:Uint16Array,b:Uint16Array){
 let changed=0,union=0
 for(let i=0;i<a.length;i++)if(a[i]||b[i]){union++;if(a[i]!==b[i])changed++}
 return union?changed/union:0
}
/** Side-view walking must change geometry; swapping limb colors does not count. */
export function silhouetteDifference(a:Uint16Array,b:Uint16Array){
 let changed=0,union=0
 for(let i=0;i<a.length;i++){const first=Boolean(a[i]),second=Boolean(b[i]);if(first||second){union++;if(first!==second)changed++}}
 return union?changed/union:0
}

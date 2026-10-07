import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pngPixels} from './helpers/png'
import {animationBoundsFromPixels} from '../src/client/sprite'
import {thumbnail} from './helpers/sprite-pixels'

const {pixels,width,height}=pngPixels(new URL('../assets/animations/walk.png',import.meta.url))
const body=pngPixels(new URL('../design/whale-walk-body.png',import.meta.url)).pixels
const bob=[0,1,0,-1,0,1,0,-1]
const pixel=(frame:number,x:number,y:number)=>((Math.floor(frame/4)*512+y)*width+frame%4*512+x)*4

test('whale walking keeps both eyes visible in every near-front phase',()=>{
 assert.equal(width,2048);assert.equal(height,1024)
 for(let f=0;f<8;f++){
  const eyes=[0,0]
  for(let y=199;y<237;y++)for(let x=174;x<284;x++){
   const at=pixel(f,x,y+bob[f]!),r=pixels[at]!,g=pixels[at+1]!,b=pixels[at+2]!
   if(pixels[at+3]!>80&&b>140&&g>90&&b>r+60)eyes[x<225?0:1]!++
  }
  assert.ok(eyes.every(n=>n>20),`frame ${f+1} must retain both blue eyes`)
 }
})

test('the highlighted left stocking travels forward, behind, and forward again',()=>{
 const positions=Array.from({length:8},(_,f)=>{
  let sum=0,count=0
  // Inspect the exposed calf, excluding the fixed white hem and the newly
  // rounded shoes' pale toe highlights below it.
  for(let y=421;y<428;y++)for(let x=180;x<305;x++){
   const at=pixel(f,x,y),r=pixels[at]!,g=pixels[at+1]!,b=pixels[at+2]!
   if(pixels[at+3]!>80&&r>220&&g>210&&b>200){sum+=x;count++}
  }
  assert.ok(count>10,`left stocking must be readable in frame ${f+1}`)
  return sum/count
 })
 assert.ok(positions[4]!-positions[0]!>30,'the light left leg must move from front to rear')
 assert.ok(positions[7]!<positions[4]!-25,'the light left leg must extend forward before contact')
 let raisedHighlight=0
 for(let y=415;y<440;y++)for(let x=260;x<305;x++){
  const at=pixel(5,x,y)
  if(pixels[at+3]!>80&&pixels[at]!>220&&pixels[at+1]!>210&&pixels[at+2]!>200)raisedHighlight++
 }
 assert.ok(raisedHighlight>80,'the recovering rear left stocking must stay highlighted')
 assert.ok(positions[6]!<positions[4]!-25,'the left highlight must pass forward on the raised leg')
})

test('walking calves and planted shoes retain the standing chibi proportions',()=>{
 const idle=pngPixels(new URL('../assets/animations/idle.png',import.meta.url))
 const standing=animationBoundsFromPixels(idle.pixels,idle.width,idle.height,[0,1])
 const walking=animationBoundsFromPixels(pixels,width,height,[0,1])
 const bootWidth=(p:ReturnType<typeof pngPixels>,crop:{x:number;y:number;w:number;h:number},band=10)=>{
  let widest=0
  // The raised shoe overlaps the supporting shoe higher up during passing.
  // Only the lower sole band measures one planted shoe rather than both feet.
  for(let y=crop.y+crop.h-band;y<crop.y+crop.h;y++){
   let start=-1
   for(let x=crop.x;x<=crop.x+crop.w;x++){
    const ink=x<crop.x+crop.w&&p.pixels[(y*p.width+x)*4+3]!>128
    if(ink&&start<0)start=x
    if(!ink&&start>=0){widest=Math.max(widest,x-start);start=-1}
   }
  }
  return widest
 }
 // Use the full rounded standing toe; its very bottom narrows substantially.
 const standingWidth=bootWidth(idle,standing.frames[0]!.crop,21)*80/standing.referenceHeight
 for(const frame of walking.frames){
  const walkWidth=bootWidth({pixels,width,height},frame.crop)*80/walking.referenceHeight
  assert.ok(walkWidth<=standingWidth*1.15,'walking must not enlarge a supporting shoe')
 }
 const lowerLegHeight=(walking.frames[0]!.crop.y+walking.frames[0]!.crop.h-415)*80/walking.referenceHeight
 assert.ok(lowerLegHeight<=11,'walking must not lengthen the visible calves')
})

test('the forward walking shoe retains the standing toe volume at actual display scale',()=>{
 const idle=pngPixels(new URL('../assets/animations/idle.png',import.meta.url))
 const standing=animationBoundsFromPixels(idle.pixels,idle.width,idle.height,[0,1])
 const walking=animationBoundsFromPixels(pixels,width,height,[0,1])
 const region={left:-14,right:-2,top:-6,bottom:0}
 const ink=(p:ReturnType<typeof pngPixels>,sheet:typeof walking)=>[...thumbnail(p,sheet.frames[0]!,80/sheet.referenceHeight,region)].filter(Boolean).length
 const ratio=ink({pixels,width,height},walking)/ink(idle,standing)
 assert.ok(ratio>=.9,`walking toe looks too small: ${ratio}`)
 assert.ok(ratio<=1.15,`walking toe looks too large: ${ratio}`)
})

test('hair, dress, hands and whale tail share one coherent body movement',()=>{
 // Check the complete visible body after removing the intentional one-pixel
 // bob, including the low curls and tail that formerly moved with the legs.
 for(let f=1;f<8;f++){
  let checked=0
  for(let y=1;y<480;y++)for(let x=0;x<512;x++){
   if(y>=415&&x<340)continue // Articulating legs and their root/tail overlap.
   const first=(y*512+x)*4,next=pixel(f,x,y+bob[f]!)
   if(!body[first+3])continue // Transparent space can reveal a passing leg.
   for(let channel=0;channel<4;channel++)assert.equal(pixels[next+channel],body[first+channel],`body drifts in frame ${f+1} at ${x},${y}`)
   checked++
  }
  assert.ok(checked>60000,'the comparison must include the whole body, not only the face')
 }
})

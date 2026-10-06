import {test} from 'node:test'
import assert from 'node:assert/strict'
import {animationBoundsFromPixels,mirrorSheet,type AnimationSheet} from '../src/client/sprite'
import {pngPixels} from './helpers/png'
import {thumbnail,silhouetteDifference} from './helpers/sprite-pixels'

for(const direction of ['left','right'] as const){
 const png=pngPixels(new URL('../assets/animations/walk.png',import.meta.url)),{pixels,width}=png
 const original={image:{} as HTMLImageElement,...animationBoundsFromPixels(pixels,png.width,png.height,[0,1])} as AnimationSheet
 const sheet=direction==='right'?mirrorSheet(original):original,displayScale=80/sheet.referenceHeight,frames=sheet.frames
 test(`all eight ${direction} frames keep the correct 2D facing`,()=>{
  for(const frame of frames){
   const {crop,anchorX}=frame;let sum=0,count=0
   for(let y=Math.ceil(crop.y+crop.h*.3);y<crop.y+crop.h*.55;y++)for(let x=crop.x;x<crop.x+crop.w;x++){
    const at=(y*width+x)*4,r=pixels[at]!,g=pixels[at+1]!,b=pixels[at+2]!
    if(pixels[at+3]!>80&&r>220&&g>175&&b>150&&r>g+10&&g>b+10){sum+=(x-crop.x-anchorX)*(frame.mirror?-1:1);count++}
   }
   assert.ok(count>0,'the face must be visible')
   assert.ok(direction==='left'?sum/count<0:sum/count>0,'a frame must not turn to the opposite direction')
  }
 })
 test(`shipped ${direction} walk has eight different 2D leg silhouettes and a planted foot at80px`,()=>{
  // In side projection the two legs are indistinguishable: ignore every RGB
  // value and require genuinely different knee/heel/foot outlines instead.
  // Keep the trailing whale tail out of the comparison; only feet/lower legs count.
  const region=direction==='left'?{left:-40,right:25,top:-14,bottom:0}:{left:-25,right:40,top:-14,bottom:0}
  const legs=frames.map(frame=>thumbnail(png,frame,displayScale,region))
  assert.equal(legs.length,8)
  for(let a=0;a<8;a++)for(let b=a+1;b<8;b++)assert.ok(silhouetteDifference(legs[a]!,legs[b]!)>=.2,`${direction} frames ${a+1}/${b+1} repeat a 2D leg outline (${Math.round(silhouetteDifference(legs[a]!,legs[b]!)*100)}% silhouette change)`)
  for(const leg of legs)assert.ok([...leg.slice(-195)].filter(Boolean).length>=4,'a planted shoe must be visible at ground level')
 })
 test(`shipped ${direction} walk swings its hands rather than keeping them fixed`,()=>{
  const positions=frames.map(({crop,anchorX})=>{
   let left=Infinity,right=-Infinity
   for(let y=Math.ceil(crop.y+crop.h*.57);y<crop.y+crop.h*.87;y++)for(let x=crop.x;x<crop.x+crop.w;x++){
    const at=(y*width+x)*4,r=pixels[at]!,g=pixels[at+1]!,b=pixels[at+2]!
    if(pixels[at+3]!>80&&r>220&&g>175&&b>150&&r>g+10&&g>b+10){left=Math.min(left,x-crop.x-anchorX);right=Math.max(right,x-crop.x-anchorX)}
   }
   assert.ok(Number.isFinite(left),'each frame must show a hand below the face')
   return (right-left)*displayScale
  })
  assert.ok(Math.max(...positions)-Math.min(...positions)>=8,`${direction} hands remain fixed`)
 })
}

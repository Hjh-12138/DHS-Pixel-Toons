import {test} from 'node:test'
import assert from 'node:assert/strict'
import {CLIPS,type Action} from '../src/client/animation'
import {animationBoundsFromPixels} from '../src/client/sprite'
import {pngPixels} from './helpers/png'
import {thumbnail,difference} from './helpers/sprite-pixels'
for(const action of Object.keys(CLIPS) as Action[]){
 const png=pngPixels(new URL(`../assets/animations/${action.startsWith('walk-')?'walk':action}.png`,import.meta.url)),{pixels,width,height}=png
 const sheet=animationBoundsFromPixels(pixels,width,height,[0,1]),scale=80/sheet.referenceHeight
 test(`shipped ${action} has eight distinct display frames rather than a repeated four-frame cycle`,()=>{
  assert.equal(sheet.frames.length,8)
  // Small walking feet occupy little of the whole chibi. Compare their actual
  // movement region so a large fixed head cannot hide a repeated leg phase.
  const region=action.startsWith('walk-')?{left:-40,right:25,top:-10,bottom:1}:undefined
  const images=sheet.frames.map(frame=>thumbnail(png,frame,scale,region))
  for(let a=0;a<8;a++)for(let b=a+1;b<8;b++)assert.ok(difference(images[a]!,images[b]!)>=.025,`${action} frames ${a+1}/${b+1} are duplicates`)
  const heights=sheet.frames.map(frame=>frame.crop.h)
  // Celebration includes an intentional knee bend; the other actions retain their stance.
  assert.ok(Math.max(...heights)/Math.min(...heights)<(action==='success'?1.3:1.15),`${action} changes body size or loses part of a sprite`)
  assert.ok(pixels.some((value,i)=>i%4===3&&value===0),'real transparent alpha is required')
  for(let x=0;x<width;x++){assert.ok(pixels[x*4+3]!<=80,'top edge cuts a sprite');assert.ok(pixels[((height-1)*width+x)*4+3]!<=80,'bottom edge cuts a shoe')}
  for(let y=0;y<height;y++){assert.ok(pixels[(y*width)*4+3]!<=80,'left edge cuts a sprite');assert.ok(pixels[(y*width+width-1)*4+3]!<=80,'right edge cuts a tail')}
  for(const frame of sheet.frames)assert.equal(frame.anchorY,frame.crop.h,'actual contact points must stay grounded')
 })
}

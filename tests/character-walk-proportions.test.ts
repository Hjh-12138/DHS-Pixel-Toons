import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {pngPixels} from './helpers/png'
const ids=['silver-music','purple-star-cat','orange-flower','blue-fan','blonde-goth','black-beast']
const bob=[0,1,0,-1,0,1,0,-1]
// Independently reviewed original limb regions. In particular the brown
// stockings and their gold knee ornaments are part of blonde-goth's legs,
// not a fixed front skirt panel. All actual skirt/frill pixels outside these
// regions must still match core.png in every phase.
const exposedFeet:Record<string,number[][]>={
 'silver-music':[[124,206,144,222],[144,206,159,222]],
 'purple-star-cat':[[117,191,133,202],[137,191,151,202],[114,202,134,211],[135,202,151,211],[111,211,133,222],[133,211,152,222]],
 'orange-flower':[[118,207,141,222],[141,207,159,222]],
 'blue-fan':[[119,206,130,212],[117,212,135,222],[133,206,145,212],[135,212,150,222]],
 'blonde-goth':[[112,185,129,208],[110,208,129,222],[129,185,145,208],[129,208,145,222]],
 'black-beast':[[114,211,128,222],[133,211,146,222]],
}
const shaftSamples:Record<string,[number,number]>={
 'silver-music':[133,207],'purple-star-cat':[124,194],
 'orange-flower':[126,211],'blue-fan':[126,209],
 'blonde-goth':[119,199],'black-beast':[121,213],
}
const shoes:Record<string,number[][]>={
 'silver-music':[[124,144,215],[144,159,215]],
 'purple-star-cat':[[111,133,211],[133,152,211]],
 'orange-flower':[[118,141,215],[141,159,215]],
 'blue-fan':[[117,135,215],[135,150,215]],
 'blonde-goth':[[110,126,212],[129,145,212]],
 'black-beast':[[114,128,217],[133,146,217]],
}
for(const id of ids)test(`${id} moves the original leg shaft together with its original shoe`,()=>{
 const manifest=JSON.parse(readFileSync(new URL(`../assets/characters/${id}/manifest.json`,import.meta.url),'utf8'))
 const rect=manifest.character.actions.idle.frames[0]
 const idle=pngPixels(new URL(`../assets/characters/${id}/core.png`,import.meta.url))
 const body=pngPixels(new URL(`../design/character-walk-bodies/${id}.png`,import.meta.url))
 const walk=pngPixels(new URL(`../assets/characters/${id}/walk-left.png`,import.meta.url))
 const [x,y]=shaftSamples[id]!,b=(y*2*body.width+x*2)*4
 assert.equal(body.pixels[b+3],0,'a real leg shaft is frozen into the clothing foreground')
 const colours=new Set<string>()
 for(let sy=0;sy<256;sy++)for(let sx=0;sx<256;sx++){
  const at=((rect.y+sy)*idle.width+rect.x+sx)*4
  if(idle.pixels[at+3]!>=128)colours.add(Array.from(idle.pixels.subarray(at,at+3)).join(','))
 }
 for(let f=0;f<8;f++)for(let sy=180;sy<224;sy++)for(let sx=90;sx<175;sx++){
  const at=((Math.floor(f/4)*256+sy)*walk.width+f%4*256+sx)*4
  if(walk.pixels[at+3]!<128)continue
  assert.ok(colours.has(Array.from(walk.pixels.subarray(at,at+3)).join(',')),`frame ${f+1}: a separately redrawn leg/shoe changes the original pixel style`)
 }
})
for(const id of ids)test(`${id} preserves the original skirt in every walking frame`,()=>{
 const manifest=JSON.parse(readFileSync(new URL(`../assets/characters/${id}/manifest.json`,import.meta.url),'utf8'))
 const rect=manifest.character.actions.idle.frames[0]
 const idle=pngPixels(new URL(`../assets/characters/${id}/core.png`,import.meta.url))
 const walk=pngPixels(new URL(`../assets/characters/${id}/walk-left.png`,import.meta.url))
 for(let f=0;f<8;f++){
  let checked=0
  for(let y=170;y<245;y++)for(let x=0;x<256;x++){
   const sy=Math.floor((2*y-bob[f]!)/2)
   if(sy<170)continue
   if(exposedFeet[id]!.some(([x0,y0,x1,y1])=>x>=x0!&&x<x1!&&sy>=y0!&&sy<y1!))continue
   const i=((rect.y+sy)*idle.width+rect.x+x)*4
   if(idle.pixels[i+3]!<128)continue
   const w=((Math.floor(f/4)*256+y)*walk.width+f%4*256+x)*4
   for(let c=0;c<4;c++)assert.equal(walk.pixels[w+c],idle.pixels[i+c],`original skirt damaged at ${x},${sy}, frame ${f+1}`)
   checked++
  }
  assert.ok(checked>1500,'compare the complete skirt, including its front and hem')
 }
})
for(const id of ids)test(`${id} walking matches its standing body and footwear proportions`,()=>{
 const manifest=JSON.parse(readFileSync(new URL(`../assets/characters/${id}/manifest.json`,import.meta.url),'utf8'))
 const idleFrame=manifest.character.actions.idle.frames[0]
 const idle=pngPixels(new URL(`../assets/characters/${id}/core.png`,import.meta.url))
 const body=pngPixels(new URL(`../design/character-walk-bodies/${id}.png`,import.meta.url))
 const walk=pngPixels(new URL(`../assets/characters/${id}/walk-left.png`,import.meta.url))
 const at=(f:number,x:number,y:number)=>((Math.floor(f/4)*256+y)*walk.width+f%4*256+x)*4
 // Whole-body registration preserves the head AND all low costume details,
 // after compensating for the shared one-source-pixel breathing motion.
 for(let f=0;f<8;f++){
  let checked=0
  for(let y=1;y<250;y++)for(let x=0;x<256;x++){
   const by=y*2-bob[f]!,b=(by*512+x*2)*4,w=at(f,x,y)
   if(by<0||by>=512||body.pixels[b+3]===0)continue
   for(let c=0;c<4;c++)assert.equal(walk.pixels[w+c],body.pixels[b+c],`body fragment drifts in frame ${f+1}`)
   checked++
  }
  assert.ok(checked>10000,'the comparison includes the full body')
 }
 for(let y=80;y<170;y++)for(let x=50;x<210;x++){
  const i=((idleFrame.y+y)*idle.width+idleFrame.x+x)*4,w=at(0,x,y)
  if(idle.pixels[i+3]!<200)continue
  for(let c=0;c<4;c++)assert.equal(walk.pixels[w+c],idle.pixels[i+c],'walking changes the standing head or torso scale')
 }
 // Compare each whole shoe BEFORE foreground skirt occlusion. Counting
 // opaque pixels in the final image also counts a touching skirt hem and
 // falsely reports a larger shoe (especially blue-fan and blonde-goth).
 const legs=pngPixels(new URL(`../design/character-walk-legs/${id}.png`,import.meta.url))
 for(const [side,shoe]of shoes[id]!.entries()){
  const [left,right,ankle]=shoe,dx=side===0?-4:4,dy=side===0?0:-1
  const width=(native:boolean)=>{
   let max=0
   for(let y=ankle!;y<=221;y++){
    let start=-1
    for(let x=left!;x<=right!;x++){
     const p=native?legs:idle
     const at=native?((y+dy)*2*legs.width+(x+dx)*2)*4:((idleFrame.y+y)*idle.width+idleFrame.x+x)*4
     const ink=x<right!&&p.pixels[at+3]!>=128
     if(ink&&start<0)start=x
     if(!ink&&start>=0){max=Math.max(max,x-start);start=-1}
    }
   }return max
  }
  assert.equal(width(true),width(false),`shoe ${side+1} is scaled independently of its leg`)
 }
})

import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {paint} from '../src/client/sprite'
import {parsePackManifest} from '../src/client/resource-pack'
import {scanPackFrameBounds} from '../src/client/pack-frame-bounds'
import {pngPixels} from './helpers/png'
import type {MascotDraw} from '../src/engine/script'
const ids=['silver-music','purple-star-cat','orange-flower','blue-fan','blonde-goth','black-beast']
for(const id of ids)test(`${id} ignores transparent cell gutters when fitting and grounding the visible body`,()=>{
 const spec=parsePackManifest(JSON.parse(readFileSync(new URL(`../assets/characters/${id}/manifest.json`,import.meta.url),'utf8'))).character!
 const bounds=scanPackFrameBounds(spec,Object.fromEntries(Object.entries(spec.atlases).map(([key,file])=>[key,pngPixels(new URL(`../assets/characters/${id}/${file}`,import.meta.url))])))
 const mascot={x:38,py:4,look:{pose:'stand',scale:1,facing:0,stride:-1,arms:{left:'down',right:'down'}}} as MascotDraw
 for(const width of [288,720,1920]){
  const draws:number[][]=[],translations:number[][]=[]
  const g={canvas:{width,height:112,dataset:{}},clearRect(){},fillRect(){},fillText(){},save(){},restore(){},scale(){},translate(...args:number[]){translations.push(args)},drawImage(_image:unknown,...args:number[]){draws.push(args)}} as unknown as CanvasRenderingContext2D
  const images=Object.fromEntries(Object.keys(spec.atlases).map(key=>[key,{} as HTMLImageElement]))
  for(const facing of [-1,1] as const){
   draws.length=0;translations.length=0
   const seconds=.3
   paint(g,{cells:new Uint32Array(0),cols:width/8,rows:8,t:0,mascots:[mascot]},{} as HTMLImageElement,[],'thinking','none',undefined,{time:0,outcomeAge:0,playing:true},{character:{id,spec,images,bounds},scene:{id:'stage',spec:{background:'stage.png',fit:'stretch',color:'#fff',centerX:.5,footY:104/112,scale:1},background:{} as HTMLImageElement}},{x:.5,walking:true,facing,seconds})
   const actual=draws.at(-1)!,unit=actual[7]!/256
   const y=translations.length?translations.at(-1)![1]!:actual[5]!
   assert.ok(Math.abs(y+222*unit-104)<1,'registered shoes must land on the authored floor')
   assert.ok(Math.abs(160*unit-112*.72)<1,'transparent padding must not shrink the standing-body scale')
  }
 }
})

test('a tall opaque custom pose remains completely visible instead of being mistaken for transparent padding',()=>{
 const frame={atlas:'main',x:0,y:0,w:64,h:160,anchorX:32,anchorY:160,durationMs:100}
 const spec={atlases:{main:'main.png'},referenceHeight:80,actions:{idle:{frames:[frame],loop:true,stance:'standing' as const}}}
 const pixels=new Uint8ClampedArray(64*160*4).fill(255),bounds=scanPackFrameBounds(spec,{main:{pixels,width:64,height:160}})
 const draws:number[][]=[]
 const g={canvas:{width:720,height:112,dataset:{}},clearRect(){},fillRect(){},fillText(){},drawImage(_image:unknown,...args:number[]){draws.push(args)}} as unknown as CanvasRenderingContext2D
 const mascot={x:38,py:4,look:{pose:'stand',scale:1,facing:0,stride:-1}} as MascotDraw
 paint(g,{cells:new Uint32Array(0),cols:90,rows:8,t:0,mascots:[mascot]},{} as HTMLImageElement,[],'thinking','none',undefined,{time:0,outcomeAge:0,playing:true},{character:{id:'tall-custom',spec,images:{main:{} as HTMLImageElement},bounds}})
 const actual=draws.at(-1)!
 assert.ok(Math.abs(actual[5]!)<1);assert.equal(actual[7],112,'visible tall artwork should fit the complete stage')
})

test('transparent empty poses do not shrink the visible frames in the same clip',()=>{
 const first={atlas:'main',x:0,y:0,w:64,h:80,anchorX:32,anchorY:80,durationMs:100}
 const empty={...first,x:64,h:160,anchorY:160}
 const spec={atlases:{main:'main.png'},referenceHeight:80,actions:{idle:{frames:[first,empty],loop:true,stance:'standing' as const}}}
 const pixels=new Uint8ClampedArray(128*160*4)
 for(let y=0;y<80;y++)for(let x=0;x<64;x++)pixels[(y*128+x)*4+3]=255
 const bounds=scanPackFrameBounds(spec,{main:{pixels,width:128,height:160}})
 assert.deepEqual(bounds.get(empty),{x:0,y:0,w:0,h:0})
 const draws:number[][]=[]
 const g={canvas:{width:720,height:112,dataset:{}},clearRect(){},fillRect(){},fillText(){},drawImage(_image:unknown,...args:number[]){draws.push(args)}} as unknown as CanvasRenderingContext2D
 const mascot={x:38,py:4,look:{pose:'stand',scale:1,facing:0,stride:-1}} as MascotDraw
 paint(g,{cells:new Uint32Array(0),cols:90,rows:8,t:0,mascots:[mascot]},{} as HTMLImageElement,[],'thinking','none',undefined,{time:0,outcomeAge:0,playing:true},{character:{id:'fade-custom',spec,images:{main:{} as HTMLImageElement},bounds}})
 assert.equal(draws.at(-1)![7],81,'visible frame keeps the standing-body scale despite a larger empty cell')
})

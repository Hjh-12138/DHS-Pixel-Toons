import {test} from 'node:test'
import assert from 'node:assert/strict'
import {paintCelebration,paint} from '../src/client/sprite'
import {animationFixture} from './helpers/animation-fixture'
import type {MascotDraw} from '../src/engine/script'
test('celebration frames seven and eight develop different fireworks within the stage',()=>{
 const renders:number[][][]=[]
 for(const frame of [6,7] as const){
  const pixels:number[][]=[]
  const g={canvas:{width:240,height:112},fillRect(...args:number[]){pixels.push(args)}} as unknown as CanvasRenderingContext2D
  paintCelebration(g,120,18,80,frame);renders.push(pixels)
  assert.ok(pixels.length>0)
  assert.ok(pixels.every(([x,y,w,h])=>x!>=0&&y!>=0&&x!+w!<=240&&y!+h!<=112))
 }
 assert.notDeepEqual(renders[0],renders[1]);assert.ok(renders[1]!.length>renders[0]!.length)
})
test('completion reveals fireworks only in its final two frames and clears them on idle',()=>{
 const canvas={width:720,height:196,dataset:{} as Record<string,string>}
 const g={canvas,clearRect(){},fillRect(){},fillText(){},drawImage(){}} as unknown as CanvasRenderingContext2D
 const frames=Array.from({length:8},(_,i)=>({crop:{x:i*100,y:0,w:80,h:100},anchorX:40,anchorY:100}))
 const sheet={image:{} as HTMLImageElement,frames,referenceHeight:100},sprites=animationFixture(sheet)
 const mascot={x:10,py:4,look:{pose:'stand',stride:-1,facing:0,scale:1,arms:{left:'down',right:'down'}}} as MascotDraw
 const cells=new Uint32Array(90*14*3);for(let i=0;i<90*14;i++){cells[i*3+1]=0x01000000;cells[i*3+2]=0x01000000}
 const frame={cells,cols:90,rows:14,t:0,mascots:[mascot]}
 for(const [time,expected] of [[.5,undefined],[.75,'ignition'],[1.1,'bloom']] as const){paint(g,frame,sheet.image,[],'editing','success',sprites,{time,outcomeAge:time,playing:true,working:false});assert.equal(canvas.dataset.celebration,expected)}
 paint(g,frame,sheet.image,[],'editing','success',sprites,{time:2,outcomeAge:2,playing:true,working:false});assert.equal(canvas.dataset.action,'idle');assert.equal(canvas.dataset.celebration,undefined)
})
test('a mirrored final pose preserves the same character root before drawing the bloom',()=>{
 const scales:number[][]=[],translations:number[][]=[]
 const canvas={width:720,height:196,dataset:{} as Record<string,string>}
 const g={canvas,clearRect(){},fillRect(){},fillText(){},drawImage(){},save(){},restore(){},scale(...args:number[]){scales.push(args)},translate(...args:number[]){translations.push(args)}} as unknown as CanvasRenderingContext2D
 const frames=Array.from({length:8},(_,i)=>({crop:{x:i*100,y:0,w:80,h:100},anchorX:30,anchorY:100,mirror:i===7}))
 const sheet={image:{} as HTMLImageElement,frames,referenceHeight:100},sprites=animationFixture(sheet)
 const mascot={x:10,py:4,look:{pose:'stand',stride:-1,facing:0,scale:1,arms:{left:'down',right:'down'}}} as MascotDraw
 const cells=new Uint32Array(90*14*3);for(let i=0;i<90*14;i++){cells[i*3+1]=0x01000000;cells[i*3+2]=0x01000000}
 paint(g,{cells,cols:90,rows:14,t:0,mascots:[mascot]},sheet.image,[],'editing','success',sprites,{time:1.1,outcomeAge:1.1,playing:true,working:false})
 assert.deepEqual(scales,[[-1,1]]);assert.equal(translations.length,1);assert.equal(canvas.dataset.celebration,'bloom')
})

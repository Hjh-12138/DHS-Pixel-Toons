import {test} from 'node:test'
import assert from 'node:assert/strict'
import {assertPackFrameScanBudget,scanPackFrameBounds} from '../src/client/pack-frame-bounds'
import type {PackCharacter,PackFrame} from '../src/client/resource-pack'
const frame:PackFrame={atlas:'main',x:0,y:0,w:4,h:4,anchorX:2,anchorY:4,durationMs:100}
const spec=(frames:PackFrame[]):PackCharacter=>({atlases:{main:'main.png'},referenceHeight:4,actions:{idle:{frames,loop:true,stance:'standing'}}})
test('faint but nonzero alpha contributes to visible bounds',()=>{
 const pixels=new Uint8ClampedArray(4*4*4)
 pixels[3]=1;pixels[((3*4)+3)*4+3]=64
 const bounds=scanPackFrameBounds(spec([frame]),{main:{pixels,width:4,height:4}})
 assert.deepEqual(bounds.get(frame),{x:0,y:0,w:4,h:4})
})
test('repeated frame rectangles share one scan and one bounds object',()=>{
 const frames=Array.from({length:320},()=>({...frame})),pixels=new Uint8ClampedArray(4*4*4).fill(255)
 const bounds=scanPackFrameBounds(spec(frames),{main:{pixels,width:4,height:4}},16)
 assert.equal(bounds.size,320);assert.equal(bounds.get(frames[0]!),bounds.get(frames[319]!))
})
test('excessive unique scan work is rejected before pixel iteration',()=>{
 const frames=[frame,{...frame,x:4}],pixels=new Uint8ClampedArray(8*4*4)
 assert.throws(()=>scanPackFrameBounds(spec(frames),{main:{pixels,width:8,height:4}},31),/扫描范围过大/)
 assert.throws(()=>assertPackFrameScanBudget(spec(frames),31),/扫描范围过大/)
})

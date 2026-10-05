import {test} from 'node:test'
import assert from 'node:assert/strict'
import {poseFor,atlasBoundsFromPixels} from '../src/client/sprite'
import type {MascotDraw} from '../src/engine/script'
const walking={x:10,py:4,look:{pose:'walk',stride:0,facing:1,scale:1,arms:{left:'down',right:'down'}}} as MascotDraw
test('reading and typing select prone poses even when old scenes request walking',()=>{
  assert.equal(poseFor(walking,'reading',0,'none'),'read')
  assert.equal(poseFor(walking,'editing',0,'none'),'type')
  assert.equal(poseFor(walking,'writing',0,'none'),'type')
  assert.equal(poseFor(walking,'testing',0,'none'),'walk-right-0')
  assert.equal(poseFor(walking,'testing',.2,'none'),'walk-right-1')
  assert.equal(poseFor(walking,'reading',0,'failed'),'failed')
})
test('uneven atlas gutters preserve pixels beyond nominal row boundaries',()=>{
  const width=80,height=90,pixels=new Uint8ClampedArray(width*height*4),xs=[0,21,39,60,80],ys=[0,34,62,90]
  for(let row=0;row<3;row++)for(let col=0;col<4;col++)for(let y=ys[row]!+2;y<ys[row+1]!-1;y++)for(let x=xs[col]!+2;x<xs[col+1]!-1;x++)pixels[(y*width+x)*4+3]=255
  const crops=atlasBoundsFromPixels(pixels,width,height)
  assert.equal(crops.length,12)
  assert.equal(crops[0]!.y+crops[0]!.h,33)
  assert.equal(crops[2]!.y+crops[2]!.h,33)
  assert.equal(crops[4]!.y,36)
  assert.ok(crops.every(c=>c.w>0&&c.h>0))
})

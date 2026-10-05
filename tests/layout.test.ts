import {test} from 'node:test'
import assert from 'node:assert/strict'
import {bitmapSize,GRID_ROWS,stageColumns,stageHeight} from '../src/client/layout'

test('the stage stays one height across every conversation width',()=>{
  // Wide windows used to scale the fixed 720x196 bitmap up with the column and
  // the strip swallowed the transcript; the grid must absorb that instead.
  for(let width=320;width<=2560;width+=8){
    const height=stageHeight(width)
    assert.ok(height>=124&&height<=180,`width ${width} rendered ${Math.round(height)}px tall`)
  }
  const wide=stageHeight(2560),typical=stageHeight(980)
  assert.ok(Math.abs(typical-168)<3,`the reclaimed toolbar area rendered ${Math.round(typical)}px tall`)
  assert.ok(wide-typical<15,`the strip grew from ${Math.round(typical)}px to ${Math.round(wide)}px`)
})

test('the grid keeps the authored 8x14 cell ratio',()=>{
  for(const cols of [36,48,90,109,240]){
    const {width,height}=bitmapSize(cols,GRID_ROWS)
    assert.equal(width/cols,8)
    assert.equal(height/GRID_ROWS,14)
  }
})

test('column counts are bounded and survive a missing measurement',()=>{
  assert.equal(stageColumns(0),90)
  assert.equal(stageColumns(Number.NaN),90)
  assert.equal(stageColumns(200),36)
  assert.equal(stageColumns(90000),240)
})

import {test} from 'node:test'
import assert from 'node:assert/strict'
import {SceneSchedule} from '../src/client/scene-schedule'
import {DWELL_MS,LIVE_DWELL_MS,STOCK_MS,type Phase} from '../src/engine/library'
import type {SceneSpec} from '../src/scene'
const stock=(id:string):SceneSpec=>({stock:true,concept:id,raw:{concept:id}})
const live=(id:string):SceneSpec=>({stock:false,concept:id,raw:{concept:id,code:'function frame(){clawd(1,0)}'}})
function start(scene=stock('initial'),phase:Phase='reading'){
  const schedule=new SceneSchedule();schedule.replace(scene,phase,0);schedule.setPlaying(true,0);return schedule
}

test('rapid phase and file changes cannot replace a stock scene before its full dwell',()=>{
  const s=start();let dealt=0
  for(let t=100;t<DWELL_MS;t+=100){const phase:Phase=t%300?'editing':'testing';assert.equal(s.poll(phase,()=>{dealt++;return stock('too soon')},t),undefined)}
  assert.equal(dealt,0)
  const latest=stock('latest phase');assert.equal(s.poll('searching',()=>latest,DWELL_MS),latest)
  assert.equal(s.age(DWELL_MS),0)
  assert.equal(s.poll('reading',()=>stock('another'),DWELL_MS+100),undefined)
})
test('returning to the original phase before dwell cancels obsolete intermediate backgrounds',()=>{
  const s=start();assert.equal(s.poll('editing',()=>stock('editing'),1000),undefined)
  assert.equal(s.poll('reading',()=>stock('reading'),DWELL_MS),undefined)
  assert.equal(s.poll('reading',()=>stock('rotation'),STOCK_MS-1),undefined)
  assert.equal(s.poll('reading',()=>stock('rotation'),STOCK_MS)?.concept,'rotation')
})
test('a generated scene waits its turn and starts its own full 45 second dwell on display',()=>{
  const s=start(),fresh=live('generated')
  assert.equal(s.request(fresh,'reading',2000),undefined)
  assert.equal(s.poll('editing',()=>stock('editing'),DWELL_MS-1),undefined)
  assert.equal(s.poll('editing',()=>stock('editing'),DWELL_MS),fresh)
  // Neither a new phase nor the old stock rotation deadline can evict it.
  assert.equal(s.poll('testing',()=>stock('testing'),STOCK_MS),undefined)
  assert.equal(s.poll('testing',()=>stock('testing'),DWELL_MS+LIVE_DWELL_MS-1),undefined)
  assert.equal(s.poll('testing',()=>stock('testing'),DWELL_MS+LIVE_DWELL_MS)?.concept,'testing')
})
test('only the newest waiting scene is displayed, and cached RPC replays never restart a scene',()=>{
  const s=start(live('current')),latest=live('latest')
  assert.equal(s.request(live('old'),'reading',1000),undefined)
  assert.equal(s.request(latest,'editing',2000),undefined)
  assert.equal(s.request(live('current'),'reading',3000),undefined)
  assert.equal(s.poll('editing',()=>stock('editing'),LIVE_DWELL_MS),latest)
  assert.equal(s.request(live('latest'),'editing',LIVE_DWELL_MS+1000),undefined)
  assert.equal(s.age(LIVE_DWELL_MS+1000),1000)
})
test('pause time never consumes display dwell and canceled pending scenes cannot appear on resume',()=>{
  const s=start();s.request(live('discarded'),'reading',2000);s.setPlaying(false,3000);s.clearPending()
  assert.equal(s.poll('editing',()=>stock('hidden'),100000),undefined);assert.equal(s.age(100000),3000)
  s.setPlaying(true,100000)
  assert.equal(s.poll('editing',()=>stock('resumed'),100000+DWELL_MS-3000-1),undefined)
  assert.equal(s.poll('editing',()=>stock('resumed'),100000+DWELL_MS-3000)?.concept,'resumed')
})
test('manual theme changes and broken scene recovery replace immediately and restart dwell',()=>{
  const s=start(),manual=stock('manual');s.request(live('waiting'),'reading',10)
  assert.equal(s.replace(manual,'reading',500),manual)
  assert.equal(s.poll('editing',()=>stock('editing'),800),undefined)
  const recovery=stock('recovery');assert.equal(s.replace(recovery,'reading',1000),recovery)
  assert.equal(s.poll('reading',()=>stock('rotation'),STOCK_MS+999),undefined)
  assert.equal(s.poll('reading',()=>stock('rotation'),STOCK_MS+1000)?.concept,'rotation')
})

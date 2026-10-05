import {test} from 'node:test'
import assert from 'node:assert/strict'
import {activityFrom,classifyTool} from '../src/activity'
test('Harness shell and file tools select meaningful scene phases',()=>{
  assert.equal(classifyTool('bash','{"command":"npm test"}').phase,'testing')
  assert.equal(classifyTool('pwsh',{command:'pnpm run build'}).phase,'building')
  assert.equal(classifyTool('read',{file_path:'README.md'}).phase,'reading')
  assert.equal(classifyTool('apply_patch',{}).phase,'editing')
  assert.equal(classifyTool('bash',{command:'git status'}).phase,'git')
})
test('tool failure, cancellation and new-turn state are distinct',()=>{
  const entries=[{type:'turn/start',seq:0,data:{turn:1}},{type:'tool/call',seq:1,data:{name:'read',arguments:'{"file_path":"missing.txt"}'}},{type:'tool/result',seq:2,data:{message:{isError:true}}}]
  assert.equal(activityFrom(entries).outcome,'failed')
  assert.equal(activityFrom([...entries,{type:'turn/end',seq:3,data:{reason:{kind:'aborted',reason:'user'}}}]).outcome,'canceled')
  assert.equal(activityFrom([...entries,{type:'turn/end',seq:3,data:{reason:{kind:'error'}}}]).outcome,'failed')
  const next=activityFrom([...entries,{type:'turn/start',seq:4,data:{turn:2}}])
  assert.equal(next.outcome,'none');assert.equal(next.phase,'thinking');assert.equal(next.turn,2)
})
test('reconnection uses authoritative running state',()=>{assert.equal(activityFrom([{type:'turn/start',seq:0,data:{turn:1}}],false).running,false)})

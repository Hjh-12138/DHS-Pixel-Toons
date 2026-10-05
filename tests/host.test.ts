import {test} from 'node:test'
import assert from 'node:assert/strict'
import type {Context} from '@deepseek-ai/cordis'
import type {GenerateOptions,StreamChunk} from '@deepseek-ai/dsh-llm'
import {apply,type ToonsConfig} from '../src/index'
const config:ToonsConfig={enabled:true,source:'ready-made only',fps:20,intervalMs:60000,timeoutMs:5000,maxTokens:1200,provider:'',model:'',stateDirectory:''}
const raw={concept:'阅读小剧场',theme:'library',mood:'day',action:'read',props:[],effects:[],say:''}
function harness(stream:(options:GenerateOptions)=>AsyncIterable<StreamChunk>,overrides:Partial<ToonsConfig>={}){
  const hooks=new Map<string,Function>(),disposers:Function[]=[],warnings:string[]=[],routes=new Map<string,{fetch:(request:Request)=>Promise<Response>}>();let requests=0
  const agent={id:'test',status:'running',options:{provider:'fallback',model:'fallback'},session:{requestHeader:()=>({config:{provider:'deepseek',model:'existing',reasoningEffort:'high'}}),snapshotEvents:()=>[{type:'turn/start',seq:0,data:{turn:1}}]},ctx:{llm:{resolveModelInfo:async()=>({reasoning:{efforts:[{id:'off'},{id:'high'}]}}),prepareCall:async(c:Record<string,unknown>)=>{requests++;return {config:c,stream}}}}}
  const ctx={logger:{warn:(message:string)=>warnings.push(message)},on:(name:string,cb:Function)=>hooks.set(name,cb),effect:(cb:Function)=>{const dispose=cb();if(typeof dispose==='function')disposers.push(dispose)},agents:{get:(id:string)=>id==='test'?agent:undefined},connection:{fetch:{register:(route:{path:string;fetch:(request:Request)=>Promise<Response>})=>{routes.set(route.path,route);return()=>{routes.delete(route.path)}}}}} as unknown as Context
  apply(ctx,{...config,...overrides})
  return {agent,hooks,warnings,dispose:()=>disposers.forEach(d=>d()),requests:()=>requests,call:async(endpoint:string,payload:unknown={sessionId:'test',source:'mix'},signal=new AbortController().signal)=>{const request=new Request(`http://local/api/${endpoint}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'test',method:endpoint,payload}),signal});const response=await routes.get(`/api/${endpoint}`)!.fetch(request);return (await response.json()).result}}
}
test('host uses existing model routing, accounts cached tokens and throttles duplicate requests',async()=>{
  let options:GenerateOptions|undefined
  const h=harness(async function*(o){options=o;yield {type:'text-delta',index:0,text:JSON.stringify(raw)};yield {type:'usage',usage:{inputTokens:10,outputTokens:20,cacheReadTokens:5}};yield {type:'finish',reason:{kind:'stop'}}})
  const result=await h.call('toons/direct');assert.equal(result.value.status,'ready');assert.equal(options?.provider,'deepseek');assert.equal(options?.model,'existing');assert.equal(options?.maxTokens,1200)
  assert.equal(result.value.stats.inputTokens,15);assert.equal((await h.call('toons/direct')).value.status,'throttled');assert.equal(h.requests(),1)
  h.dispose()
})
test('disabled, stock and idle requests never call the model',async()=>{
  const h=harness(async function*(){throw new Error('must not run')})
  assert.equal((await h.call('toons/direct',{sessionId:'test',source:'ready-made only'})).value.status,'disabled')
  h.agent.status='idle';assert.equal((await h.call('toons/direct')).value.status,'idle');assert.equal(h.requests(),0);h.dispose()
  const disabled=harness(async function*(){throw new Error('must not run')},{enabled:false});assert.equal((await disabled.call('toons/direct')).value.status,'disabled');disabled.dispose()
})
test('invalid scene falls back while retaining reported usage',async()=>{
  const h=harness(async function*(){yield {type:'text-delta',index:0,text:'not JSON'};yield {type:'usage',usage:{inputTokens:11,outputTokens:3}};yield {type:'finish',reason:{kind:'stop'}}})
  const response=await h.call('toons/direct');assert.equal(response.value.status,'fallback');assert.equal(response.value.stats.inputTokens,11)
  assert.equal(response.value.reason,'invalid-json')
  const retry=await h.call('toons/direct');assert.equal(retry.value.stats.outputTokens,3);assert.equal(h.requests(),1);h.dispose()
})
test('director has its own lightweight reasoning while the main conversation remains high',async()=>{
  const h=harness(async function*(options){
    if(options.reasoningEffort!=='off'){
      yield {type:'usage',usage:{inputTokens:200,outputTokens:4000}}
      yield {type:'finish',reason:{kind:'max-tokens'}}
      return
    }
    yield {type:'text-delta',index:0,text:JSON.stringify(raw)}
    yield {type:'finish',reason:{kind:'stop'}}
  })
  assert.equal((await h.call('toons/direct')).value.status,'ready')
  assert.equal(h.agent.session.requestHeader().config.reasoningEffort,'high')
  h.dispose()
})
test('a generation deadline returns an actionable fallback rather than a silent cancellation',async()=>{
  const h=harness(async function*(options){
    await new Promise<void>((_resolve,reject)=>options.signal!.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))
    yield {type:'finish',reason:{kind:'stop'}}
  },{timeoutMs:20})
  const result=await h.call('toons/direct')
  assert.equal(result.value.status,'fallback');assert.equal(result.value.reason,'timeout')
  assert.deepEqual(h.warnings,['dsh-toons director fallback: timeout'])
  h.dispose()
})
test('provider failure details never reach the UI or fallback log',async()=>{
  const h=harness(async function*(){throw Object.assign(new Error('Authorization: sk-private-test'),{code:'ACCOUNT_TOKEN_INVALID'})})
  const result=await h.call('toons/direct')
  assert.equal(result.value.reason,'auth')
  assert.doesNotMatch(JSON.stringify([result,h.warnings]),/sk-private|Authorization/)
  h.dispose()
})
test('ending a turn and disposing the plugin cancel a pending director',async()=>{
  for(const end of ['turn','dispose']){
    let started!:()=>void;const entered=new Promise<void>(resolve=>started=resolve)
    const h=harness(async function*(o){started();await new Promise<void>((_resolve,reject)=>{o.signal!.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})});yield {type:'finish',reason:{kind:'stop'}}})
    const pending=h.call('toons/direct');await entered
    if(end==='turn')h.hooks.get('session/event')!({id:'test'},{type:'turn/end'});else h.dispose()
    const result=await pending;assert.equal(result.value.status,'canceled');assert.equal(result.value.scene,undefined);h.dispose()
  }
})

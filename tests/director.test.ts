import {test} from 'node:test'
import assert from 'node:assert/strict'
import type {GenerateOptions,StreamChunk} from '@deepseek-ai/dsh-llm'
import {ReasoningEffortId} from '@deepseek-ai/dsh-llm'
import {directScene} from '../src/director'
import {emptyActivity} from '../src/activity'
import {DirectorError,directorFailure,fallbackCaption} from '../src/director-status'
import {withDirectorReasoning} from '../src/director-routing'
const raw={concept:'阅读小剧场',theme:'library',mood:'day',action:'read',props:[{kind:'book',slot:'left'}],effects:['fireflies'],say:'让我看看这段代码。'}
test('director uses configured routing and keeps its context out of the main conversation',async()=>{
  let request:GenerateOptions|undefined
  async function* stream(o:GenerateOptions):AsyncIterable<StreamChunk>{request=o;yield {type:'text-delta',index:0,text:JSON.stringify(raw)};yield {type:'usage',usage:{inputTokens:40,outputTokens:90}};yield {type:'finish',reason:{kind:'stop'}}}
  const result=await directScene(stream,{provider:'deepseek',model:'configured',maxTokens:1200},{...emptyActivity(),running:true,phase:'reading',what:'README.md'})
  assert.equal(request?.provider,'deepseek');assert.equal(request?.model,'configured');assert.equal(request?.messages.length,1);assert.equal(request?.tools,undefined)
  assert.equal(result.scene.stock,false);assert.equal(result.usage?.outputTokens,90)
  assert.match(request!.system!,/必须使用简体中文/);assert.doesNotMatch(request!.system!,/Use ASCII|Single-width characters only/)
  assert.equal(result.scene.concept,'阅读小剧场')
  assert.deepEqual(result.scene.preset,{theme:'library',mood:'day'})
  assert.equal(result.scene.direction?.say,raw.say)
  assert.equal(result.scene.direction?.phase,'reading')
  assert.doesNotMatch(request!.system!,/14 text rows|frame\(t, dt\)|绘图函数/)
})
test('reasoning consumes the output budget without text and reports token-limit explicitly',async()=>{
  let billed=0
  async function* reasoningOnly():AsyncIterable<StreamChunk>{
    yield {type:'reasoning-delta',index:0,text:'正在思考绘图方案'}
    yield {type:'usage',usage:{inputTokens:200,outputTokens:4000}}
    yield {type:'finish',reason:{kind:'max-tokens'}}
  }
  await assert.rejects(()=>directScene(reasoningOnly,{provider:'deepseek',model:'flash'},emptyActivity(),usage=>{billed=usage.outputTokens}),error=>error instanceof DirectorError&&error.code==='token-limit')
  assert.equal(billed,4000)
})
test('empty, malformed and unsafe scenes expose separate failure reasons',async()=>{
  for(const [text,code] of [['','empty-output'],['{','invalid-json'],[JSON.stringify({...raw,code:'function frame(){fetch("https://example.com")}'}),'invalid-scene']] as const){
    async function* stream():AsyncIterable<StreamChunk>{yield {type:'text-delta',index:0,text};yield {type:'finish',reason:{kind:'stop'}}}
    await assert.rejects(()=>directScene(stream,{provider:'test',model:'test'},emptyActivity()),error=>error instanceof DirectorError&&error.code===code)
  }
})
test('auxiliary reasoning follows exact-route capabilities without inventing an unsupported level',()=>{
  const route={provider:'test',model:'test',maxTokens:4000}
  const model=(ids:string[])=>({reasoning:{efforts:ids.map(id=>({id:ReasoningEffortId(id),name:id}))}})
  assert.equal(withDirectorReasoning(route,model(['high','off'])).reasoningEffort,'off')
  assert.equal(withDirectorReasoning(route,model(['high','low'])).reasoningEffort,'low')
  assert.equal(withDirectorReasoning(route,model(['custom'])).reasoningEffort,undefined)
  assert.equal(withDirectorReasoning(route,{}).reasoningEffort,undefined)
  assert.equal('reasoningEffort' in route,false)
  assert.equal(directorFailure({failure:{status:429}}),'quota')
  assert.match(fallbackCaption('已回退到预制场景','token-limit'),/模型输出达到上限/)
  assert.equal(fallbackCaption('已回退到预制场景','unknown-private-message'),'已回退到预制场景')
})
test('bad model output and aborted streams are rejected for ready-made fallback',async()=>{
  async function* broken():AsyncIterable<StreamChunk>{yield {type:'text-delta',index:0,text:'no JSON'};yield {type:'finish',reason:{kind:'stop'}}}
  await assert.rejects(()=>directScene(broken,{provider:'fake',model:'fake'},emptyActivity()))
  async function* aborted():AsyncIterable<StreamChunk>{yield {type:'finish',reason:{kind:'aborted',failure:{message:'canceled',code:'ABORT'}}}}
  await assert.rejects(()=>directScene(aborted,{provider:'fake',model:'fake'},emptyActivity()),/aborted/)
  async function* english():AsyncIterable<StreamChunk>{yield {type:'text-delta',index:0,text:JSON.stringify({...raw,concept:'A book'})};yield {type:'finish',reason:{kind:'stop'}}}
  await assert.rejects(()=>directScene(english,{provider:'fake',model:'fake'},emptyActivity()),/Chinese/)
})

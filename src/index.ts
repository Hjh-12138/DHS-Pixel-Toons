import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-client-connection'
import {clientRequestSchema} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-llm'
import type {TokenUsage} from '@deepseek-ai/dsh-llm'
import { mkdir, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { activityFrom } from './activity'
import { directScene } from './director'
import {withDirectorReasoning} from './director-routing'
import {DirectorError,directorFailure} from './director-status'
import type { SceneSpec } from './scene'

export const name='dsh-toons'
export const inject=['connection','agents','sessions','llm']
export interface ToonsConfig {enabled:boolean;source:'ready-made only'|'mix';fps:number;intervalMs:number;timeoutMs:number;maxTokens:number;provider:string;model:string;stateDirectory:string}
export const Config:z<ToonsConfig>=z.object({
  enabled:z.boolean().default(true),source:z.union(['ready-made only','mix']).default('ready-made only'),fps:z.number().min(1).max(30).step(1).default(20),
  intervalMs:z.number().min(15000).max(3600000).default(60000),timeoutMs:z.number().min(5000).max(120000).default(45000),maxTokens:z.number().min(500).max(16000).step(1).default(4000),
  provider:z.string().default(''),model:z.string().default(''),stateDirectory:z.string().default(''),
})
type LiveState={at:number;key:string;controller?:AbortController;scene?:SceneSpec;inputTokens:number;outputTokens:number;requests:number;generation:number}

/** Native Host plugin: authenticated Connection RPC, existing model routing, and cancellation. */
export function apply(ctx:Context,config:ToonsConfig):void {
  const states=new Map<string,LiveState>()
  let disposed=false
  const stop=(id:string)=>{const s=states.get(id);if(s){s.generation++;s.controller?.abort();s.controller=undefined;s.scene=undefined}}
  ctx.on('session/event',(session,event)=>{if(event.type==='turn/end')stop(session.id)})
  ctx.on('agent/status',({agent,status})=>{if(status==='idle')stop(agent.id)})
  ctx.effect(()=>()=>{disposed=true;for(const id of states.keys())stop(id);states.clear()})
  const handle=async(endpoint:string,payload:unknown,signal:AbortSignal)=>{
    const fail=(message:string)=>({ok:false as const,error:{code:'toons',message,details:{}}})
    if(endpoint==='toons/config')return {ok:true,value:{enabled:config.enabled,source:config.source,fps:config.fps,intervalMs:config.intervalMs}}
    if(!payload||typeof payload!=='object'||Array.isArray(payload))return fail('Invalid request')
    const p=payload as Record<string,unknown>
    if(typeof p.sessionId!=='string'||!p.sessionId||p.sessionId.length>256)return fail('Invalid session id')
    const id=p.sessionId
    if(endpoint==='toons/cancel'){stop(id);return {ok:true,value:{status:'canceled'}}}
    if(endpoint!=='toons/direct')return fail('Unknown endpoint')
    if(!config.enabled||p.source!=='mix')return {ok:true,value:{status:'disabled'}}
    const agent=ctx.agents.get(SessionId(id))
    if(!agent||agent.status!=='running')return {ok:true,value:{status:'idle'}}
    let state=states.get(id)
    if(!state){state={at:0,key:'',inputTokens:0,outputTokens:0,requests:0,generation:0};states.set(id,state)}
    if(state.controller)return {ok:true,value:{status:'busy'}}
    const activity=activityFrom(agent.session.snapshotEvents(),true)
    const key=`${activity.turn}:${activity.interesting}`
    if(Date.now()-state.at<config.intervalMs)return {ok:true,value:{status:'throttled',scene:state.key===key?state.scene:undefined,stats:{requests:state.requests,inputTokens:state.inputTokens,outputTokens:state.outputTokens}}}
    const controller=new AbortController(),generation=++state.generation
    state.controller=controller;state.at=Date.now();state.key=key;state.requests++
    const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true})
    if(signal.aborted)controller.abort()
    let timedOut=false
    const timer=setTimeout(()=>{timedOut=true;abort()},config.timeoutMs)
    let usage:TokenUsage|undefined
    try {
      const header=agent.session.requestHeader()?.config
      const provider=config.provider||header?.provider||agent.options.provider
      const model=config.model||header?.model||agent.options.model
      if(!provider||!model)throw new DirectorError('model-unavailable')
      const modelInfo=await agent.ctx.llm.resolveModelInfo(provider,model,controller.signal)
      const prepared=await agent.ctx.llm.prepareCall(withDirectorReasoning({provider,model,maxTokens:config.maxTokens},modelInfo),controller.signal)
      const result=await directScene(o=>prepared.stream(o),{...prepared.config,signal:controller.signal},activity,value=>{usage=value})
      if(controller.signal.aborted||disposed||generation!==state.generation||agent.status!=='running')return {ok:true,value:{status:'canceled'}}
      state.scene=result.scene
      return {ok:true,value:{status:'ready',scene:result.scene,stats:{requests:state.requests,inputTokens:state.inputTokens+(usage?.inputTokens??0)+(usage?.cacheReadTokens??0)+(usage?.cacheWriteTokens??0),outputTokens:state.outputTokens+(usage?.outputTokens??0)}}}
    }catch(error){
      const canceled=!timedOut&&(controller.signal.aborted||disposed||generation!==state.generation)
      const reason=timedOut?'timeout':directorFailure(error)
      if(!canceled)ctx.logger.warn(`dsh-toons director fallback: ${reason}`)
      return {ok:true,value:{status:canceled?'canceled':'fallback',...canceled?{}:{reason},stats:{requests:state.requests,inputTokens:state.inputTokens+(usage?.inputTokens??0)+(usage?.cacheReadTokens??0)+(usage?.cacheWriteTokens??0),outputTokens:state.outputTokens+(usage?.outputTokens??0)}}}
    }
    finally{
      state.inputTokens+=(usage?.inputTokens??0)+(usage?.cacheReadTokens??0)+(usage?.cacheWriteTokens??0);state.outputTokens+=usage?.outputTokens??0
      clearTimeout(timer);signal.removeEventListener('abort',abort);if(state.controller===controller)state.controller=undefined
      if(config.stateDirectory){try{await mkdir(config.stateDirectory,{recursive:true});await appendFile(join(config.stateDirectory,'director.jsonl'),JSON.stringify({time:new Date().toISOString(),sessionId:id,usage,requests:state.requests})+'\n')}catch{/* Optional accounting storage cannot break an agent or animation. */}}
    }
  }
  // Exact Fetch contributions coexist with the Gateway's single shared interceptor.
  for(const endpoint of ['toons/config','toons/direct','toons/cancel']){
    ctx.connection.fetch.register({path:`/api/${endpoint}`,methods:['POST'],requestBody:'buffered',fetch:async request=>{
      if(request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')return new Response('JSON required',{status:415})
      let raw:unknown;try{raw=await request.json()}catch{return new Response('Invalid JSON',{status:400})}
      const parsed=clientRequestSchema.safeParse(raw)
      if(!parsed.success||parsed.data.method!==endpoint)return new Response('Invalid RPC envelope',{status:400})
      return Response.json({type:'server-response',rpcId:parsed.data.rpcId,result:await handle(endpoint,parsed.data.payload,request.signal)})
    }})
  }
}

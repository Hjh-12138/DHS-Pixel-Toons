import type { GenerateOptions, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import {sceneDirectorPrompt,parseScenePlan,sceneFromPlan} from './scene-plan'
import type {SceneSpec} from './scene'
import type { Activity } from './activity'
import {DirectorError,directorFailure} from './director-status'

/** Provider-independent director; consumes the existing Harness stream API. */
export async function directScene(stream:(options:GenerateOptions)=>AsyncIterable<StreamChunk>, config:Omit<GenerateOptions,'messages'|'system'>, activity:Activity,onUsage?:(usage:TokenUsage)=>void):Promise<{scene:SceneSpec;usage?:TokenUsage}> {
  const system=sceneDirectorPrompt()
  let output='',usage:TokenUsage|undefined,finished=false
  for await (const chunk of stream({...config,system,messages:[{role:'user',content:[{type:'text',text:JSON.stringify({phase:activity.phase,task:activity.what.slice(0,160),failed:activity.outcome==='failed'})}]}]})) {
    if (chunk.type==='text-delta') {output+=chunk.text;if(output.length>50000)throw new DirectorError('output-limit')}
    if (chunk.type==='usage') {usage=chunk.usage;onUsage?.(usage)}
    if (chunk.type==='finish') {
      if(chunk.reason.kind==='max-tokens')throw new DirectorError('token-limit')
      if(chunk.reason.kind==='error')throw new DirectorError(directorFailure(chunk.reason.failure))
      if(chunk.reason.kind==='aborted')throw new Error('Director aborted')
      finished=true
    }
  }
  if (!finished) throw new DirectorError('request-failed','Director stream ended without a finish')
  const cleaned=output.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')
  if(!cleaned)throw new DirectorError('empty-output')
  let raw:unknown
  try{raw=JSON.parse(cleaned)}catch{throw new DirectorError('invalid-json')}
  let plan:ReturnType<typeof parseScenePlan>
  try{plan=parseScenePlan(raw)}catch{throw new DirectorError('invalid-scene')}
  const concept=plan.concept
  if (!/[\u3400-\u9fff]/.test(concept)) throw new DirectorError('language','Director must describe the scene in Chinese')
  return {scene:sceneFromPlan(plan,activity.phase),usage}
}

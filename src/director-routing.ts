import type {LlmCallConfig,LlmResolvedModelInfo} from '@deepseek-ai/dsh-llm'

/** Select only an effort explicitly offered by this exact route, for this auxiliary call. */
export function withDirectorReasoning(config:LlmCallConfig,model:Pick<LlmResolvedModelInfo,'reasoning'>):LlmCallConfig {
  const effort=['off','minimal','low'].map(id=>model.reasoning?.efforts.find(e=>e.id===id)?.id).find(id=>id!==undefined)
  return effort?{...config,reasoningEffort:effort}:config
}

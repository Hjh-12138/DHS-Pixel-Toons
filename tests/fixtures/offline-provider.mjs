// Test-only adapter: no network and no credentials. Excluded from the installable package.
import {LlmAdapter} from '@deepseek-ai/dsh-llm'
import {setTimeout} from 'node:timers/promises'
class OfflineAdapter extends LlmAdapter {
  providerInfo(provider){return {id:provider,name:'Toons 离线联调'}}
  async listModels(provider){return [{provider,id:'offline',name:'Toons 离线联调（无网络）'}]}
  async *stream(options){
    if(options.system?.includes('像素小剧场导演')){
      yield {type:'text-delta',index:0,text:JSON.stringify({concept:'工坊任务：鲸鱼娘检查终端，饭碗在旁边等候',theme:'workshop',mood:'day',action:'type',props:[{kind:'rice-bowl',slot:'left'},{kind:'terminal',slot:'right'}],effects:['steam','scan'],say:'我在陪你写代码，加油呀！'})}
      yield {type:'usage',usage:{inputTokens:42,outputTokens:84}}
    }else{
      for(const text of ['这是离线联调会话。','正在展示 Harness 原生会话中的动画。','女孩正在趴着敲键盘。','这里只生成测试文本，','没有调用任何外部模型，','也没有执行工具或修改工作区文件。','可以验证隐藏、模式切换和任务结束。','联调完成。']){await setTimeout(1800,undefined,{signal:options.signal});yield {type:'text-delta',index:0,text}}
    }
    yield {type:'finish',reason:{kind:'stop'}}
  }
}
export const inject=['llm']
export function apply(ctx){ctx.llm.registerAdapter(['toons-offline'],new OfflineAdapter())}

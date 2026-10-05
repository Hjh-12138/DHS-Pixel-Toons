import {createRoot} from 'react-dom/client'
import {useMemo,useState} from 'react'
import {Strip,type Rpc} from './client/Strip'
import {zh,type ToonsKey} from './client/locales'
import type {ActivityEvent} from './activity'
const t=(key:ToonsKey)=>zh[key]
const call:Rpc=async(endpoint)=>({ok:true,value:endpoint==='toons/config'?{enabled:true,fps:20,intervalMs:60000}:{status:'fallback'}})
const tools=[['idle','待机',''],['thinking','思考',''],['reading','阅读','read'],['editing','敲键盘','edit'],['walk-left','向左走',''],['walk-right','向右走',''],['searching','搜索','grep'],['testing','测试','bash'],['building','构建','bash'],['git','Git','bash'],['web','资料检索','web'],['agents','协作','subagent'],['success','任务完成',''],['failed','遇到问题','read']] as const
function Preview(){
  const [phase,setPhase]=useState('reading'),[running,setRunning]=useState(true),[revision,setRevision]=useState(1)
  const events=useMemo(()=>{
    if(phase==='idle')return []
    const name=tools.find(x=>x[0]===phase)?.[2]||'read'
    const command=phase==='testing'?'npm test':phase==='building'?'npm run build':phase==='git'?'git status':''
    const list:ActivityEvent[]=[{type:'turn/start',seq:0,data:{turn:revision}}]
    if(phase!=='thinking'&&!phase.startsWith('walk-'))list.push({type:'tool/call',seq:1,data:{name,arguments:JSON.stringify({file_path:'README.md',command})}})
    if(phase==='failed')list.push({type:'tool/result',seq:2,data:{message:{isError:true}}})
    if(phase==='success')list.push({type:'turn/end',seq:2,data:{reason:{kind:'completed'}}})
    return list
  },[phase,revision])
  return <main><header><div className="eyebrow">DSH TOOL / 角色与动作预览</div><h1>让等待，有一点陪伴。</h1><p>在「本地资源」里导入你的角色与场景，切换下方动作进行预览。</p></header>
    <div className="demo-actions">{tools.map(([id,label])=><button key={id} aria-pressed={phase===id} onClick={()=>{setPhase(id);setRevision(x=>x+1)}}>{label}</button>)}<button onClick={()=>setRunning(x=>!x)}>{running?'暂停任务':'继续任务'}</button></div>
    <Strip sessionId="preview" running={phase==='success'||phase==='idle'?false:running} events={events} call={call} t={t} walkPreview={phase==='walk-left'?-1:phase==='walk-right'?1:undefined}/>
    <footer>离线动作预览；这里的动态混合只演示回退，不调用模型。插件实际安装后读取 Harness 会话事件。</footer>
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview/> )

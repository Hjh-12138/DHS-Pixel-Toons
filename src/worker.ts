import { cleanScript, stage, type Script, type MascotDraw } from './engine/script'
import type { SceneSpec } from './scene'
import type {PixelPreset} from './presets'

/** Every animation strip owns a dedicated worker and interpreter. */
type WorkerInput = {type:'scene';scene:SceneSpec;cols:number;rows:number;fps:number}|{type:'pause';paused:boolean}|{type:'resize';cols:number;rows:number}
const scope = self as typeof self & { postMessage:(value:unknown,transfer?:Transferable[])=>void }
let script:Script|undefined,preset:PixelPreset|undefined,cols=90,rows=14,fps=20,started=0,pausedAt=0,timer:ReturnType<typeof setTimeout>|undefined,paused=true
function tick(force=false) {
  if ((paused&&!force)||!script) return
  const t=((paused?pausedAt:performance.now())-started)/1000
  const mascots:MascotDraw[]=[]
  try {
    const cells=stage({cols,rows,t,script,since:t*1000,reveal:1,onMascot:m=>mascots.push(m)})
    if (script.code?.error) { scope.postMessage({type:'broken',error:script.code.error});paused=true;return }
    scope.postMessage({type:'frame',cells,mascots,t,cols,rows,preset},[cells.buffer])
  } catch(e) {scope.postMessage({type:'broken',error:e instanceof Error?e.message:String(e)});paused=true;return}
  if(!paused)timer=setTimeout(tick,1000/fps)
}
scope.onmessage=(event:MessageEvent<WorkerInput>)=>{
  const m=event.data
  if (timer) clearTimeout(timer)
  if (m.type==='scene') {script=cleanScript(m.scene.raw);preset=m.scene.preset;cols=m.cols;rows=m.rows;fps=m.fps;started=performance.now();pausedAt=0;paused=false}
  else if (m.type==='resize') {cols=m.cols;rows=m.rows}
  else if(m.paused!==paused){if(m.paused)pausedAt=performance.now();else started+=performance.now()-pausedAt;paused=m.paused}
  tick(m.type==='resize')
}

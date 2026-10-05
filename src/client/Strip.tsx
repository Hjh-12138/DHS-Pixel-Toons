import {useEffect,useMemo,useRef,useState} from 'react'
import spriteUrl from '../../assets/deepseek-girl-poses.png'
import activeUrl from '../../assets/deepseek-girl-active.png'
import workUrl from '../../assets/deepseek-girl-work.png'
import walkingUrl from '../../assets/deepseek-girl-walk.png'
import workerSource from 'toons:worker-source'
import {activityFrom,type ActivityEvent} from '../activity'
import {SceneDeck,type SceneSpec} from '../scene'
import {atlasBounds,animationSheet,paint} from './sprite'
import {advanceMotion,OUTCOME_SECONDS,type MotionClock} from './animation'
import {CharacterTravel,type TravelPose} from './travel'
import {bitmapSize,GRID_ROWS,stageColumns} from './layout'
import type {ToonsKey} from './locales'
import {fallbackCaption} from '../director-status'
import {PIXEL_THEMES,GAME_THEMES,THEME_NAMES,isPixelTheme,isGameTheme} from '../presets'
import {decodePreferences,DEFAULT_PREFERENCES,type Preferences} from './preferences'
import {useResourcePacks} from './use-resource-packs'
import {ResourcePanel} from './ResourcePanel'
import {useSceneSchedule} from './scene-schedule'

export type Rpc=(endpoint:string,payload:unknown,signal?:AbortSignal)=>Promise<{ok:true;value:unknown}|{ok:false;error:{message:string}}>
function readPreferences():Preferences {try{return decodePreferences(localStorage.getItem('dsh-toons:v1'))}catch{return DEFAULT_PREFERENCES}}
function hasSavedSource(){try{const source=JSON.parse(localStorage.getItem('dsh-toons:v1')||'{}').source;return source==='mix'||source==='ready-made only'}catch{return false}}
type Props={sessionId:string;running:boolean;events:readonly ActivityEvent[];call:Rpc;t:(key:ToonsKey)=>string;demo?:boolean;walkPreview?:-1|1}

/** UI-only animation strip; the agent transcript contains no animation output. */
export function Strip({sessionId,running,events,call,t,demo=false,walkPreview}:Props){
  const [prefs,setPrefs]=useState(readPreferences),[status,setStatus]=useState(''),[tokens,setTokens]=useState(0),[visible,setVisible]=useState(!document.hidden),[ready,setReady]=useState(false)
  const [config,setConfig]=useState({enabled:false,fps:20,intervalMs:60000}),[reducedMotion,setReducedMotion]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)
  const canvas=useRef<HTMLCanvasElement>(null),worker=useRef<Worker>(),abort=useRef<AbortController>(),epoch=useRef(0),lastInteresting=useRef(''),activityRef=useRef(activityFrom(events,running)),redraw=useRef(()=>{})
  const stage=useRef<HTMLDivElement>(null)
  const [columns,setColumns]=useState(90)
  const columnsRef=useRef(columns);columnsRef.current=columns
  const motion=useRef<MotionClock>({time:0,outcomeAge:0,playing:false})
  const navigator=useRef(new CharacterTravel()),travel=useRef<TravelPose>(navigator.current.snapshot())
  const liveHome=useRef(.52)
  useEffect(()=>{navigator.current=new CharacterTravel();travel.current=navigator.current.snapshot()},[sessionId])
  const activity=useMemo(()=>activityFrom(events,running),[events,running]);activityRef.current=activity
  const deck=useMemo(()=>new SceneDeck(prefs.style==='all'?['all']:['pixel art'],prefs.theme),[sessionId,prefs.style,prefs.theme])
  const active=(running||demo)&&config.enabled&&!prefs.compact&&visible
  const activeRef=useRef(active);activeRef.current=active
  const {scene,accept:acceptScene,recover:recoverScene}=useSceneSchedule(deck,activity.phase,activity.what,active&&ready&&!reducedMotion,`${prefs.source}:${prefs.scenePackId??''}`)
  useEffect(()=>{lastInteresting.current=''},[deck])
  const savedSource=useRef(hasSavedSource())
  const settings=(change:Partial<Preferences>)=>{if(change.source){savedSource.current=true;lastInteresting.current='';setStatus(previous=>previous.startsWith(t('fallback'))?'':previous)}setPrefs(previous=>({...previous,...change}))}
  const [resourcesOpen,setResourcesOpen]=useState(false)
  const library=useResourcePacks(prefs,settings),resourcesRef=useRef(library.resources);resourcesRef.current=library.resources
  useEffect(()=>redraw.current(),[library.resources])
  useEffect(()=>{try{localStorage.setItem('dsh-toons:v1',JSON.stringify(prefs))}catch{/* Storage may be unavailable in an embedded webview. */}},[prefs])
  useEffect(()=>{const onVisibility=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',onVisibility);return()=>document.removeEventListener('visibilitychange',onVisibility)},[])
  useEffect(()=>{
    const element=stage.current
    if(!element)return
    const measure=()=>{const width=element.clientWidth;if(width>0)setColumns(previous=>{const next=stageColumns(width);return next===previous?previous:next})}
    measure()
    const observer=new ResizeObserver(measure);observer.observe(element)
    return()=>observer.disconnect()
  },[prefs.compact])
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReducedMotion(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
  useEffect(()=>{let alive=true;void call('toons/config',{}).then(r=>{if(alive&&r.ok&&r.value&&typeof r.value==='object'){const c=r.value as Record<string,unknown>;setConfig({enabled:c.enabled!==false,fps:typeof c.fps==='number'?c.fps:20,intervalMs:typeof c.intervalMs==='number'?c.intervalMs:60000});if(!savedSource.current&&c.source==='mix')setPrefs(previous=>({...previous,source:'mix'}));savedSource.current=true}}).catch(()=>{if(alive){setConfig({enabled:true,fps:20,intervalMs:60000});setStatus(t('fallback'))}});return()=>{alive=false}},[call,t])
  useEffect(()=>{
    let alive=true
    const load=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Sprite image unavailable'));image.src=src})
    void Promise.all([load(spriteUrl),load(activeUrl),load(workUrl),load(walkingUrl)]).then(([image,activeImage,workImage,walkingImage])=>{
      if(!alive)return
      const animations={active:animationSheet(activeImage,[0,1,2,3]),work:animationSheet(workImage,[2,3]),walking:animationSheet(walkingImage,[0,1],2)}
      const crops=atlasBounds(image),url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'})),w=new Worker(url)
      URL.revokeObjectURL(url);worker.current=w
      let lastFrame:Parameters<typeof paint>[1]|undefined
      redraw.current=()=>{const target=canvas.current;if(!lastFrame||!target)return
        // The bitmap always matches the frame's grid, so cells stay 8x14 and the
        // CSS width scales the whole scene without distortion.
        const {width,height}=bitmapSize(lastFrame.cols,lastFrame.rows)
        if(target.width!==width||target.height!==height){target.width=width;target.height=height}
        const g=target.getContext('2d');if(g)paint(g,lastFrame,image,crops,activityRef.current.phase,activityRef.current.outcome,animations,motion.current,resourcesRef.current,travel.current)}
      w.onmessage=e=>{if(!alive)return;const message=e.data;if(message.type==='frame'){lastFrame=message;const m=message.mascots[0];if(!message.preset&&m)liveHome.current=(m.x+7*Math.max(.3,Math.min(2,m.look.scale)))/message.cols;if(!motion.current.playing)redraw.current()}else if(message.type==='broken'){setStatus(fallbackCaption(t('fallback'),'animation-error'));recoverScene()}}
      w.onerror=()=>{if(alive)setStatus(t('error'))};setReady(true)
    }).catch(()=>{if(alive)setStatus(t('error'))})
    return()=>{alive=false;setReady(false);worker.current?.terminate();worker.current=undefined;redraw.current=()=>{}}
  },[sessionId,t,recoverScene])
  useEffect(()=>{motion.current={time:0,outcomeAge:0,playing:false,working:running||demo}},[activity.phase,activity.outcome,activity.turn,running,demo])
  useEffect(()=>{
    if(!ready)return
    let id=0,last=performance.now()
    const advance=(delta:number)=>{
      motion.current=advanceMotion(motion.current,delta,running||demo,config.enabled&&visible&&!prefs.compact,reducedMotion,activity.outcome)
      const target=canvas.current,resources=resourcesRef.current,actions=resources?.character?.spec.actions
      if(target)travel.current=navigator.current.advance({delta,playing:motion.current.playing,working:running||demo,phase:activity.phase,reacting:(activity.outcome==='success'||activity.outcome==='failed')&&motion.current.outcomeAge<OUTCOME_SECONDS,width:target.width,height:target.height,home:resources?.scene?.spec.centerX??(scene?.preset ? .52 : liveHome.current),canWalk:(!(running||demo)||!!(scene?.preset||resources?.scene))&&(!actions||!!(actions['walk-left']||actions['walk-right'])),direction:walkPreview})
      redraw.current()
    }
    const tick=(now:number)=>{
      if(now-last<1000/config.fps-1){id=requestAnimationFrame(tick);return}
      advance((now-last)/1000);last=now
      if(motion.current.playing)id=requestAnimationFrame(tick)
    }
    // Draw immediately on state changes, including the first frame of a finish.
    advance(0)
    if(motion.current.playing)id=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(id)
  },[running,demo,config.enabled,visible,prefs.compact,reducedMotion,ready,config.fps,activity.phase,activity.outcome,scene,walkPreview])
  useEffect(()=>redraw.current(),[activity.phase,activity.outcome,prefs.compact])
  useEffect(()=>{
    if(!scene||!ready||!worker.current)return
    worker.current.postMessage({type:'scene',scene,cols:columnsRef.current,rows:GRID_ROWS,fps:config.fps});worker.current.postMessage({type:'pause',paused:!active||reducedMotion})
  },[scene,ready,config.fps,reducedMotion])
  // A new column count re-lays out the running scene without restarting its clock.
  useEffect(()=>{worker.current?.postMessage({type:'resize',cols:columns,rows:GRID_ROWS})},[columns,ready])
  useEffect(()=>{worker.current?.postMessage({type:'pause',paused:!active||reducedMotion});if(!active||prefs.source!=='mix'){epoch.current++;abort.current?.abort();void call('toons/cancel',{sessionId}).catch(()=>{})}},[active,reducedMotion,prefs.source,sessionId,call])
  useEffect(()=>{
    if(!active||prefs.source!=='mix'||!activity.interesting||lastInteresting.current===activity.interesting)return
    lastInteresting.current=activity.interesting
    const controller=new AbortController(),generation=++epoch.current;abort.current?.abort();abort.current=controller
    void call('toons/direct',{sessionId,source:'mix'},controller.signal).then(r=>{
      if(controller.signal.aborted||generation!==epoch.current||!activeRef.current)return
      if(!r.ok){setStatus(fallbackCaption(t('fallback'),'connection'));return}
      const value=r.value as {status?:string;reason?:string;scene?:SceneSpec;stats?:{inputTokens:number;outputTokens:number}}
      if(value.scene){acceptScene(value.scene,activity.phase);setStatus('')}
      else if(value.status==='fallback')setStatus(fallbackCaption(t('fallback'),value.reason))
      if(value.stats)setTokens(value.stats.inputTokens+value.stats.outputTokens)
    }).catch(()=>{if(!controller.signal.aborted)setStatus(fallbackCaption(t('fallback'),'connection'))})
    return()=>controller.abort()
  },[active,prefs.source,activity.interesting,sessionId,call,t,acceptScene])
  useEffect(()=>()=>{epoch.current++;abort.current?.abort();void call('toons/cancel',{sessionId}).catch(()=>{})},[sessionId,call])
  const label=!running&&!demo?t(activity.outcome==='none'?'idle':activity.outcome):activity.outcome==='failed'?t('failed'):t(activity.phase)
  return <section className="dsh-toons" aria-label={t('title')}>
    <style>{CSS}</style>
    {!prefs.compact&&<div className="toons-stage" ref={stage}><canvas ref={canvas} width={720} height={112} aria-label={label}/></div>}
    <div className={`toons-controls${prefs.compact?' is-compact':''}`}>
      {!prefs.compact&&<>
        <select className="toons-mode" aria-label={t('settings')} value={prefs.source} disabled={!!prefs.scenePackId} title={prefs.scenePackId?'本地场景使用预制模式':undefined} onChange={e=>settings({source:e.target.value as Preferences['source']})}><option value="ready-made only">{t('stock')}</option><option value="mix">{t('mix')}</option></select>
        <select className="toons-theme" aria-label={t('theme')} value={prefs.scenePackId?'local':prefs.theme??prefs.style} onChange={e=>{const value=e.target.value;settings(isPixelTheme(value)?{theme:value,scenePackId:undefined,source:'ready-made only'}:{theme:undefined,scenePackId:undefined,style:value as Preferences['style']})}}>{prefs.scenePackId&&<option value="local">本地 · {library.packs.find(p=>p.id===prefs.scenePackId)?.manifest.name??'资源场景'}</option>}<option value="pixel">{t('pixel')}</option><option value="all">{t('all')}</option><optgroup label={t('games')}>{GAME_THEMES.map(id=><option key={id} value={id}>{THEME_NAMES[id]}</option>)}</optgroup><optgroup label={t('otherThemes')}>{PIXEL_THEMES.filter(id=>!isGameTheme(id)).map(id=><option key={id} value={id}>{THEME_NAMES[id]}</option>)}</optgroup></select>
        <span className="toons-caption" title={status||undefined}>{status||(prefs.scenePackId?'本地场景 · 离线播放':prefs.source==='mix'?t('cost'):scene?.concept)}</span>
        {tokens>0&&<span className="toons-tokens">{t('tokens')}: {tokens}</span>}
      </>}
      <span className={`toons-status ${active?'is-active':''}`} role="status"><i aria-hidden="true"/>{label}</span>
      {!prefs.compact&&<button className="toons-resource-toggle" aria-expanded={resourcesOpen} aria-label="本地资源" onClick={()=>setResourcesOpen(x=>!x)}>本地资源{library.error?' !':''}</button>}
      <button className="toons-toggle" aria-expanded={!prefs.compact} onClick={()=>settings({compact:!prefs.compact})}>{t(prefs.compact?'expand':'collapse')}</button>
    </div>
    {!prefs.compact&&resourcesOpen&&<ResourcePanel library={library} prefs={prefs}/>}
  </section>
}

const CSS=`
.dsh-toons{flex-shrink:0;container-type:inline-size;--toon-blue:#4388e4;border:1px solid color-mix(in srgb,currentColor 13%,transparent);border-radius:9px;overflow:hidden;margin:0 0 8px;color:inherit;background:color-mix(in srgb,var(--toon-blue) 3%,transparent);font:12px "Microsoft YaHei",sans-serif}
.dsh-toons *{box-sizing:border-box}
.dsh-toons button,.dsh-toons select{font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:5px;padding:4px 7px;cursor:pointer}
.dsh-toons button:focus-visible,.dsh-toons select:focus-visible{outline:2px solid #4388e4;outline-offset:2px}
.toons-stage{background:#101927;position:relative;overflow:hidden}
.toons-stage canvas{display:block;width:100%;height:auto;image-rendering:pixelated}
.toons-controls{display:grid;grid-template-columns:auto minmax(100px,236px) minmax(0,1fr) auto auto auto auto;grid-template-areas:"mode theme caption tokens status resources toggle";align-items:center;gap:7px;padding:6px 10px;min-height:30px}
.toons-controls.is-compact{grid-template-columns:1fr auto;grid-template-areas:"status toggle"}
.toons-mode{grid-area:mode}
.dsh-toons .toons-theme{grid-area:theme;width:100%;min-width:0;text-overflow:ellipsis}
.toons-caption{grid-area:caption;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;opacity:.65}
.toons-tokens{grid-area:tokens;font-size:10px;white-space:nowrap}
.toons-status{grid-area:status;display:flex;align-items:center;gap:5px;white-space:nowrap;color:inherit;opacity:.66;font-size:11px}
.toons-status i{flex:none;width:5px;height:5px;border-radius:50%;background:#9299a3}
.toons-status.is-active i{background:#4388e4}
.toons-toggle{grid-area:toggle;justify-self:end}
.toons-resource-toggle{grid-area:resources;white-space:nowrap}
.dsh-toons button:disabled,.dsh-toons select:disabled{opacity:.5;cursor:default}
.toons-resources{border-top:1px solid color-mix(in srgb,currentColor 13%,transparent);padding:14px 16px;background:color-mix(in srgb,var(--toon-blue) 2%,transparent)}
.toons-resource-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}
.toons-resource-heading strong{font-size:13px;font-weight:600}
.toons-resource-heading p{margin:4px 0 0;opacity:.6;font-size:11px}
.toons-resource-actions{display:flex;gap:6px;flex-shrink:0}
.dsh-toons .toons-import{background:#315f99;border-color:#315f99;color:#fff}
.toons-resource-selects{display:flex;align-items:flex-end;gap:10px}
.toons-resource-selects label{flex:1;min-width:0;font-size:11px;opacity:.9}
.toons-resource-selects select{display:block;width:100%;margin-top:5px;min-width:0}
.toons-resource-selects>button{flex-shrink:0}
.toons-resource-empty{margin:18px 0;opacity:.6;font-size:11px;line-height:1.7}
.toons-resource-error,.toons-resource-message{margin:12px 0 0;font-size:11px;line-height:1.6}
.toons-resource-error{color:#b94840}
.toons-resource-message{color:#367965}
.toons-resource-list{list-style:none;padding:0;margin:12px 0;max-height:250px;overflow:auto}
.toons-resource-list li{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid color-mix(in srgb,currentColor 10%,transparent)}
.toons-resource-mark{display:grid;place-items:center;flex:none;width:32px;height:32px;border:1px solid color-mix(in srgb,var(--toon-blue) 30%,transparent);color:var(--toon-blue);border-radius:4px;font-size:12px}
.toons-resource-info{flex:1;min-width:0}
.toons-resource-info strong{display:block;font-size:12px;font-weight:500;overflow-wrap:anywhere}
.toons-resource-info span,.toons-resource-info p{display:block;font-size:10px;opacity:.65;margin:3px 0 0;line-height:1.5;overflow-wrap:anywhere}
.toons-resource-list button{flex-shrink:0;white-space:nowrap}
.dsh-toons .toons-resource-delete{border-color:transparent;opacity:.65}
.toons-resource-help{margin-top:12px;font-size:10px;opacity:.65;line-height:1.7}
.toons-resource-help summary{cursor:pointer}
.toons-resource-help p{margin:7px 0}
.toons-resource-help a{color:inherit;text-underline-offset:2px}
@container(max-width:600px){.toons-controls:not(.is-compact){grid-template-columns:auto minmax(0,1fr) auto auto;grid-template-areas:"mode theme theme theme" "status tokens resources toggle"}.toons-caption{display:none}.toons-status{font-size:10px}.toons-resource-heading{align-items:flex-start;flex-direction:column;gap:10px}.toons-resources{padding:12px}.toons-resource-selects{flex-wrap:wrap}.toons-resource-selects label{flex-basis:calc(50% - 5px)}.toons-resource-info p{display:none}}
@media(prefers-reduced-motion:reduce){.toons-stage{scroll-behavior:auto}}
`

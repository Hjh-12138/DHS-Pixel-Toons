import {useCallback,useEffect,useRef,useState} from 'react'
import {DWELL_MS,LIVE_DWELL_MS,isStockDue,type Phase} from '../engine/library'
import {SceneDeck,type SceneSpec} from '../scene'

/** Every automatic replacement shares one clock, measured while the strip plays. */
export class SceneSchedule {
  private scene?:SceneSpec
  private phase?:Phase
  private identity=''
  private elapsed=0
  private lastAt?:number
  private playing=false
  private pending?:{scene:SceneSpec;phase:Phase}
  private advance(now:number){
    if(this.playing&&this.lastAt!==undefined)this.elapsed+=Math.max(0,now-this.lastAt)
    this.lastAt=now
  }
  setPlaying(playing:boolean,now:number):void {this.advance(now);this.playing=playing}
  clearPending():void {this.pending=undefined}
  age(now:number):number {this.advance(now);return this.elapsed}
  private key(scene:SceneSpec):string {return JSON.stringify([scene.stock,scene.preset,scene.raw,scene.direction])}
  /** Manual selections and broken scenes are the only immediate replacements. */
  replace(scene:SceneSpec,phase:Phase,now:number):SceneSpec {
    this.advance(now);this.scene=scene;this.phase=phase;this.identity=this.key(scene);this.elapsed=0;this.pending=undefined
    return scene
  }
  /** Keep only the newest generated scene until the current scene has had its turn. */
  request(scene:SceneSpec,phase:Phase,now:number):SceneSpec|undefined {
    this.advance(now)
    if(this.scene&&this.key(scene)===this.identity)return undefined
    if(!this.scene||this.elapsed>=(this.scene.stock?DWELL_MS:LIVE_DWELL_MS))return this.replace(scene,phase,now)
    this.pending={scene,phase}
    return undefined
  }
  poll(phase:Phase,makeStock:()=>SceneSpec,now:number):SceneSpec|undefined {
    this.advance(now)
    if(!this.playing)return undefined
    if(!this.scene)return this.replace(makeStock(),phase,now)
    const age=this.elapsed
    if(this.pending&&age>=(this.scene.stock?DWELL_MS:LIVE_DWELL_MS))return this.replace(this.pending.scene,this.pending.phase,now)
    if(isStockDue({age,isBroken:false,isLive:!this.scene.stock,isNewPhase:phase!==this.phase}))return this.replace(makeStock(),phase,now)
    return undefined
  }
}

/** Activity changes update poses immediately; scenery uses the independent schedule. */
export function useSceneSchedule(deck:SceneDeck,phase:Phase,what:string,playing:boolean,selectionKey:string){
  const scheduleRef=useRef<SceneSchedule>();if(!scheduleRef.current)scheduleRef.current=new SceneSchedule()
  const schedule=scheduleRef.current,[scene,setScene]=useState<SceneSpec>()
  const latest=useRef({deck,phase,what});latest.current={deck,phase,what}
  const poll=useCallback(()=>{
    const context=latest.current,next=schedule.poll(context.phase,()=>context.deck.next(context.phase,context.what),performance.now())
    if(next)setScene(next)
  },[schedule])
  useEffect(()=>{
    const context=latest.current
    setScene(schedule.replace(context.deck.next(context.phase,context.what),context.phase,performance.now()))
  },[deck,selectionKey,schedule])
  useEffect(()=>{
    schedule.setPlaying(playing,performance.now())
    if(!playing){schedule.clearPending();return}
    poll()
    const timer=setInterval(poll,250)
    return()=>{clearInterval(timer);schedule.setPlaying(false,performance.now())}
  },[playing,poll,schedule])
  useEffect(()=>{if(playing)poll()},[phase,playing,poll])
  const accept=useCallback((candidate:SceneSpec,candidatePhase:Phase)=>{
    const next=schedule.request(candidate,candidatePhase,performance.now());if(next)setScene(next)
  },[schedule])
  const recover=useCallback(()=>{
    const context=latest.current
    setScene(schedule.replace(context.deck.next(context.phase,context.what),context.phase,performance.now()))
  },[schedule])
  return {scene,accept,recover}
}

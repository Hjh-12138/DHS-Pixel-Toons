import type {MascotDraw} from '../engine/script'
import type {Phase} from '../engine/library'

export type Action='idle'|'think'|'read'|'type'|'search'|'check'|'success'|'failed'|'walk-left'|'walk-right'
export type Clip={durations:readonly number[];loop:boolean}
export const FRAMES_PER_ACTION=8
export const ATLAS_COLUMNS=4
export const CLIPS:Record<Action,Clip>={
  idle:{durations:[1500,200,190,60,60,120,190,260],loop:true},
  think:{durations:[325,325,175,175,250,250,175,175],loop:true},
  read:{durations:[1200,200,100,100,100,100,175,175],loop:true},
  type:{durations:[50,50,50,50,50,50,50,50],loop:true},
  search:{durations:[150,150,150,150,150,150,150,150],loop:true},
  check:{durations:[325,325,125,125,175,175,175,175],loop:true},
  success:{durations:[110,110,90,90,170,170,325,325],loop:false},
  failed:{durations:[175,175,175,175,225,225,300,300],loop:false},
  'walk-left':{durations:[75,75,75,75,75,75,75,75],loop:true},
  'walk-right':{durations:[75,75,75,75,75,75,75,75],loop:true},
}
export const OUTCOME_SECONDS=1.8
/** Activity controls work poses; scene movement and gestures still apply. */
export function actionFor(m:MascotDraw,phase:Phase,outcome:string):Action {
  if(outcome==='failed')return 'failed'
  if(outcome==='success')return 'success'
  if(phase==='reading')return 'read'
  if(phase==='editing'||phase==='writing')return 'type'
  if(m.look.pose==='walk')return m.look.facing<0?'walk-left':'walk-right'
  if(m.look.pose==='jump'||m.look.isCheering)return 'success'
  if(phase==='searching'||phase==='web'||phase==='agents')return 'search'
  if(phase==='testing'||phase==='building'||phase==='git')return 'check'
  return phase==='thinking'?'think':'idle'
}
/** Playback uses elapsed time, independent of display FPS; ending poses hold. */
export function frameAt(action:Action,seconds:number):number {
  const clip=CLIPS[action],total=clip.durations.reduce((a,b)=>a+b,0)
  let time=Math.max(0,Number.isFinite(seconds)?seconds*1000:0)
  if(clip.loop)time%=total
  for(const [i,duration] of clip.durations.entries()){if(time<duration)return i;time-=duration}
  return clip.durations.length-1
}
export type MotionClock={time:number;outcomeAge:number;playing:boolean;working?:boolean}
/** Local idle playback continues without resuming the worker or model director. */
export function advanceMotion(clock:MotionClock,delta:number,working:boolean,visible:boolean,reducedMotion:boolean,outcome:string):MotionClock {
  const playing=visible&&!reducedMotion
  const elapsed=playing?Math.max(0,Math.min(.25,delta)):0
  return {time:clock.time+elapsed,outcomeAge:outcome==='success'||outcome==='failed'?clock.outcomeAge+elapsed:0,playing,working}
}

/** End reactions are brief; an inactive task always settles into an idle loop. */
export function playbackAction(m:MascotDraw,phase:Phase,outcome:string,clock?:MotionClock):Action {
  if(!clock)return actionFor(m,phase,outcome)
  const reacting=(outcome==='success'||outcome==='failed')&&clock.outcomeAge<OUTCOME_SECONDS
  if(reacting)return outcome as 'success'|'failed'
  if(clock.working===false)return 'idle'
  return actionFor(m,phase,'none')
}

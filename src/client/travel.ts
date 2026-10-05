import type {Phase} from '../engine/library'

export type TravelPose={x:number;walking:boolean;facing:-1|1;seconds:number}
type TravelInput={delta:number;playing:boolean;working:boolean;phase:Phase;reacting:boolean;width:number;height:number;home:number;canWalk:boolean;direction?:-1|1}
const STOPS=[.23,.77,.34,.84,.16,.65] as const
const isDesk=(phase:Phase)=>phase==='reading'||phase==='editing'||phase==='writing'

/** A local route survives tool events and scene rotations, so movement never teleports. */
export class CharacterTravel {
  private pose:TravelPose={x:.52,walking:false,facing:1,seconds:0}
  private target=.52
  private rest=2.8
  private step=0
  private excursion=false
  private returning=false
  private direction?:-1|1
  private desk=false
  private started=false
  private working?:boolean
  snapshot():TravelPose {return {...this.pose}}
  advance(input:TravelInput):TravelPose {
    const {playing,reacting,canWalk,width,height,working,phase,direction}=input
    if(!playing)return this.snapshot()
    if(!working&&this.working!==false){this.excursion=false;this.returning=false;this.rest=1.2}
    this.working=working
    if(reacting){this.pose.walking=false;return this.snapshot()}
    if(!canWalk){this.pose.x=input.home;this.target=input.home;this.pose.walking=false;this.started=false;return this.snapshot()}
    const dt=Math.max(0,Math.min(.25,Number.isFinite(input.delta)?input.delta:0))
    const margin=Math.min(.43,Math.max(.12,(height*.65+8)/Math.max(1,width)))
    const bounded=(x:number)=>Math.max(margin,Math.min(1-margin,x))
    const home=bounded(input.home),desk=working&&isDesk(phase)
    this.pose.x=bounded(this.pose.x)
    this.target=bounded(this.target)
    const aim=(x:number)=>{this.target=bounded(x);this.pose.walking=Math.abs(this.target-this.pose.x)>.001;if(this.pose.walking)this.pose.facing=this.target<this.pose.x?-1:1}
    if(!this.started){this.rest=desk?22:working?2.8:1.2;this.started=true}
    if(!desk&&this.desk&&!direction&&!this.pose.walking)this.rest=Math.min(this.rest,2.8)
    if(desk&&!direction&&this.pose.walking&&Math.abs(this.target-home)>.001)this.excursion=true
    if(desk&&!this.desk&&!direction&&!this.excursion)aim(home)
    this.desk=desk
    if(direction!==this.direction){
      this.direction=direction;this.excursion=false;this.returning=false
      if(direction)aim(direction<0?margin:1-margin)
      else if(desk)aim(home)
      else {this.pose.walking=false;this.rest=working?2.8:1.2}
    }
    if(!direction&&desk&&!this.excursion&&Math.abs(this.pose.x-home)>.001)aim(home)
    // Brief desk excursions finish even when tools rapidly change the activity.
    if(!this.pose.walking){
      this.rest-=dt
      if(!direction&&this.rest<=0){
        if(this.excursion){this.returning=true;aim(home)}
        else {this.excursion=desk;aim(STOPS[this.step++%STOPS.length]!)}
      }
    }
    if(this.pose.walking){
      this.pose.seconds+=dt
      const distance=height*.5/Math.max(1,width)*dt,difference=this.target-this.pose.x
      this.pose.x+=Math.sign(difference)*Math.min(Math.abs(difference),distance)
      if(Math.abs(this.target-this.pose.x)<.00001){
        this.pose.x=this.target;this.pose.walking=false
        if(this.returning){this.returning=false;this.excursion=false}
        this.rest=this.excursion?1.5:desk?22:working?6+this.step%3:1.2+this.step%3*.6
      }
    }
    return this.snapshot()
  }
}

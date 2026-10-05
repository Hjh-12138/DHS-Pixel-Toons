import type { MascotDraw } from '../engine/script'
import type { Phase } from '../engine/library'
import {cellWidth} from '../engine/text'
import {playbackAction,frameAt,type MotionClock} from './animation'
import type {PixelPreset} from '../presets'
import {paintPixelScene} from './pixel-scenes'
import {packFrameAt,resolvePackClip,type PackResources,type LoadedScene} from './resource-pack'
import {pixelLayout} from './pixel-layout'
import type {TravelPose} from './travel'

/** Use the same fitting rule for both layers so foreground occlusion stays aligned. */
function paintPackLayer(g:CanvasRenderingContext2D,scene:LoadedScene,image:HTMLImageElement):void{
  const W=g.canvas.width,H=g.canvas.height
  if(scene.spec.fit==='stretch'){g.drawImage(image,0,0,W,H);return}
  const ratio=scene.spec.fit==='contain'?Math.min(W/image.width,H/image.height):Math.max(W/image.width,H/image.height)
  const w=Math.round(image.width*ratio),h=Math.round(image.height*ratio)
  g.drawImage(image,Math.round((W-w)/2),Math.round((H-h)/2),w,h)
}

export type Pose='idle'|'think'|'read'|'type'|'walk-left-0'|'walk-left-1'|'walk-right-0'|'walk-right-1'|'search'|'check'|'success'|'failed'
export const POSES:Pose[]=['idle','think','read','type','walk-left-0','walk-left-1','walk-right-0','walk-right-1','search','check','success','failed']
export type Crop={x:number;y:number;w:number;h:number}
export type RegisteredFrame={crop:Crop;anchorX:number;anchorY:number}
export type AnimationSheet={image:HTMLImageElement;frames:RegisteredFrame[];referenceHeight:number}
export type AnimationSprites={active:AnimationSheet;work:AnimationSheet;walking?:AnimationSheet}
/** Read each atlas cell's alpha bounds; source pixels stay unchanged. */
export function atlasBounds(image:HTMLImageElement):Crop[] {
  const c=document.createElement('canvas');c.width=image.width;c.height=image.height
  const g=c.getContext('2d');if(!g)throw new Error('Canvas is unavailable');g.drawImage(image,0,0)
  const pixels=g.getImageData(0,0,c.width,c.height).data
  return atlasBoundsFromPixels(pixels,c.width,c.height)
}
/** Generated atlases have slightly uneven gutters; find them before cropping. */
function atlasGrid(pixels:Uint8ClampedArray,width:number,height:number,columns=4,rowCount=3){
  const columnsInk=new Uint32Array(width),rows=new Uint32Array(height)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]!>80){columnsInk[x]++;rows[y]++}
  const seam=(counts:Uint32Array,expected:number,radius:number)=>{
    let best=Math.round(expected),score=Infinity,distance=Infinity
    for(let i=Math.max(1,Math.floor(expected-radius));i<=Math.min(counts.length-1,Math.ceil(expected+radius));i++){
      const d=Math.abs(i-expected);if(counts[i]!<score||counts[i]===score&&d<distance){best=i;score=counts[i]!;distance=d}
    }
    return best
  }
  const xs=[0,...Array.from({length:columns-1},(_,i)=>seam(columnsInk,width*(i+1)/columns,width*.03)),width],ys=[0,...Array.from({length:rowCount-1},(_,i)=>seam(rows,height*(i+1)/rowCount,height*.04)),height]
  const bounds=Array.from({length:columns*rowCount},(_,i)=>{
    const x0=xs[i%columns]!,x1=xs[i%columns+1]!,y0=ys[Math.floor(i/columns)]!,y1=ys[Math.floor(i/columns)+1]!
    let left=x1,top=y1,right=x0,bottom=y0
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pixels[(y*width+x)*4+3]!>80){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
    if(right<=left||bottom<=top)throw new Error(`Empty atlas cell ${i}`)
    return {x:left,y:top,w:right-left+1,h:bottom-top+1}
  })
  return {bounds,xs,ys}
}
export function atlasBoundsFromPixels(pixels:Uint8ClampedArray,width:number,height:number):Crop[]{return atlasGrid(pixels,width,height).bounds}
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return (sorted[Math.floor((sorted.length-1)/2)]!+sorted[Math.floor(sorted.length/2)]!)/2}
/** Shared row baselines keep a moving hand/page from shifting the whole sprite. */
export function animationBoundsFromPixels(pixels:Uint8ClampedArray,width:number,height:number,standingRows:readonly number[],rowCount=4):Omit<AnimationSheet,'image'>{
  const {bounds,xs,ys}=atlasGrid(pixels,width,height,4,rowCount)
  const baselines=Array.from({length:rowCount},(_,row)=>median(bounds.slice(row*4,row*4+4).map(c=>c.y+c.h-ys[row]!)))
  const frames=bounds.map((crop,i)=>({crop,anchorX:(xs[i%4]!+xs[i%4+1]!)/2-crop.x,anchorY:ys[Math.floor(i/4)]!+baselines[Math.floor(i/4)]!-crop.y}))
  const referenceHeight=median(standingRows.flatMap(row=>bounds.slice(row*4,row*4+4).map(c=>c.h)))
  return {frames,referenceHeight}
}
export function animationSheet(image:HTMLImageElement,standingRows:readonly number[],rowCount=4):AnimationSheet {
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height
  const g=canvas.getContext('2d');if(!g)throw new Error('Canvas is unavailable');g.drawImage(image,0,0)
  return {image,...animationBoundsFromPixels(g.getImageData(0,0,image.width,image.height).data,image.width,image.height,standingRows,rowCount)}
}
/** One fixed pose is chosen from activity and upstream compatibility options. */
export function poseFor(m:MascotDraw,phase:Phase,t:number,outcome:string):Pose {
  if(outcome==='failed')return 'failed'
  if(outcome==='success')return 'success'
  if(phase==='reading')return 'read'
  if(phase==='editing'||phase==='writing')return 'type'
  if(m.look.pose==='walk'){const side=m.look.facing<0?'left':'right';return `walk-${side}-${Math.floor(t*6)%2}` as Pose}
  if(m.look.isCheering)return 'success'
  if(phase==='searching'||phase==='web')return 'search'
  if(phase==='testing'||phase==='building')return 'check'
  return phase==='thinking'?'think':'idle'
}
/** Paint the engine grid and fixed portrait sprites using nearest-neighbor scaling. */
export function paint(g:CanvasRenderingContext2D,frame:{cells:Uint32Array;cols:number;rows:number;mascots:MascotDraw[];t:number;preset?:PixelPreset},image:HTMLImageElement,crops:Crop[],phase:Phase,outcome:string,animations?:AnimationSprites,clock?:MotionClock,resources?:PackResources,travel?:TravelPose):void {
  if((!frame.preset&&!resources?.scene&&clock?.working!==false)||(resources?.character&&!resources.character.spec.actions['walk-left']&&!resources.character.spec.actions['walk-right']))travel=undefined
  const cw=g.canvas.width/frame.cols,ch=g.canvas.height/frame.rows,clear=0x01000000
  g.clearRect(0,0,g.canvas.width,g.canvas.height);g.imageSmoothingEnabled=false
  const color=(v:number)=>`#${(v&0xffffff).toString(16).padStart(6,'0')}`
  g.font=`${ch}px "Cascadia Mono",Consolas,"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",monospace`;g.textBaseline='top'
  const mascots=frame.mascots.length?frame.mascots:[{x:frame.cols/2-7,py:frame.rows*2-10,look:{pose:'stand',stride:-1,facing:0,scale:1,arms:{left:'down',right:'down'}}} as MascotDraw]
  const time=clock?.time??frame.t
  const actionForSprite=(m:MascotDraw)=>{
    const action=playbackAction(m,phase,outcome,clock)
    return travel?.walking&&m===mascots[0]&&action!=='success'&&action!=='failed'?(travel.facing<0?'walk-left':'walk-right'):action
  }
  const requested=playbackAction(mascots[0]!,phase,outcome,clock),localCharacter=resources?.character,localScene=resources?.scene
  const localClip=localCharacter?resolvePackClip(localCharacter.spec,requested).clip:undefined
  const layoutAction=localClip?(localClip.stance==='prone'?(requested==='type'?'type':'read'):(requested==='read'||requested==='type'?'idle':requested)):requested
  let layout=localScene?{...pixelLayout(g.canvas.width,g.canvas.height,layoutAction),centerX:g.canvas.width*localScene.spec.centerX,footY:g.canvas.height*localScene.spec.footY}:frame.preset?paintPixelScene(g,frame.preset,time,layoutAction):undefined
  if(localScene){g.fillStyle=localScene.spec.color;g.fillRect(0,0,g.canvas.width,g.canvas.height);paintPackLayer(g,localScene,localScene.background)}
  if(layout&&travel)layout={...layout,centerX:travel.x*g.canvas.width,footY:travel.walking&&!localScene?g.canvas.height-8:layout.footY}
  if(g.canvas.dataset){
    if(localScene){g.canvas.dataset.theme=`local:${localScene.id}`;delete g.canvas.dataset.mood}
    if(localCharacter)g.canvas.dataset.characterPack=localCharacter.id;else {delete g.canvas.dataset.characterPack;delete g.canvas.dataset.clip}
    if(localScene)g.canvas.dataset.scenePack=localScene.id;else delete g.canvas.dataset.scenePack
  }
  if(!layout&&g.canvas.dataset){delete g.canvas.dataset.theme;delete g.canvas.dataset.mood}
  // Live director scenes retain the interpreter; presets use the finer pixel canvas.
  // Paint all backgrounds first so a wide glyph's second cell cannot cover it.
  if(!layout)for(let row=0;row<frame.rows;row++)for(let col=0;col<frame.cols;col++){
    const bg=frame.cells[(row*frame.cols+col)*3+2]!
    if(bg!==clear){g.fillStyle=color(bg);g.fillRect(col*cw,row*ch,cw,ch)}
  }
  if(!layout)for(let row=0;row<frame.rows;row++)for(let col=0;col<frame.cols;col++){
    const at=(row*frame.cols+col)*3,code=frame.cells[at]!,fg=frame.cells[at+1]!,bg=frame.cells[at+2]!,x=col*cw,y=row*ch
    if(fg===clear||!code||code===32)continue
    g.fillStyle=color(fg)
    if(code===0x2580)g.fillRect(x,y,cw,ch/2)
    else if(code===0x2584)g.fillRect(x,y+ch/2,cw,ch/2)
    else if(code===0x2588)g.fillRect(x,y,cw,ch)
    else {const char=String.fromCodePoint(code);g.fillText(char,x,y,cw*cellWidth(char))}
  }
  // An idle mascot can roam across a frozen live scene without rerunning its script.
  const actorCenter=travel?travel.x*g.canvas.width:undefined
  for(const m of mascots){
    if(localCharacter){
      const action=actionForSprite(m),resolved=resolvePackClip(localCharacter.spec,action),clip=resolved.clip,f=packFrameAt(clip,travel?.walking?travel.seconds:time)
      const scale=Math.max(.3,Math.min(2,m.look.scale))*(localScene?.spec.scale??1)
      // Fit the whole clip at one pixel scale; moving hands cannot resize the body.
      const unit=Math.min(g.canvas.height*.72*scale/localCharacter.spec.referenceHeight,g.canvas.width/Math.max(...clip.frames.map(f=>f.w)),g.canvas.height/Math.max(...clip.frames.map(f=>f.h)))
      const width=f.w*unit,height=f.h*unit,anchorX=(resolved.mirror?f.w-f.anchorX:f.anchorX)*unit
      const foot=layout?.footY??Math.min(g.canvas.height-2,Math.max(height,(m.py+8*scale)*ch/2)),center=layout?.centerX??actorCenter??(m.x+7*scale)*cw
      const x=Math.max(0,Math.min(g.canvas.width-width,center-anchorX)),y=Math.max(0,Math.min(g.canvas.height-height,foot-f.anchorY*unit))
      if(resolved.mirror){g.save();g.translate(Math.round(x+width),Math.round(y));g.scale(-1,1);g.drawImage(localCharacter.images[f.atlas]!,f.x,f.y,f.w,f.h,0,0,Math.round(width),Math.round(height));g.restore()}
      else g.drawImage(localCharacter.images[f.atlas]!,f.x,f.y,f.w,f.h,Math.round(x),Math.round(y),Math.round(width),Math.round(height))
      if(m===mascots[0]&&g.canvas.dataset){g.canvas.dataset.action=action;g.canvas.dataset.clip=resolved.action;g.canvas.dataset.frame=String(clip.frames.indexOf(f));g.canvas.dataset.motionTime=String(time);g.canvas.dataset.sceneTime=String(frame.t);g.canvas.dataset.playing=String(clock?.playing??true);g.canvas.dataset.characterX=String(Math.round(x));g.canvas.dataset.characterY=String(Math.round(y));g.canvas.dataset.walking=String(travel?.walking??false)}
      continue
    }
    if(animations){
      const action=actionForSprite(m)
      const walking=action==='walk-left'||action==='walk-right'
      const index=frameAt(action,walking&&travel?travel.seconds:action==='success'&&outcome!=='success'?time%1.39:time)
      const row={idle:0,think:1,search:2,check:3,read:0,type:1,success:2,failed:3}[action as Exclude<typeof action,'walk-left'|'walk-right'>]
      const sheet=walking&&animations.walking?animations.walking:action==='read'||action==='type'||action==='success'||action==='failed'?animations.work:animations.active
      const registered=walking?(animations.walking?sheet.frames[(action==='walk-left'?0:4)+index]:undefined):sheet.frames[row*4+index]!
      const crop=registered?.crop??crops[(action==='walk-left'?4:6)+index%2]!
      if(m===mascots[0]&&g.canvas.dataset){g.canvas.dataset.action=action;g.canvas.dataset.frame=String(index);g.canvas.dataset.motionTime=String(time);g.canvas.dataset.sceneTime=String(frame.t);g.canvas.dataset.playing=String(clock?.playing??true);g.canvas.dataset.walking=String(travel?.walking??false)}
      const scale=Math.max(.3,Math.min(2,m.look.scale)),unit=Math.min(g.canvas.height*.72,12*scale*ch/2)*(localScene?.spec.scale??1)/(walking&&!registered?crops[0]!.h:sheet.referenceHeight)
      const width=unit*crop.w,height=unit*crop.h,anchorX=registered?.anchorX??crop.w/2,anchorY=registered?.anchorY??crop.h
      const foot=layout?.footY??Math.min(g.canvas.height-2,Math.max(height,(m.py+8*scale)*ch/2))
      const x=Math.max(0,Math.min(g.canvas.width-width,(layout?.centerX??actorCenter??(m.x+7*scale)*cw)-anchorX*unit))
      const hop=action==='success'?-Math.sin(Math.PI*Math.max(0,Math.min(1,(time-.2)/.75)))*8*scale:walking?Math.sin((travel?.seconds??time)*20)*.7:action==='idle'?Math.sin(time*2)*1:0
      const y=Math.max(0,Math.min(g.canvas.height-height,foot-anchorY*unit+hop))
      g.drawImage(walking&&!registered?image:sheet.image,crop.x,crop.y,crop.w,crop.h,Math.round(x),Math.round(y),Math.round(width),Math.round(height))
      if(m===mascots[0]&&g.canvas.dataset){g.canvas.dataset.characterX=String(Math.round(x));g.canvas.dataset.characterY=String(Math.round(y))}
      continue
    }
    const pose=poseFor(m,phase,frame.t,outcome),crop=crops[POSES.indexOf(pose)]!
    // All poses share the standing sprite's pixel scale, so prone poses stay shorter.
    const scale=Math.max(.3,Math.min(2,m.look.scale)),unit=Math.min(g.canvas.height*.72,12*scale*ch/2)/crops[0]!.h,height=unit*crop.h,width=unit*crop.w
    const foot=Math.min(g.canvas.height-2,Math.max(height,(m.py+8*scale)*ch/2))
    const x=Math.max(0,Math.min(g.canvas.width-width,(m.x+7*scale)*cw-width/2))
    const bob=pose.startsWith('walk')?Math.round(Math.sin(frame.t*12)*1.5):Math.round(Math.sin(frame.t*3))
    g.drawImage(image,crop.x,crop.y,crop.w,crop.h,Math.round(x),Math.round(foot-height+bob),Math.round(width),Math.round(height))
  }
  if(localScene?.foreground)paintPackLayer(g,localScene,localScene.foreground)
}

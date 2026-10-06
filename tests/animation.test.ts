import {test} from 'node:test'
import assert from 'node:assert/strict'
import {actionFor,playbackAction,advanceMotion,frameAt,OUTCOME_SECONDS,CLIPS,type Action,type MotionClock} from '../src/client/animation'
import {actionSheets,animationBoundsFromPixels,paint,type AnimationSprites} from '../src/client/sprite'
import {animationFixture} from './helpers/animation-fixture'
import type {MascotDraw} from '../src/engine/script'
import {cleanScript,stage} from '../src/engine/script'
const standing={x:10,py:4,look:{pose:'stand',stride:-1,facing:0,scale:1,arms:{left:'down',right:'down'}}} as MascotDraw
test('activity and scene gestures choose multi-frame work actions',()=>{
 const walk={...standing,look:{...standing.look,pose:'walk',stride:0,facing:-1}} as MascotDraw
 assert.equal(actionFor(walk,'reading','none'),'read');assert.equal(actionFor(walk,'editing','none'),'type')
 assert.equal(actionFor(standing,'searching','none'),'search');assert.equal(actionFor(standing,'testing','none'),'check')
 assert.equal(actionFor(standing,'agents','none'),'search');assert.equal(actionFor(standing,'git','none'),'check')
 assert.equal(actionFor(walk,'running','none'),'walk-left')
 assert.equal(actionFor(walk,'reading','success'),'success');assert.equal(actionFor(walk,'writing','failed'),'failed')
 for(const action of Object.keys(CLIPS) as (keyof typeof CLIPS)[]){
  let t=0;const seen=new Set<number>()
  for(const duration of CLIPS[action].durations){seen.add(frameAt(action,t+.001));t+=duration/1000}
  assert.deepEqual([...seen],[0,1,2,3,4,5,6,7],action)
  assert.equal(frameAt(action,t+.001),CLIPS[action].loop?0:7,`${action} loops or holds its last frame`)
 }
 assert.equal(frameAt('success',10),7);assert.equal(frameAt('read',-1),0)
})
test('eight-frame cycles retain their original playback speed',()=>{
 const totals={idle:2580,think:1850,read:2150,type:400,search:1200,check:1600,success:1390,failed:1750,'walk-left':600,'walk-right':600}
 for(const action of Object.keys(totals) as (keyof typeof totals)[])assert.equal(CLIPS[action].durations.reduce((a,b)=>a+b,0),totals[action],action)
})
test('completed tasks celebrate then keep looping idle frames without a running worker',()=>{
 const start:MotionClock={time:0,outcomeAge:0,playing:false}
 let clock=advanceMotion(start,.05,false,true,false,'success');assert.ok(clock.playing);assert.equal(clock.time,.05)
 for(let i=0;i<40;i++)clock=advanceMotion(clock,.05,false,true,false,'success')
 assert.ok(clock.outcomeAge>=OUTCOME_SECONDS);assert.equal(clock.playing,true)
 assert.equal(playbackAction(standing,'editing','success',clock),'idle')
 const seen=new Set<number>();for(let i=0;i<60;i++){clock=advanceMotion(clock,.05,false,true,false,'success');seen.add(frameAt(playbackAction(standing,'reading','success',clock),clock.time))}
 assert.equal(seen.size,8)
 for(const [active,visible,reduced] of [[true,false,false],[false,false,false],[true,true,true],[false,true,true]]){
  const frozen=advanceMotion(start,.05,active!,visible!,reduced!,'none');assert.equal(frozen.time,0);assert.equal(frozen.playing,false)
 }
})
test('initial idle, canceled and failed tasks settle into idle; a new task resumes its work pose',()=>{
 const start:MotionClock={time:0,outcomeAge:0,playing:false}
 for(const outcome of ['none','canceled','failed']){
  let clock=advanceMotion(start,.05,false,true,false,outcome)
  assert.equal(playbackAction(standing,'reading',outcome,clock),outcome==='failed'?'failed':'idle')
  for(let i=0;i<40;i++)clock=advanceMotion(clock,.05,false,true,false,outcome)
  assert.equal(playbackAction(standing,'reading',outcome,clock),'idle');assert.ok(clock.playing)
 }
 const next=advanceMotion(start,.05,true,true,false,'none')
 assert.equal(playbackAction(standing,'reading','none',next),'read')
})
test('normalized standing stride zero and default raised claws never override work actions',()=>{
 const base={actors:[],particles:[],background:{effect:'waves',palette:['#113','#448','#99f'],speed:.4,intensity:0}}
 for(const [code,expected] of [['clawd(10,4)','search'],['clawd(10,4,{arms:"up"})','success']] as const){
  const script=cleanScript({...base,code:`function frame(){${code};}`});assert.ok(script)
  const figures:MascotDraw[]=[];stage({script,cols:90,rows:14,t:0,since:0,reveal:1,onMascot:m=>figures.push(m)})
  assert.equal(figures[0]!.look.pose,'stand');assert.equal(figures[0]!.look.stride,0)
  assert.equal(actionFor(figures[0]!,'searching','none'),expected)
 }
})
test('registered atlas frames share a root baseline despite differently moving hands',()=>{
 const width=80,height=200,pixels=new Uint8ClampedArray(width*height*4)
 for(let row=0;row<8;row++)for(let col=0;col<4;col++)for(let y=row*25+5;y<row*25+22;y++)for(let x=col*20+5;x<col*20+15;x++)pixels[(y*width+x)*4+3]=255
 // A raised hand changes the crop, while the root stays at the same location.
 for(let y=1;y<5;y++)pixels[(y*width+25)*4+3]=255
 const sheet=animationBoundsFromPixels(pixels,width,height,[0,1,2,3,4,5,6,7],8)
 assert.equal(sheet.frames.length,32)
 const roots=sheet.frames.slice(0,8).map((f,i)=>f.crop.y+f.anchorY-Math.floor(i/4)*25);assert.ok(roots.every(y=>y===roots[0]))
 assert.equal(sheet.frames[0]!.anchorX+sheet.frames[0]!.crop.x+20,sheet.frames[1]!.anchorX+sheet.frames[1]!.crop.x)
})
test('renderer switches real source frames, keeping prone actions at a stable root',()=>{
 const draws:number[][]=[]
 const g={canvas:{width:720,height:196},clearRect(){},fillRect(){},fillText(){},drawImage(...args:unknown[]){draws.push(args.slice(1) as number[])}} as unknown as CanvasRenderingContext2D
 const frames=Array.from({length:32},(_,i)=>({crop:{x:i*100,y:0,w:80,h:i<16?50:100},anchorX:40,anchorY:i<16?50:100}))
 const sheet={image:{} as HTMLImageElement,frames,referenceHeight:100},sprites:AnimationSprites=animationFixture(sheet,{type:{...sheet,frames:frames.slice(8,16)}})
 const cells=new Uint32Array(90*14*3);for(let i=0;i<90*14;i++){cells[i*3+1]=0x01000000;cells[i*3+2]=0x01000000}
 const frame={cells,cols:90,rows:14,t:0,mascots:[standing]}
 const crops=Array(12).fill({x:0,y:0,w:80,h:100})
 for(const time of [0,.051,.101,.151,.201,.251,.301,.351])paint(g,frame,sheet.image,crops,'editing','none',sprites,{time,outcomeAge:time,playing:true})
 assert.deepEqual(draws.map(d=>d[0]),[800,900,1000,1100,1200,1300,1400,1500])
 assert.ok(draws.every(d=>d[4]===draws[0]![4]&&d[5]===draws[0]![5]))
})
test('opposite tail directions use row gutters and each actual foot stays on the ground',()=>{
 const width=160,height=100,pixels=new Uint8ClampedArray(width*height*4)
 const ink=(left:number,top:number,right:number,bottom:number)=>{for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)pixels[(y*width+x)*4+3]=255}
 for(let row=0;row<4;row++)for(let col=0;col<4;col++){
  const x=col*40,y=row*25,bottom=row%2?20:22
  ink(x+14,y+3,x+29,y+bottom)
  // Left-facing rows extend their tails right, right-facing rows extend left.
  if(row%2===0)ink(x+29,y+12,Math.min(width,x+44),y+17)
  else ink(Math.max(0,x-2),y+12,x+14,y+17)
 }
 const sheet=animationBoundsFromPixels(pixels,width,height,[0,1,2,3],4)
 assert.equal(sheet.frames[0]!.crop.x+sheet.frames[0]!.crop.w,44,'the first tail must not be cut by another row’s gutter')
 assert.equal(sheet.frames[5]!.crop.x,38,'the opposite-facing tail must not be split into the previous cell')
 for(const frame of sheet.frames)assert.equal(frame.anchorY,frame.crop.h,'a shared average must not leave a gap below a planted foot')
})

test('action sheet registration preserves prone pixel scale and shares mirrored walking frames',()=>{
 type Atlas=HTMLImageElement&{pixels:Uint8ClampedArray}
 const atlas=(height:number,bodyHeight:number):Atlas=>{
  const width=80,pixels=new Uint8ClampedArray(width*height*4),rowHeight=height/2
  for(let row=0;row<2;row++)for(let col=0;col<4;col++)for(let y=row*rowHeight+5;y<row*rowHeight+5+bodyHeight;y++)for(let x=col*20+5;x<col*20+15;x++)pixels[(y*width+x)*4+3]=255
  return {width,height,pixels} as Atlas
 }
 const images=Object.fromEntries((Object.keys(CLIPS) as Action[]).map(action=>[action,atlas(100,40)])) as Record<Action,Atlas>
 images.read=atlas(150,20);images.type=atlas(150,20)
 images['walk-left']=atlas(100,35);images['walk-right']=images['walk-left']
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document')
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(){
  let image:Atlas
  return {getContext(){return {drawImage(source:Atlas){image=source},getImageData(){return {data:image.pixels}}}}}
 }}})
 try{
  const sprites=actionSheets(images)
  assert.deepEqual(Object.keys(sprites).sort(),Object.keys(CLIPS).sort())
  assert.equal(sprites.idle.referenceHeight,40)
  assert.equal(sprites.read.referenceHeight,60);assert.equal(sprites.type.referenceHeight,60)
  assert.equal(sprites.read.frames[0]!.crop.h,20,'prone height is not stretched to standing height')
  assert.equal(sprites['walk-left'].referenceHeight,35)
  assert.equal(sprites['walk-right'].image,sprites['walk-left'].image)
  assert.ok(sprites['walk-right'].frames.every(frame=>frame.mirror===true))
  assert.ok(sprites['walk-left'].frames.every(frame=>!frame.mirror))
  assert.ok(sprites.success.frames.slice(0,7).every(frame=>!frame.mirror))
  assert.equal(sprites.success.frames[7]!.mirror,true)
  for(const sheet of Object.values(sprites))for(const frame of sheet.frames)assert.equal(frame.anchorY,frame.crop.h)
 }finally{
  if(previous)Object.defineProperty(globalThis,'document',previous)
  else Reflect.deleteProperty(globalThis,'document')
 }
})

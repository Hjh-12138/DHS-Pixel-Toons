import {test} from 'node:test'
import assert from 'node:assert/strict'
import {actionFor,playbackAction,advanceMotion,frameAt,OUTCOME_SECONDS,CLIPS,type MotionClock} from '../src/client/animation'
import {animationBoundsFromPixels,paint,type AnimationSprites} from '../src/client/sprite'
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
 for(const action of ['read','type','think','search','check'] as const){let t=0;const seen=new Set<number>();for(const duration of CLIPS[action].durations){seen.add(frameAt(action,t+.01));t+=duration/1000}assert.equal(seen.size,4)}
 assert.equal(frameAt('success',10),3);assert.equal(frameAt('read',-1),0)
})
test('completed tasks celebrate then keep looping idle frames without a running worker',()=>{
 const start:MotionClock={time:0,outcomeAge:0,playing:false}
 let clock=advanceMotion(start,.05,false,true,false,'success');assert.ok(clock.playing);assert.equal(clock.time,.05)
 for(let i=0;i<40;i++)clock=advanceMotion(clock,.05,false,true,false,'success')
 assert.ok(clock.outcomeAge>=OUTCOME_SECONDS);assert.equal(clock.playing,true)
 assert.equal(playbackAction(standing,'editing','success',clock),'idle')
 const seen=new Set<number>();for(let i=0;i<60;i++){clock=advanceMotion(clock,.05,false,true,false,'success');seen.add(frameAt(playbackAction(standing,'reading','success',clock),clock.time))}
 assert.equal(seen.size,4)
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
 const width=80,height=100,pixels=new Uint8ClampedArray(width*height*4)
 for(let row=0;row<4;row++)for(let col=0;col<4;col++)for(let y=row*25+5;y<row*25+22;y++)for(let x=col*20+5;x<col*20+15;x++)pixels[(y*width+x)*4+3]=255
 // A raised hand changes the crop, while the root stays at the same location.
 for(let y=1;y<5;y++)pixels[(y*width+25)*4+3]=255
 const sheet=animationBoundsFromPixels(pixels,width,height,[0,1,2,3])
 assert.equal(sheet.frames.length,16)
 const roots=sheet.frames.slice(0,4).map(f=>f.crop.y+f.anchorY);assert.ok(roots.every(y=>y===roots[0]))
 assert.equal(sheet.frames[0]!.anchorX+sheet.frames[0]!.crop.x+20,sheet.frames[1]!.anchorX+sheet.frames[1]!.crop.x)
})
test('renderer switches real source frames, keeping prone actions at a stable root',()=>{
 const draws:number[][]=[]
 const g={canvas:{width:720,height:196},clearRect(){},fillRect(){},fillText(){},drawImage(...args:unknown[]){draws.push(args.slice(1) as number[])}} as unknown as CanvasRenderingContext2D
 const frames=Array.from({length:16},(_,i)=>({crop:{x:i*100,y:0,w:80,h:i<8?50:100},anchorX:40,anchorY:i<8?50:100}))
 const sheet={image:{} as HTMLImageElement,frames,referenceHeight:100},sprites:AnimationSprites={active:sheet,work:sheet}
 const cells=new Uint32Array(90*14*3);for(let i=0;i<90*14;i++){cells[i*3+1]=0x01000000;cells[i*3+2]=0x01000000}
 const frame={cells,cols:90,rows:14,t:0,mascots:[standing]}
 const crops=Array(12).fill({x:0,y:0,w:80,h:100})
 for(const time of [0,.1,.2,.3])paint(g,frame,sheet.image,crops,'editing','none',sprites,{time,outcomeAge:time,playing:true})
 assert.deepEqual(draws.map(d=>d[0]),[400,500,600,700])
 assert.ok(draws.every(d=>d[4]===draws[0]![4]&&d[5]===draws[0]![5]))
})

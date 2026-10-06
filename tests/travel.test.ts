import {test} from 'node:test'
import assert from 'node:assert/strict'
import {CharacterTravel} from '../src/client/travel'
import {animationBoundsFromPixels,paint,type AnimationSprites} from '../src/client/sprite'
import {frameAt} from '../src/client/animation'
import {animationFixture} from './helpers/animation-fixture'
import type {MascotDraw} from '../src/engine/script'
import type {Phase} from '../src/engine/library'

const input={delta:.05,playing:true,working:true,phase:'thinking' as Phase,reacting:false,width:720,height:112,home:.52,canWalk:true}
test('waiting alternates real walks and work poses, using all eight walk frames in both directions',()=>{
  const travel=new CharacterTravel(),seen=new Set<string>(),positions=new Set<number>(),frames=new Map<string,Set<number>>()
  let previous=travel.snapshot().x
  for(let i=0;i<1400;i++){
    const p=travel.advance(input);positions.add(Math.round(p.x*720));seen.add(p.walking?String(p.facing):'rest')
    assert.ok(Math.abs(p.x-previous)<=112*.5/720*.05+.00001);previous=p.x
    if(p.walking){const action=p.facing<0?'walk-left':'walk-right';if(!frames.has(action))frames.set(action,new Set());frames.get(action)!.add(frameAt(action,p.seconds))}
  }
  assert.ok(positions.size>150);assert.deepEqual([...seen].sort(),['-1','1','rest'])
  assert.equal(frames.get('walk-left')?.size,8);assert.equal(frames.get('walk-right')?.size,8)
})
test('an inactive task roams in both directions with short rests even when the last tool was reading',()=>{
  const travel=new CharacterTravel(),directions=new Set<number>();let firstWalk=0,restLength=0,longestRest=0
  for(let i=0;i<1400;i++){
    const p=travel.advance({...input,working:false,phase:'reading'})
    if(p.walking){if(!firstWalk)firstWalk=(i+1)*.05;directions.add(p.facing);restLength=0}
    else {restLength+=.05;longestRest=Math.max(longestRest,restLength)}
  }
  assert.ok(firstWalk<=1.25);assert.deepEqual([...directions].sort(),[-1,1]);assert.ok(longestRest<=2.5)
})
test('completion holds its reaction then starts idle wandering instead of returning to the desk',()=>{
  const travel=new CharacterTravel();for(let i=0;i<30;i++)travel.advance({...input,phase:'reading'})
  const position=travel.snapshot().x
  for(let i=0;i<36;i++){const p=travel.advance({...input,working:false,phase:'reading',reacting:true});assert.equal(p.x,position);assert.equal(p.walking,false)}
  let started=false
  for(let i=0;i<26;i++)if(travel.advance({...input,working:false,phase:'reading'}).walking)started=true
  assert.ok(started)
})
test('tool changes preserve position and desk work walks home before settling, with occasional short breaks',()=>{
  const travel=new CharacterTravel()
  for(let i=0;i<100;i++)travel.advance({...input,direction:-1})
  const away=travel.snapshot().x;assert.ok(away<.3)
  const first=travel.advance({...input,delta:0,phase:'reading'});assert.equal(first.x,away);assert.ok(first.walking);assert.equal(first.facing,1)
  for(let i=0;i<180;i++)travel.advance({...input,phase:'reading'})
  assert.equal(travel.snapshot().x,.52);assert.equal(travel.snapshot().walking,false)
  // A different tool at the same desk must not reset the rest timer or teleport.
  const typing=travel.advance({...input,delta:0,phase:'editing'});assert.equal(typing.x,.52);assert.equal(typing.walking,false)
  let tookBreak=false,returned=false
  for(let i=0;i<750;i++){const p=travel.advance({...input,phase:'editing'});if(p.walking)tookBreak=true;if(tookBreak&&!p.walking&&Math.abs(p.x-.52)<.001)returned=true}
  assert.ok(tookBreak&&returned)
})
test('hidden and reduced motion freeze travel; reactions hold position and characters without walk clips never slide',()=>{
  const travel=new CharacterTravel();for(let i=0;i<20;i++)travel.advance({...input,direction:1})
  const moving=travel.snapshot();assert.ok(moving.walking)
  for(let i=0;i<200;i++)assert.deepEqual(travel.advance({...input,playing:false,delta:5}),moving)
  assert.equal(travel.advance({...input,reacting:true}).x,moving.x)
  const noWalk=new CharacterTravel();for(let i=0;i<2000;i++)noWalk.advance({...input,canWalk:false})
  assert.equal(noWalk.snapshot().x,.52);assert.equal(noWalk.snapshot().walking,false)
})
test('rapid task phase changes never restart the walking deadline or cancel a short desk excursion',()=>{
  const travel=new CharacterTravel();let farthest=0
  for(let i=0;i<500;i++){
    const p=travel.advance({...input,phase:Math.floor(i/20)%2?'thinking':'reading'})
    farthest=Math.max(farthest,Math.abs(p.x-.52))
  }
  assert.ok(farthest>.2)
})
test('walk routes stay inside narrow and wide stages and manual directions stop at the edge',()=>{
  for(const width of [240,288,720,1920]){
    const travel=new CharacterTravel(),margin=Math.min(.43,Math.max(.12,(112*.65+8)/width))
    for(const direction of [-1,1] as const){
      for(let i=0;i<1200;i++){const p=travel.advance({...input,width,direction});assert.ok(p.x>=margin-.00001&&p.x<=1-margin+.00001)}
      const p=travel.snapshot();assert.equal(p.x,direction<0?margin:1-margin);assert.equal(p.walking,false)
    }
  }
})
test('the four row walking atlas registers sixteen frames with a shared foot baseline per direction',()=>{
  const width=80,height=100,pixels=new Uint8ClampedArray(width*height*4)
  for(let row=0;row<4;row++)for(let col=0;col<4;col++)for(let y=row*25+3;y<row*25+22;y++)for(let x=col*20+3;x<col*20+15;x++)pixels[(y*width+x)*4+3]=255
  const sheet=animationBoundsFromPixels(pixels,width,height,[0,1,2,3],4);assert.equal(sheet.frames.length,16)
  for(const direction of [0,1]){const roots=sheet.frames.slice(direction*8,direction*8+8).map((f,i)=>f.crop.y+f.anchorY-Math.floor(i/4)*25);assert.ok(roots.every(y=>y===roots[0]))}
})
test('resizing during a walk bounds the old destination so the character can still arrive and stop',()=>{
  const travel=new CharacterTravel();for(let i=0;i<20;i++)travel.advance({...input,direction:-1})
  for(let i=0;i<200;i++){
    const p=travel.advance({...input,width:240,direction:-1})
    assert.ok(p.x>=(112*.65+8)/240-.00001)
  }
  assert.equal(travel.snapshot().walking,false)
})
test('the renderer draws moving walk sprites at their route position and keeps desk furniture anchored',()=>{
  const figures:MascotDraw[]=[{x:10,py:4,look:{pose:'stand',stride:-1,facing:0,scale:1,arms:{left:'down',right:'down'}}} as MascotDraw]
  const frames=Array.from({length:32},(_,i)=>({crop:{x:i*100,y:0,w:80,h:100},anchorX:40,anchorY:100}))
  const sheet={image:{} as HTMLImageElement,frames,referenceHeight:100},sprites:AnimationSprites=animationFixture(sheet,{'walk-right':{...sheet,frames:frames.slice(8,16)}})
  const canvas={width:720,height:112,dataset:{} as Record<string,string>},draws:number[][]=[]
  const g={canvas,clearRect(){},fillRect(){},fillText(){},drawImage(...args:unknown[]){draws.push(args.slice(1) as number[])}} as unknown as CanvasRenderingContext2D
  const frame={cells:new Uint32Array(90*8*3),cols:90,rows:8,t:2,preset:{theme:'studio' as const,mood:'day' as const},mascots:figures}
  for(const x of [.3,.7])paint(g,frame,sheet.image,Array(12).fill(frames[0]!.crop),'reading','none',sprites,{time:0,outcomeAge:0,playing:true,working:true},undefined,{x,walking:true,facing:x<.5?-1:1,seconds:.31})
  assert.equal(draws[0]![0],400);assert.equal(draws[1]![0],1200)
  assert.ok(draws[1]![4]!>draws[0]![4]!+250)
  assert.equal(canvas.dataset.action,'walk-right');assert.equal(canvas.dataset.theme,'studio')
  assert.equal(canvas.dataset.walking,'true')
})
test('idle roaming paints the frozen live scene and moves only its character; running live scripts keep their own placement',()=>{
  const mascot={x:10,py:4,look:{pose:'stand',stride:-1,facing:0,scale:1,arms:{left:'down',right:'down'}}} as MascotDraw
  const frames=Array.from({length:32},(_,i)=>({crop:{x:i*100,y:0,w:80,h:100},anchorX:40,anchorY:100}))
  const sheet={image:{} as HTMLImageElement,frames,referenceHeight:100},sprites:AnimationSprites=animationFixture(sheet,{'walk-right':{...sheet,frames:frames.slice(8,16)}})
  const cells=new Uint32Array(90*8*3);for(let i=0;i<90*8;i++){cells[i*3+1]=0x01000000;cells[i*3+2]=0x01000000}cells[2]=0xabcdef
  const draws:number[][]=[],backgrounds:number[][]=[],dataset:Record<string,string>={}
  const g={canvas:{width:720,height:112,dataset},clearRect(){},fillRect(...args:number[]){backgrounds.push(args)},fillText(){},drawImage(...args:unknown[]){draws.push(args.slice(1) as number[])}} as unknown as CanvasRenderingContext2D
  const frame={cells,cols:90,rows:8,t:5,mascots:[mascot]}
  for(const x of [.25,.75])paint(g,frame,sheet.image,[], 'reading','none',sprites,{time:2,outcomeAge:0,playing:true,working:false},undefined,{x,walking:true,facing:1,seconds:.1})
  assert.ok(draws[1]![4]!>draws[0]![4]!+350);assert.equal(dataset.action,'walk-right');assert.deepEqual(backgrounds,[[0,0,8,14],[0,0,8,14]])
  paint(g,frame,sheet.image,[], 'reading','none',sprites,{time:2,outcomeAge:0,playing:true,working:true},undefined,{x:.75,walking:true,facing:1,seconds:.1})
  assert.equal(dataset.action,'read');assert.ok(draws[2]![4]!<150)
})
test('walking keeps a planted foot at one floor level without an added whole-body hop',()=>{
 const draws:number[][]=[],dataset:Record<string,string>={}
 const g={canvas:{width:800,height:200,dataset},clearRect(){},fillRect(){},fillText(){},drawImage(...args:unknown[]){draws.push(args.slice(1) as number[])}} as unknown as CanvasRenderingContext2D
 const frames=Array.from({length:8},(_,i)=>({crop:{x:i*100,y:0,w:80,h:100},anchorX:40,anchorY:100}))
 const sheet={image:{} as HTMLImageElement,frames,referenceHeight:100},sprites=animationFixture(sheet)
 const mascot={x:10,py:4,look:{pose:'stand',stride:-1,facing:0,scale:1,arms:{left:'down',right:'down'}}} as MascotDraw
 const frame={cells:new Uint32Array(100*14*3),cols:100,rows:14,t:0,preset:{theme:'studio' as const,mood:'day' as const},mascots:[mascot]}
 for(let i=0;i<8;i++)paint(g,frame,sheet.image,[],'reading','none',sprites,{time:0,outcomeAge:0,playing:true,working:true},undefined,{x:.5,walking:true,facing:1,seconds:i*.075+.001})
 assert.equal(new Set(draws.map(d=>d[5]!+d[7]!)).size,1,'the ground must not move as the gait advances')
 assert.deepEqual(draws.map(d=>d[0]),[0,100,200,300,400,500,600,700])
})

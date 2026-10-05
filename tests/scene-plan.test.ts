import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parseScenePlan,sceneFromPlan,plannedAction,PROP_KINDS,EFFECT_KINDS} from '../src/scene-plan'
import {SceneSchedule} from '../src/client/scene-schedule'
import {paintDirection,paintDirectionBubble} from '../src/client/scene-direction'
import {paint} from '../src/client/sprite'
import {cleanScript,stage} from '../src/engine/script'
import {DWELL_MS} from '../src/engine/library'
const raw={concept:'工坊里的检查任务',theme:'workshop',mood:'day',action:'check',props:[{kind:'rice-bowl',slot:'left'},{kind:'terminal',slot:'right'}],effects:['steam','scan'],say:'本鲸盯着测试呢，饭先等等。'}

test('model plans reuse fine scenes and carry dialogue through the fixed worker script',()=>{
  const plan=parseScenePlan(raw),scene=sceneFromPlan(plan,'testing'),script=cleanScript(scene.raw)!
  assert.equal(scene.stock,false);assert.deepEqual(scene.preset,{theme:'workshop',mood:'day'})
  assert.equal(scene.direction?.say,raw.say)
  for(const cols of [36,90,240]){let mascots=0;stage({cols,rows:8,t:1,script,since:1000,reveal:1,onMascot:()=>mascots++});assert.equal(mascots,1);assert.equal(script.code?.error,undefined)}
})
test('plans reject executable fields, unknown assets, excess items and colliding prop slots',()=>{
  for(const invalid of [{...raw,code:'fetch("https://example.com")'},{...raw,theme:'unknown'},{...raw,action:'execute'},{...raw,say:'English only'},{...raw,props:[{kind:'rice-bowl',slot:'left',url:'x'}]},{...raw,props:[{kind:'unknown',slot:'left'}]},{...raw,props:[{kind:'book',slot:'left'},{kind:'terminal',slot:'left'}]},{...raw,effects:['rain','rain']},{...raw,effects:['rain','steam','scan']},{...raw,say:'鲸'.repeat(61)}])assert.throws(()=>parseScenePlan(invalid))
})
test('changing only dialogue or props is a new scene even with identical backgrounds and scripts',()=>{
  const initial=sceneFromPlan(parseScenePlan(raw),'testing'),next=sceneFromPlan(parseScenePlan({...raw,say:'本鲸还在盯着结果。'}),'testing'),s=new SceneSchedule()
  s.replace(initial,'testing',0);s.setPlaying(true,0)
  assert.equal(s.request(next,'testing',DWELL_MS),undefined)
  assert.equal(s.poll('testing',()=>initial,45000),next)
})
test('actual outcome, idle state and newer task phases override stale planned poses',()=>{
  const d=sceneFromPlan(parseScenePlan(raw),'testing').direction
  assert.equal(plannedAction(d,'testing','none',true,'idle'),'check')
  assert.equal(plannedAction(d,'reading','none',true,'read'),'read')
  assert.equal(plannedAction(d,'testing','success',true,'success'),'success')
  assert.equal(plannedAction(d,'testing','none',false,'idle'),'idle')
})
test('catalog props, effects and bubbles stay within the narrow and wide pixel canvas',()=>{
  for(const width of [288,720,1920])for(const kind of PROP_KINDS)for(const slot of ['left','right'] as const){
    const g={canvas:{width,height:112,dataset:{}},fillStyle:'',font:'',textBaseline:'',fillRect(x:number,y:number,w:number,h:number){assert.ok(Number.isInteger(x)&&Number.isInteger(y));assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=112)},fillText(_s:string,x:number,y:number,w:number){assert.ok(x>=0&&y>=0&&x+w<=width)}} as unknown as CanvasRenderingContext2D
    for(const effect of EFFECT_KINDS)for(const time of [0,1,80])paintDirection(g,{...parseScenePlan(raw),props:[{kind,slot}],effects:[effect],phase:'testing'},time)
    paintDirectionBubble(g,'中文气泡和 README.md 都需要在窄画布中完整显示。')
  }
})
test('fine scene rendering keeps generated speech visible and drops speech from older task phases',()=>{
  const scene=sceneFromPlan(parseScenePlan(raw),'testing'),words:string[]=[],crops=Array.from({length:12},()=>({x:0,y:0,w:50,h:60})),g={canvas:{width:288,height:112,dataset:{}},clearRect(){},fillRect(){},drawImage(){},fillText(s:string){words.push(s)}} as unknown as CanvasRenderingContext2D
  const frame={cells:new Uint32Array(36*8*3),cols:36,rows:8,mascots:[],t:1,preset:scene.preset,direction:scene.direction}
  paint(g,frame,{} as HTMLImageElement,crops,'testing','none')
  assert.ok(words.includes(raw.say));assert.equal(g.canvas.dataset.sceneOrigin,'model')
  words.length=0;paint(g,frame,{} as HTMLImageElement,crops,'reading','none');assert.ok(!words.includes(raw.say))
})

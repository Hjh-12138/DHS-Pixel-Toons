import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PIXEL_THEMES,GAME_THEMES,PixelDeck} from '../src/presets'
import {decodePreferences} from '../src/client/preferences'
import {paintPixelScene,pixelLayout} from '../src/client/pixel-scenes'
import {PHASES} from '../src/engine/library'
import {SceneDeck,stockCount} from '../src/scene'
import {cleanScript,stage} from '../src/engine/script'

test('all new themes use whole pixel primitives and keep the character bay inside narrow/wide canvases',()=>{
 const signatures=new Set<string>()
 for(const theme of PIXEL_THEMES)for(const mood of ['day','dusk'] as const)for(const width of [288,384,720,1088,1920])for(const action of ['idle','read','type','success'] as const){
  const rects:(number|string)[][]=[]
  const g={canvas:{width,height:112,dataset:{}},fillStyle:'',fillRect(this:{fillStyle:string},x:number,y:number,w:number,h:number){rects.push([x,y,w,h,this.fillStyle])}} as unknown as CanvasRenderingContext2D
  const layout=paintPixelScene(g,{theme,mood},2.5,action)
  assert.ok(layout.centerX-84>=0&&layout.centerX+84<=width)
  assert.ok(layout.footY<=104&&layout.footY>=90)
  assert.equal(layout.prone,action==='read'||action==='type')
  assert.ok(rects.length>100)
  for(const rect of rects)for(const value of rect.slice(0,4))assert.ok(typeof value==='number'&&Number.isInteger(value)&&value>=0)
  if(width===720&&action==='idle')signatures.add(JSON.stringify(rects))
 }
 assert.equal(signatures.size,stockCount)
 assert.equal(pixelLayout(720,112,'idle').centerX,pixelLayout(720,112,'read').centerX)
})
test('preset decks never select legacy text/3D scenes and every phase fits the eight-row worker',()=>{
 for(const styles of [['pixel art'],['all']]){
  const deck=new SceneDeck(styles)
  for(const phase of PHASES)for(let i=0;i<stockCount;i++){
   const scene=deck.next(phase,'文件 $& README.md');assert.ok(scene.stock&&scene.preset)
   assert.ok(PIXEL_THEMES.includes(scene.preset.theme));assert.ok(scene.concept.includes('$&'))
   const script=cleanScript(scene.raw);assert.ok(script)
   let figures=0;stage({cols:36,rows:8,t:1,script,since:1000,reveal:1,onMascot:()=>figures++})
   assert.equal(figures,1);assert.equal(script.code?.error,undefined)
  }
 }
 const deck=new PixelDeck(true),seen=new Set<string>();for(let i=0;i<stockCount;i++){const p=deck.next('reading');seen.add(`${p.theme}/${p.mood}`)}
 assert.equal(seen.size,stockCount)
})
test('a selected game theme persists and stays selected through every work phase',()=>{
 for(const theme of GAME_THEMES){
  const prefs=decodePreferences(JSON.stringify({theme,source:'ready-made only',style:'all',compact:true}))
  assert.equal(prefs.theme,theme);assert.equal(prefs.compact,true)
  const deck=new SceneDeck(['all'],prefs.theme),moods=new Set<string>()
  for(const phase of PHASES){const p=deck.next(phase,'README.md').preset!;assert.equal(p.theme,theme);moods.add(p.mood)}
  assert.equal(moods.size,2)
 }
 assert.equal(decodePreferences('{"style":"all","source":"mix"}').style,'all')
 assert.equal(decodePreferences('{"theme":"unknown","source":"mix"}').theme,undefined)
 assert.equal(decodePreferences('null').compact,false)
})
test('legacy hidden preferences migrate to one recoverable collapse state',()=>{
 for(const hidden of [false,true])for(const compact of [false,true]){
  const prefs=decodePreferences(JSON.stringify({hidden,compact,source:'mix',style:'all',theme:'wuling-waterfront'}))
  assert.equal(prefs.compact,hidden||compact)
  assert.equal(prefs.source,'mix');assert.equal(prefs.style,'all');assert.equal(prefs.theme,'wuling-waterfront')
  assert.ok(!('hidden' in prefs))
  const expanded=decodePreferences(JSON.stringify({...prefs,compact:false}))
  assert.equal(expanded.compact,false)
  assert.equal(expanded.theme,'wuling-waterfront')
 }
})
test('game panoramas animate within the pixel canvas, including narrow layouts and long idle times',()=>{
 for(const theme of GAME_THEMES)for(const width of [288,384,720,1920]){
  const samples=[]
  for(const time of [0,1.25,50,500]){
   const rects:(number|string)[][]=[]
   const g={canvas:{width,height:112,dataset:{}},fillStyle:'',fillRect(this:{fillStyle:string},x:number,y:number,w:number,h:number){assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=112);rects.push([x,y,w,h,this.fillStyle])}} as unknown as CanvasRenderingContext2D
   paintPixelScene(g,{theme,mood:'day'},time,'idle');samples.push(JSON.stringify(rects))
  }
  assert.equal(new Set(samples).size,4)
 }
})

import {test} from 'node:test'
import assert from 'node:assert/strict'
import {cellWidth,clipText,textWidth,wrapText} from '../src/engine/text'
import {cleanText} from '../src/engine/effects'
import {cleanScript,stage} from '../src/engine/script'
import {SceneDeck} from '../src/scene'
import {PHASES} from '../src/engine/library'
import {SCENES} from '../src/engine/scenes'
import {paint} from '../src/client/sprite'

const base={actors:[],particles:[],background:{effect:'waves',palette:['#113','#448','#99f'],speed:.4,intensity:0}}
const draw=(code:string,cols=40)=>{
 const script=cleanScript({...base,code});assert.ok(script)
 const cells=stage({script,cols,rows:14,t:5,since:5000,reveal:1,onMascot:()=>{}})
 assert.equal(script.code?.error,undefined)
 return cells
}
const glyph=(cells:Uint32Array,col:number,row:number,cols=40)=>cells[(row*cols+col)*3]
test('Chinese text retains punctuation and code points, and wraps by columns',()=>{
 assert.equal(cleanText('阅读中文文件，测试通过！',70),'阅读中文文件，测试通过！')
 assert.equal(cellWidth('中'),2);assert.equal(cellWidth('A'),1);assert.equal(textWidth('中文.ts'),7)
 assert.equal(clipText('中A文',4),'中A')
 const lines=wrapText('阅读中文 README.md，测试通过！',12)
 assert.equal(lines.join('').replaceAll(' ',''),'阅读中文README.md，测试通过！')
 assert.ok(lines.every(line=>textWidth(line)<=12))
 assert.equal(cleanText('𠀀中文',1),'𠀀');assert.equal(clipText('𠀀中文',3),'𠀀')
})
test('text and sprites reserve two columns per glyph and clip whole glyphs at the edge',()=>{
 const cells=draw('function frame(){text(2,1,"中文A","#fff");sprite(2,2,"文件B","#fff");text(39,3,"中","#fff");}')
 for(const [row,line] of [[1,'中文A'],[2,'文件B']] as const){assert.equal(glyph(cells,2,row),line.codePointAt(0));assert.equal(glyph(cells,3,row),0);assert.equal(glyph(cells,4,row),line.codePointAt(1));assert.equal(glyph(cells,6,row),66-(row===1?1:0))}
 assert.notEqual(glyph(cells,39,3),'中'.codePointAt(0))
 const overwritten=draw('function frame(){text(2,1,"中文","#fff");put(3,1,"x","#fff");}')
 assert.equal(glyph(overwritten,2,1),32);assert.equal(glyph(overwritten,3,1),120)
})
test('both scripted and declarative speech render Chinese inside unbroken borders',()=>{
 for(const declarative of [false,true]){
  const script=cleanScript({...base,code:declarative?'':'function frame(){clawd(3,4);say("中文气泡测试通过，继续加油！",10,4);}',actors:declarative?[{kind:'clawd',x:'3',y:'4',frames:[],color:'#88f',say:'中文气泡测试通过，继续加油！',sayAt:0}]:[]});assert.ok(script)
  // Start at zero so the scripted typewriter clock can finish normally.
  stage({script,cols:24,rows:14,t:0,since:0,reveal:1,onMascot:()=>{}})
  const cells=stage({script,cols:24,rows:14,t:5,since:5000,reveal:1,onMascot:()=>{}})
  const codes=Array.from({length:24*14},(_,i)=>cells[i*3])
  for(const char of '中文气泡测试通过，继续加油！')assert.ok(codes.includes(char.codePointAt(0)!))
  for(const char of '╭╮╰╯')assert.equal(codes.filter(c=>c===char.codePointAt(0)).length,1)
 }
})
test('all stock captions and phase decks use Chinese and safely keep Chinese task names',()=>{
 assert.ok(SCENES.every(s=>/[\u4e00-\u9fff]/.test(s.concept)))
 for(const phase of PHASES){
  // Exercise every style and every scene with quotes, slashes and interpolation-like data.
  const stocks=SCENES.filter(s=>s.phase===phase)
  const deck=new SceneDeck(['pixel art','text art','3D'])
  for(let i=0;i<stocks.length;i++){
   const raw=deck.next(phase,'中文\'"\\${x}`文件.ts').raw
   const script=cleanScript(raw);assert.ok(script)
   stage({script,cols:90,rows:14,t:2,since:2000,reveal:1,onMascot:()=>{}})
   assert.equal(script.code?.error,undefined)
   assert.ok(JSON.stringify(raw).includes('中文'))
  }
 }
})
test('renderer paints backgrounds before wide foreground glyphs with a CJK font',()=>{
 const operations:string[]=[]
 const g={canvas:{width:40,height:14},clearRect(){},fillRect(){operations.push('background')},fillText(s:string,_x:number,_y:number,maxWidth:number){operations.push(`${s}:${maxWidth}`)},drawImage(){}} as unknown as CanvasRenderingContext2D
 const cells=new Uint32Array(['中'.codePointAt(0)!,0xffffff,0x223344,0,0x01000000,0x223344])
 paint(g,{cells,cols:2,rows:1,t:0,mascots:[]},{} as HTMLImageElement,Array(12).fill({x:0,y:0,w:10,h:10}),'thinking','none')
 assert.deepEqual(operations,['background','background','中:40'])
 assert.match(g.font,/Microsoft YaHei/)
})

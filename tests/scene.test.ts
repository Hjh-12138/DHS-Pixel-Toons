import {test} from 'node:test'
import assert from 'node:assert/strict'
import {cleanScript,stage,type MascotDraw} from '../src/engine/script'
import {SCENES} from '../src/engine/scenes'
import {validateScene,SceneDeck} from '../src/scene'
import {PHASES} from '../src/engine/library'

test('all shipped scenes execute with fixed sprite placements at two viewport widths',()=>{
  const failures:string[]=[]
  for(const [i,stock] of SCENES.entries())for(const cols of [70,100]){
    const raw=JSON.parse(JSON.stringify(stock.scene).replaceAll('{what}','app.ts'))
    const script=cleanScript(raw);assert.ok(script)
    for(const t of [0,.5,2,20,60,119]){
      const figures:MascotDraw[]=[]
      const cells=stage({cols,rows:14,t,script,since:t*1000,reveal:1,onMascot:m=>figures.push(m)})
      assert.equal(cells.length,cols*14*3)
      for(const m of figures)assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.py))
      if(script.code?.error){failures.push(`${i}/${cols}: ${script.code.error}`);break}
    }
  }
  assert.deepEqual(failures,[])
})
test('every task phase deals a usable scene',()=>{const deck=new SceneDeck();for(const p of PHASES)assert.ok(cleanScript(deck.next(p,'README.md').raw))})
test('model code must use the fixed mascot and stays bounded',()=>{
  const base={concept:'test',actors:[],particles:[],background:{effect:'waves',palette:['#113','#448','#99f'],speed:.4,intensity:.2}}
  assert.throws(()=>validateScene({...base,code:'function frame(t,dt){while(true){}}'}),/too long/)
  assert.throws(()=>validateScene({...base,code:'function frame(t,dt){text(1,1,"abc","#fff");}'}),/fixed mascot/)
  assert.ok(validateScene({...base,code:'function frame(t,dt){clawd(20,4);}'}))
})

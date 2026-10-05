import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {zipSync,strToU8} from 'fflate'
import {assetPath,checkFrameBounds,imageType,PACK_LIMITS,packFrameAt,packFromEntries,packFromJson,parsePackManifest,readLocalPack,resolvePackClip,unpackArchive} from '../src/client/resource-pack'
import {decodePreferences} from '../src/client/preferences'
import {paint} from '../src/client/sprite'
import type {MascotDraw} from '../src/engine/script'
const png=new Uint8Array(readFileSync(new URL('../examples/mint-robot/character.png',import.meta.url)))
const base=()=>({format:'dsh-toons-pack',version:1,id:'simple-cat',name:'小猫',character:{atlases:{main:'cat.png'},referenceHeight:80,actions:{idle:{frames:[{atlas:'main',x:0,y:0,w:64,h:80}]}}}})
const entries=(manifest:unknown)=>({'manifest.json':strToU8(JSON.stringify(manifest)),'cat.png':png})

test('PNG and all WebP headers enforce dimensions before allocating decoded images',()=>{
  const hugePng=new Uint8Array(png);new DataView(hugePng.buffer).setUint32(16,10000)
  assert.throws(()=>imageType(hugePng),/尺寸过大/)
  const makeWebp=(kind:string)=>{const b=new Uint8Array(30);b.set(strToU8('RIFF'),0);b.set(strToU8('WEBP'),8);b.set(strToU8(kind),12);return b}
  const x=makeWebp('VP8X');x[24]=63;x[27]=79;assert.equal(imageType(x),'image/webp')
  x[25]=32;assert.throws(()=>imageType(x),/尺寸过大/);x[25]=0;x[20]=2;assert.throws(()=>imageType(x),/静态/)
  const l=makeWebp('VP8L');l[20]=0x2f;new DataView(l.buffer).setUint32(21,63|(79<<14),true);assert.equal(imageType(l),'image/webp')
  new DataView(l.buffer).setUint32(21,10000|(79<<14),true);assert.throws(()=>imageType(l),/尺寸过大/)
  const v=makeWebp('VP8 ');v.set([0x9d,1,0x2a],23);const view=new DataView(v.buffer);view.setUint16(26,64,true);view.setUint16(28,80,true);assert.equal(imageType(v),'image/webp')
  view.setUint16(28,9999,true);assert.throws(()=>imageType(v),/尺寸过大/)
})

test('real ZIP example and self contained JSON both import with independent role and scene metadata',async()=>{
  const example=await readLocalPack(new Blob([readFileSync(new URL('../examples/mint-robot.toons.zip',import.meta.url))]))
  assert.equal(example.id,'mint-robot-garden');assert.ok(example.manifest.character);assert.ok(example.manifest.scene)
  assert.equal(Object.keys(example.assets).length,2)
  const encoded={...base(),assets:{'cat.png':`data:image/png;base64,${Buffer.from(png).toString('base64')}`}}
  const json=packFromJson(JSON.stringify(encoded));assert.equal(json.manifest.character?.actions.idle.frames[0]?.anchorY,80)
  assert.equal(json.assets['cat.png']!.type,'image/png')
  const scene=parsePackManifest({format:'dsh-toons-pack',version:1,id:'garden',name:'庭院',scene:{background:'cat.png'}})
  assert.equal(scene.character,undefined);assert.equal(scene.scene?.footY,.94)
})
test('optional actions fall back to the imported character idle and missing walk direction mirrors its counterpart',()=>{
  const c=parsePackManifest(base()).character!
  assert.equal(resolvePackClip(c,'read').clip,c.actions.idle)
  c.actions['walk-right']={...c.actions.idle,frames:[{...c.actions.idle.frames[0]!,durationMs:100},{...c.actions.idle.frames[0]!,x:64,durationMs:200}]}
  const left=resolvePackClip(c,'walk-left');assert.ok(left.mirror);assert.equal(left.action,'walk-right')
  assert.equal(packFrameAt(left.clip,.15).x,64);assert.equal(packFrameAt(left.clip,.35).x,0)
  left.clip.loop=false;assert.equal(packFrameAt(left.clip,999).x,64)
  assert.equal(packFrameAt(left.clip,Number.NaN).x,0)
})
test('invalid manifests, missing files and out of bounds frames fail before installation',()=>{
  assert.throws(()=>parsePackManifest({...base(),version:2}),/不支持/)
  assert.throws(()=>parsePackManifest({...base(),character:{...base().character,actions:{}}}),/idle/)
  assert.throws(()=>parsePackManifest({...base(),character:{...base().character,referenceHeight:0}}),/参考高度/)
  assert.throws(()=>packFromEntries({'manifest.json':strToU8(JSON.stringify(base()))}),/缺少图片/)
  const c=parsePackManifest(base()).character!
  assert.throws(()=>checkFrameBounds(c,{main:{width:63,height:80}}),/超出/)
  assert.doesNotThrow(()=>checkFrameBounds(c,{main:{width:64,height:80}}))
  assert.throws(()=>packFromJson(JSON.stringify({...base(),assets:{'cat.png':'https://example.com/cat.png'}})),/base64/)
})
test('archives reject traversal, duplicate names, extra scripts and excessive declared expansion before inflating',()=>{
  for(const path of ['../cat.png','/cat.png','https://x/cat.png','folder/../cat.png','folder//cat.png','C:/cat.png','cat.svg'])assert.throws(()=>assetPath(path))
  const archive=zipSync({...entries(base()),'payload.js':strToU8('alert(1)')})
  assert.throws(()=>unpackArchive(archive),/PNG/)
  assert.throws(()=>unpackArchive(new Uint8Array([80,75,0])),/ZIP/)
  assert.throws(()=>unpackArchive(new Uint8Array(PACK_LIMITS.archive+1)),/20 MB/)
  const oversized=zipSync(entries(base())),view=new DataView(oversized.buffer,oversized.byteOffset,oversized.length)
  for(let i=0;i<oversized.length-46;i++)if(view.getUint32(i,true)===0x02014b50){view.setUint32(i+24,PACK_LIMITS.expanded+1,true);break}
  assert.throws(()=>unpackArchive(oversized),/过大/)
  // Rename the second central-directory entry to match an existing name.
  const duplicate=zipSync({'cat.png':png,'dog.png':png}),dv=new DataView(duplicate.buffer,duplicate.byteOffset,duplicate.length)
  let found=0
  for(let i=0;i<duplicate.length-46;i++)if(dv.getUint32(i,true)===0x02014b50&&++found===2){duplicate.set(strToU8('cat.png'),i+46);break}
  assert.throws(()=>unpackArchive(duplicate),/重复/)
})
test('stored selections remain compatible with legacy preferences and local scenes use stock mode',()=>{
  const p=decodePreferences(JSON.stringify({characterPackId:'simple-cat',scenePackId:'garden',source:'mix',hidden:true}))
  assert.equal(p.characterPackId,'simple-cat');assert.equal(p.scenePackId,'garden');assert.equal(p.source,'ready-made only');assert.ok(p.compact)
  const invalid=decodePreferences('{"characterPackId":"../bad","scenePackId":2,"source":"mix"}')
  assert.equal(invalid.characterPackId,undefined);assert.equal(invalid.scenePackId,undefined);assert.equal(invalid.source,'mix')
})
test('imported background, mascot and foreground render in order and work at narrow and wide stage widths',()=>{
  const spec=parsePackManifest(base()).character!,hero={width:64,height:80} as HTMLImageElement,bg={width:960,height:112} as HTMLImageElement,fg={...bg} as HTMLImageElement
  const mascot={x:0,py:0,look:{pose:'stand',scale:1,facing:0}} as MascotDraw
  for(const width of [288,720,1920]){
    const drawn:{image:unknown;args:number[]}[]=[],dataset:Record<string,string>={}
    const g={canvas:{width,height:112,dataset},clearRect(){},fillRect(){},fillText(){},drawImage(image:unknown,...args:number[]){drawn.push({image,args})}} as unknown as CanvasRenderingContext2D
    paint(g,{cells:new Uint32Array(0),cols:width/8,rows:8,t:0,mascots:[mascot]},{} as HTMLImageElement,[],'reading','none',undefined,{time:.1,outcomeAge:0,playing:true},{character:{id:'cat',spec,images:{main:hero}},scene:{id:'garden',spec:{background:'bg.png',foreground:'fg.png',fit:'cover',color:'#123456',centerX:.35,footY:.94,scale:1},background:bg,foreground:fg}},{x:.8,walking:true,facing:1,seconds:1})
    assert.deepEqual(drawn.map(d=>d.image),[bg,hero,fg]);assert.equal(dataset.clip,'idle');assert.equal(dataset.action,'read')
    assert.equal(dataset.characterPack,'cat');assert.equal(dataset.scenePack,'garden')
    const bounds=drawn[1]!.args.slice(4);assert.ok(bounds[0]!>=0&&bounds[1]!>=0&&bounds[0]!+bounds[2]!<=width&&bounds[1]!+bounds[3]!<=112)
    // A character with no walk clips keeps the scene's authored home, even if
    // it replaces a walking character partway through its route.
    assert.ok(Math.abs(bounds[0]!+bounds[2]!/2-width*.35)<1)
  }
})

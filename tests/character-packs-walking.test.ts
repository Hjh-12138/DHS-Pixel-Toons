import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {readLocalPack,resolvePackClip} from '../src/client/resource-pack'
import {pngPixels} from './helpers/png'
import {walkGeometry,lowerBodyPoseDifference} from '../scripts/character-atlas'
for(const id of ['silver-music','purple-star-cat','orange-flower','blue-fan','blonde-goth','black-beast']){
 test(`${id} resolves the approved walk and keeps shoe contacts`,async()=>{
  const bytes=readFileSync(new URL(`../examples/character-packs/${id}.toons.zip`,import.meta.url))
  const imported=await readLocalPack(new Blob([bytes])),spec=imported.manifest.character!
  const resolved=resolvePackClip(spec,'walk-left'),frames=resolved.clip.frames,masks=new Set<string>()
  const png=pngPixels(new URL(`../assets/characters/${id}/${spec.atlases[frames[0]!.atlas]}`,import.meta.url))
  const merged=frames[0]!.atlas==='walk'
  assert.equal(frames.length,8)
  assert.equal(resolvePackClip(spec,'walk-right').mirror,true)
  assert.deepEqual(frames.map(f=>f.durationMs),Array(8).fill(merged?100:75))
  for(let i=0;i<8;i++){
   const frame=frames[i]!,g=walkGeometry(png,frame,222,160)
   assert.equal(g.groundGap,0,`frame ${i+1}: supporting shoe does not meet the floor`)
   assert.ok(g.flatContact>=(merged?1:8),`frame ${i+1}: no supporting sole remains`)
   assert.ok(g.footSpan<=64,`frame ${i+1}: oversized ${g.footSpan}px footprint`)
   if(!merged)assert.ok(lowerBodyPoseDifference(png,frames[0]!,frame,222,160)<=.57,`frame ${i+1}: lower legs swing too far from the neutral step`)
   masks.add(g.mask.join(''))
  }
  assert.ok(masks.size>=6,'The feet must move through the step, rather than holding a standing pose')
 })
 test(`${id} preserves the approved source poses and original action artwork`,()=>{
  const report=JSON.parse(readFileSync(new URL('../examples/character-packs/merge-validation.json',import.meta.url),'utf8')).characters.find((c:any)=>c.id===id)
  const sourceFile=new URL(`../examples/character-packs/walk-sources/${id}.png`,import.meta.url)
  const source=pngPixels(sourceFile),actual=pngPixels(new URL(`../assets/characters/${id}/walk-left.png`,import.meta.url))
  assert.equal(createHash('sha256').update(readFileSync(sourceFile)).digest('hex'),report.sourceHash)
  // Verify each exported pixel uses the SAME transform for all eight approved poses.
  for(let f=0;f<8;f++)for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const sx=Math.round(report.rootX+(x-128)/report.scale),sy=Math.round(report.sourceFloor+(y-221)/report.scale)
   const at=((Math.floor(f/4)*256+y)*actual.width+f%4*256+x)*4
   const from=((Math.floor(f/4)*512+sy)*source.width+f%4*512+sx)*4
   if(sx<0||sx>=512||sy<0||sy>=512||source.pixels[from+3]===0){assert.equal(actual.pixels[at+3],0);continue}
   for(let c=0;c<4;c++)assert.equal(actual.pixels[at+c],source.pixels[from+c],`frame ${f+1}, pixel ${x},${y}`)
  }
  for(const [atlas,hash] of Object.entries(report.unchangedOriginalAtlasHashes)){
   const bytes=readFileSync(new URL(`../assets/characters/${id}/${atlas}.png`,import.meta.url))
   assert.equal(createHash('sha256').update(bytes).digest('hex'),hash)
  }
 })
}

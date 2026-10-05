import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {inflateSync} from 'node:zlib'
import {animationBoundsFromPixels} from '../src/client/sprite'

// Decode the shipped RGBA atlas itself: frame indices alone cannot catch a
// sheet containing repeated poses. PNG filters are reversed without a new dep.
function walkingPixels(){
  const png=readFileSync(new URL('../assets/deepseek-girl-walk.png',import.meta.url))
  assert.equal(png.subarray(1,4).toString(),'PNG')
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20)
  assert.equal(png[24],8);assert.equal(png[25],6);assert.equal(png[28],0)
  const chunks:Buffer[]=[]
  for(let offset=8;offset<png.length;){
    const length=png.readUInt32BE(offset),type=png.subarray(offset+4,offset+8).toString()
    if(type==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length))
    offset+=length+12
  }
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=new Uint8ClampedArray(width*height*4)
  const paeth=(a:number,b:number,c:number)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c}
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)]!;assert.ok(filter<=4)
    for(let x=0;x<stride;x++){
      const at=y*stride+x,a=x>=4?pixels[at-4]!:0,b=y?pixels[at-stride]!:0,c=y&&x>=4?pixels[at-stride-4]!:0
      const prediction=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)
      pixels[at]=(raw[y*(stride+1)+x+1]!+prediction)&255
    }
  }
  return {pixels,width,height}
}
const {pixels,width,height}=walkingPixels()
const sheet=animationBoundsFromPixels(pixels,width,height,[0,1],2)
const displayScale=80/sheet.referenceHeight
for(const [row,direction] of ['left','right'].entries()){
  test(`shipped ${direction} walk has four visibly distinct foot contacts at 80px`,()=>{
    const legs=sheet.frames.slice(row*4,row*4+4).map(({crop,anchorX,anchorY})=>{
      const mask=new Set<number>()
      // Compare the whole lower-leg silhouette, including lifted feet and
      // bent knees: contact width alone cannot distinguish different poses.
      for(let y=-14;y<0;y++)for(let x=-45;x<45;x++){
        const sx=Math.round(crop.x+anchorX+x/displayScale),sy=Math.round(crop.y+anchorY+y/displayScale)
        if(sx>=crop.x&&sx<crop.x+crop.w&&sy>=crop.y&&sy<crop.y+crop.h&&pixels[(sy*width+sx)*4+3]!>80)mask.add((y+14)*90+x+45)
      }
      assert.ok(mask.size>0)
      return mask
    })
    for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){
      const first=legs[a]!,second=legs[b]!
      const changed=[...first].filter(p=>!second.has(p)).length+[...second].filter(p=>!first.has(p)).length
      const delta=changed/Math.max(first.size,second.size)
      assert.ok(delta>=.35,`${direction} frames ${a+1} and ${b+1} repeat the leg silhouette (${Math.round(delta*100)}% difference)`)
    }
  })
  test(`shipped ${direction} walk swings its hands rather than holding them forward`,()=>{
    const positions=sheet.frames.slice(row*4,row*4+4).map(({crop,anchorX})=>{
      let left=Infinity,right=-Infinity
      for(let y=Math.ceil(crop.y+crop.h*.57);y<crop.y+crop.h*.87;y++)for(let x=crop.x;x<crop.x+crop.w;x++){
        const at=(y*width+x)*4,r=pixels[at]!,g=pixels[at+1]!,b=pixels[at+2]!
        // Warm, bright skin below the face isolates hands from hair and gold trim.
        if(pixels[at+3]!>80&&r>220&&g>175&&b>150&&r>g+10&&g>b+10){left=Math.min(left,x-crop.x-anchorX);right=Math.max(right,x-crop.x-anchorX)}
      }
      assert.ok(Number.isFinite(left),'Each frame must show a hand below the face')
      // Both hands can swing symmetrically; their average position stays still.
      return (right-left)*displayScale
    })
    assert.ok(Math.max(...positions)-Math.min(...positions)>=8,`${direction} hands stay in the same position`)
  })
}

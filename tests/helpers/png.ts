import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {inflateSync} from 'node:zlib'

/** Decode actual 8-bit RGBA atlases without adding an image dependency. */
export function pngPixels(path:string|URL){
  const png=readFileSync(path)
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

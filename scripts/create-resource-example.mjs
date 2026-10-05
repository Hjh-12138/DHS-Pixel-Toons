import {mkdir,writeFile} from 'node:fs/promises'
import {zipSync,zlibSync,strToU8} from 'fflate'

// Small, original pixel fixtures: no external art or model requests are needed.
function raster(width,height){
  const pixels=new Uint8Array(width*height*4)
  const rect=(x,y,w,h,color)=>{
    const c=color.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16))
    for(let yy=Math.max(0,Math.round(y));yy<Math.min(height,Math.round(y+h));yy++)for(let xx=Math.max(0,Math.round(x));xx<Math.min(width,Math.round(x+w));xx++){
      const at=(yy*width+xx)*4;pixels.set([...c,255],at)
    }
  }
  const crc=bytes=>{let n=0xffffffff;for(const byte of bytes){n^=byte;for(let i=0;i<8;i++)n=n&1?(n>>>1)^0xedb88320:n>>>1}return (n^0xffffffff)>>>0}
  const chunk=(name,data)=>{const type=Buffer.from(name),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([length,type,data,checksum])}
  const png=()=>{
    const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6
    const rows=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)rows.set(pixels.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1)
    return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',Buffer.from(zlibSync(rows))),chunk('IEND',Buffer.alloc(0))])
  }
  return {rect,png}
}
const actions=['idle','think','read','type','search','check','success','failed','walk-right']
const character=raster(256,actions.length*80),clips={}
actions.forEach((action,row)=>{
  clips[action]={loop:action!=='success'&&action!=='failed',stance:'standing',frames:[]}
  for(let frame=0;frame<4;frame++){
    const ox=frame*64,oy=row*80,hop=action==='success'&&frame===1?-3:0
    const r=(x,y,w,h,c)=>character.rect(ox+x,oy+y+hop,w,h,c)
    r(27,6,10,4,'#fbba77');r(31,10,2,7,'#385b66')
    r(12,18,40,31,'#385b66');r(14,16,36,33,'#385b66');r(16,20,32,25,'#9fdfc6');r(18,23,28,18,'#eef6dc')
    const blink=action==='idle'&&frame===2
    r(23,blink?32:28,4,blink?2:5,'#385b66');r(37,blink?32:28,4,blink?2:5,'#385b66')
    r(30,36,5,2,action==='failed'?'#ba6767':'#74a69d')
    r(18,49,28,21,'#385b66');r(21,51,22,17,'#81bea9');r(28,54,9,7,'#eef6dc');r(31,55,3,5,'#fbba77')
    const work=['read','type','check'].includes(action),arm=action==='success'?33:action==='think'?25:51+frame%2*2
    r(9,arm,8,work?12:16,'#385b66');r(11,arm+2,6,work?9:12,'#9fdfc6');r(47,arm,8,work?12:16,'#385b66');r(47,arm+2,6,work?9:12,'#9fdfc6')
    const step=action==='walk-right'?frame%2*3:0
    r(21,69,8,7-step,'#385b66');r(35,69,8,7-(3-step)*(action==='walk-right'?1:0),'#385b66')
    if(action==='read'){r(15,57,34,14,'#d68e69');r(17,58,14,10,'#f8ecd1');r(33,58,14,10,'#f8ecd1');r(31,57,2,15,'#385b66');r(19+frame,61,9,1,'#9c977e')}
    if(action==='type'){r(10,63,44,9,'#385b66');r(12,64,40,5,'#c9d7d5');r(16+frame*7,65,4,2,'#fbba77')}
    if(action==='search'){r(44,37,10,10,'#385b66');r(46,39,6,6,'#a5dce8');r(51,45,3,10,'#385b66')}
    if(action==='check'){r(13,56,19,16,'#eef6dc');r(16,59+frame,5,3,'#81bea9');r(20,58+frame,4,3,'#81bea9')}
    if(action==='think'){r(47,7,5,5,'#fbba77');r(51,3,3,3,'#fbba77')}
    clips[action].frames.push({atlas:'main',x:ox,y:oy,w:64,h:80,anchorX:32,anchorY:76,durationMs:action==='idle'?[1400,300,120,300][frame]:action==='type'?120:300})
  }
})
const background=raster(1920,112),r=background.rect
r(0,0,1920,112,'#233f54');r(0,68,1920,20,'#325d66');r(0,88,1920,24,'#71968a');r(0,88,1920,2,'#acc5ae')
for(let i=0;i<100;i++){const x=(i*173+17)%1920,y=7+(i*29)%49;r(x,y,2,2,i%3?'#8aa8b1':'#edd9a0')}
for(let x=30;x<1920;x+=180){r(x,54,90,33,'#3b7774');r(x+7,49,76,9,'#3b7774');r(x+13,61,5,2,'#92b9a4');r(x+60,58,4,4,'#edc99c')}
for(let x=0;x<1920;x+=48){r(x,98,27,1,'#86a895');r(x+31,107,31,1,'#577e77')}
r(155,15,19,19,'#eddda3');r(167,12,10,20,'#233f54')
const manifest={format:'dsh-toons-pack',version:1,id:'mint-robot-garden',name:'薄荷机器人 · 月光庭院',author:'DSH Toons',description:'本地资源示例：十类动作、独立角色和庭院场景。可分别切换人物与背景。',character:{atlases:{main:'character.png'},referenceHeight:72,actions:clips},scene:{background:'background.png',fit:'cover',color:'#233f54',centerX:.52,footY:.94,scale:1}}
const files={'manifest.json':strToU8(JSON.stringify(manifest,null,2)),'character.png':character.png(),'background.png':background.png()}
await mkdir('examples/mint-robot',{recursive:true})
for(const [name,data] of Object.entries(files))await writeFile(`examples/mint-robot/${name}`,data)
await writeFile('examples/mint-robot.toons.zip',zipSync(files,{level:6}))
console.log('Created examples/mint-robot.toons.zip')

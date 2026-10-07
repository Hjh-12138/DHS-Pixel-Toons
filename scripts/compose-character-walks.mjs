import sharp from 'sharp';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(project,'work/character-walks');
const rigs=JSON.parse(await readFile(path.join(project,'design/character-limb-rigs.json'),'utf8'));
const bob=[0,1,0,-1,0,1,0,-1],floor=442;
// Each leg includes its ORIGINAL shaft, ankle and shoe. One continuous
// displacement reaches the original ankle, then translates the whole shoe.
// No independently scaled foot and no copied edge-colour hip padding.
const gait=[
 [[-4,0],[4,-1]], [[-2,0],[4,-3]], [[0,0],[1,-5]], [[3,0],[-3,-1]],
 [[4,-2],[-4,0]], [[3,-4],[-2,0]], [[0,-5],[0,0]], [[-3,-2],[3,0]],
];
const sha=b=>createHash('sha256').update(b).digest('hex');
const requested=process.argv.slice(2),publish=requested.includes('--write');
const selected=requested.filter(v=>v!=='--write'),reports=[];
for(const id of selected)if(!Object.hasOwn(rigs,id))throw Error('Unknown builtin character: '+id);
for(const [id,sides]of Object.entries(rigs)){
 if(selected.length&&!selected.includes(id))continue;
 const dir=path.join(root,id),assets=path.join(project,'assets/characters',id);
 await mkdir(dir,{recursive:true});
 const manifest=JSON.parse(await readFile(path.join(assets,'manifest.json'),'utf8'));
 const frame=manifest.character.actions.idle.frames[0];
 if(frame.w!==256||frame.h!==256)throw Error(id+' requires a 256px idle cell');
 const idle=await sharp(path.join(assets,manifest.character.atlases[frame.atlas])).extract({left:frame.x,top:frame.y,width:256,height:256}).ensureAlpha().raw().toBuffer();
 await sharp(idle,{raw:{width:256,height:256,channels:4}}).png().toFile(dir+'/idle.png');
 const retained=Buffer.from(idle),masks=sides.map(()=>new Uint8Array(256*256));
 for(let side=0;side<2;side++)for(const [x0,y0,x1,y1]of sides[side].regions)
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(idle[(y*256+x)*4+3]>=128){masks[side][y*256+x]=1;retained.fill(0,(y*256+x)*4,(y*256+x)*4+4);}
 for(let at=0;at<retained.length;at+=4)if(retained[at+3]<128)retained.fill(0,at,at+4);
 const body=Buffer.alloc(512*512*4);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){const from=(Math.floor(y/2)*256+Math.floor(x/2))*4;retained.copy(body,(y*512+x)*4,from,from+4);}
 await mkdir(dir+'/frames',{recursive:true});await mkdir(dir+'/leg-layers',{recursive:true});
 await sharp(body,{raw:{width:512,height:512,channels:4}}).png().toFile(dir+'/body-fixed.png');
 const atlas=Buffer.alloc(2048*1024*4),records=[];
 for(let f=0;f<8;f++){
  const legs=Buffer.alloc(512*512*4),dst=Buffer.alloc(legs.length);
  const order=f>=4&&f<=6?[0,1]:[1,0];
  for(const side of order){
   const rig=sides[side],hip=rig.hipY*2,ankle=rig.ankleY*2,span=ankle-hip;
   const [px,py]=gait[f][side],dx=2*px,dy=2*py,delta=dy-bob[f];
   for(let y=hip+bob[f];y<=floor;y++)for(let x=80;x<370;x++){
    let sy;
    if(y>=ankle+dy)sy=y-dy;
    else sy=(y-bob[f]+delta*hip/span)/(1+delta/span);
    const w=Math.max(0,Math.min(1,(sy-hip)/span));
    const sx=Math.floor((x-dx*w)/2),iy=Math.floor(sy/2);
    if(sx<0||sx>=256||iy<0||iy>=256||!masks[side][iy*256+sx])continue;
    const from=(iy*256+sx)*4,to=(y*512+x)*4;idle.copy(legs,to,from,from+4);
   }
  }
  // All the real skirt/frills remain foreground; all the real leg pixels
  // have been removed from that foreground and move with their own shoe.
  let checked=0;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
   const at=(y*512+x)*4,by=y-bob[f];
   if(legs[at+3])legs.copy(dst,at,at,at+4);
   if(by>=0&&by<512){const from=(by*512+x)*4;if(body[from+3]){body.copy(dst,at,from,from+4);checked++;}}
  }
  const ox=f%4*512,oy=Math.floor(f/4)*512;
  for(let y=0;y<512;y++)dst.copy(atlas,((oy+y)*2048+ox)*4,y*512*4,(y+1)*512*4);
  let contact=0;for(let x=80;x<370;x++)if(dst[(floor*512+x)*4+3]>=128)contact++;
  if(!contact)throw Error(id+' lost ground contact in phase '+f);
  await sharp(dst,{raw:{width:512,height:512,channels:4}}).png().toFile(dir+'/frames/frame-'+(f+1)+'.png');
  await sharp(legs,{raw:{width:512,height:512,channels:4}}).png().toFile(dir+'/leg-layers/frame-'+(f+1)+'.png');
  records.push({frame:f+1,bob:bob[f],contact,bodyPixels:checked,legHash:sha(legs),footOffsets:gait[f]});
 }
 if(new Set(records.map(r=>r.legHash)).size!==8)throw Error(id+' repeats a phase');
 await sharp(atlas,{raw:{width:2048,height:1024,channels:4}}).png().toFile(dir+'/walk-source.png');
 for(const [name,fps,delay]of [['walk-left.gif','10','10'],['walk-left-slow.gif','4','25']]){
  const p=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',fps,'-i',dir+'/frames/frame-%d.png','-filter_complex','[0:v]split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=none:alpha_threshold=128','-frames:v','8','-loop','0','-final_delay',delay,dir+'/'+name],{encoding:'utf8',windowsHide:true});if(p.error&&p.error.code==='ENOENT'){console.warn('ffmpeg unavailable; PNG atlases and validation remain available.');break;}if(p.status)throw Error(p.error?.message||p.stderr);
 }
 const report={id,source:'original idle.png pixels',segmentation:'design/character-limb-rigs.json',legAndShoeOneConnectedSource:true,shoeScale:1,sourceFloor:floor,rootX:256,scale:.5,bodyUnchangedAcrossCycle:true,frames:records};
 await writeFile(dir+'/validation.json',JSON.stringify(report,null,2));
 await writeFile(dir+'/geometry.json',JSON.stringify({id,source:'original idle.png',limbs:sides},null,2));
 await writeFile(dir+'/rig-notes.md','# 连续腿脚动画\n\n使用原始待机图中完整的腿、脚踝和鞋作为一条肢体。腿根随完整人物层起伏，脚底固定；脚踝以下整体平移，腿部连续变形，像素颜色和鞋形保持原图。\n\n原图服装保留前景遮挡，不保留静止腿段，不生成边缘像素补腿。\n');
 reports.push(report);console.log(JSON.stringify({id,source:'original idle',contacts:records.map(r=>r.contact)}));
}
await writeFile(root+'/connected-validation.json',JSON.stringify(reports,null,2));

// Publish only after every requested character has passed the pose checks.
// Default execution writes previews to work/ and leaves shipped packs alone.
if(publish){
 const catalogPath=path.join(project,'examples/character-packs/catalog.json');
 const validationPath=path.join(project,'examples/character-packs/merge-validation.json');
 const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
 const validation=JSON.parse(await readFile(validationPath,'utf8'));
 for(const report of reports){
  const id=report.id,dir=path.join(root,id),atlas=await sharp(dir+'/walk-source.png').ensureAlpha().raw().toBuffer();
  const packed=Buffer.alloc(1024*512*4);
  for(let f=0;f<8;f++)for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const from=((Math.floor(f/4)*512+y*2)*2048+f%4*512+x*2)*4;
   const to=((Math.floor(f/4)*256+y)*1024+f%4*256+x)*4;
   atlas.copy(packed,to,from,from+4);
  }
  const png=await sharp(packed,{raw:{width:1024,height:512,channels:4}}).png().toBuffer();
  const packPath=path.join(project,'examples/character-packs',id+'.toons.zip');
  const original=await readFile(packPath),archive=unzipSync(original);
  // Keep the complete manifest and all eight other actions byte-for-byte.
  const changed=sha(archive['walk-left.png'])!==sha(png);
  if(changed){
   const backup=path.join(root,'original-packs');await mkdir(backup,{recursive:true});
   try{await writeFile(path.join(backup,id+'.toons.zip'),original,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
   archive['walk-left.png']=png;await writeFile(packPath,zipSync(archive,{level:6}));
  }
  await writeFile(path.join(project,'assets/characters',id,'walk-left.png'),png);
  for(const [source,target]of [
   [dir+'/walk-source.png','examples/character-packs/walk-sources/'+id+'.png'],
   [dir+'/body-fixed.png','design/character-walk-bodies/'+id+'.png'],
   [dir+'/leg-layers/frame-1.png','design/character-walk-legs/'+id+'.png'],
  ]){await mkdir(path.dirname(path.join(project,target)),{recursive:true});await copyFile(source,path.join(project,target));}
  const bytes=(await readFile(packPath)).length;
  catalog.find(c=>c.id===id).bytes=bytes;
  const record=validation.characters.find(c=>c.id===id);
  Object.assign(record,{source:'examples/character-packs/walk-sources/'+id+'.png',sourceHash:sha(await readFile(dir+'/walk-source.png')),sourceHeight:320,sourceFloor:floor,rootX:256,scale:.5,packBytes:bytes,standingBodyReused:true,legAndShoeOneOriginalSource:true,clothingForeground:true,bodyHash:sha(await readFile(dir+'/body-fixed.png'))});
 }
 validation.backup='work/character-walks/original-packs';
 await writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n');
 await writeFile(validationPath,JSON.stringify(validation,null,2)+'\n');
}

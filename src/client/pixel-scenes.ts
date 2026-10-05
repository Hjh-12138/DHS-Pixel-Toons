import {isGameTheme,type PixelPreset,type PixelTheme,type GameTheme} from '../presets'
import type {Action} from './animation'
import {pixelLayout,type PixelLayout} from './pixel-layout'
import {paintGameScene} from './game-scenes'
export {pixelLayout} from './pixel-layout'

type Palette={wall:string;shade:string;trim:string;wood:string;edge:string;light:string;ink:string;accent:string;floor:string}
const PALETTES:Record<Exclude<PixelTheme,GameTheme>,Palette>={
  studio:{wall:'#c6dadd',shade:'#abc5cc',trim:'#668f9e',wood:'#b79069',edge:'#655568',light:'#f6dfaa',ink:'#35546a',accent:'#7eb4bc',floor:'#8b9aa3'},
  library:{wall:'#d4bfac',shade:'#bca491',trim:'#816c75',wood:'#98755f',edge:'#4c4258',light:'#f7ddb2',ink:'#544863',accent:'#baa276',floor:'#89717b'},
  workshop:{wall:'#9bb6c8',shade:'#7f9eb5',trim:'#55748e',wood:'#9caaa9',edge:'#354864',light:'#d7e5c5',ink:'#354864',accent:'#8bc7c3',floor:'#5c748c'},
  greenhouse:{wall:'#b8d6c3',shade:'#94baaa',trim:'#608f85',wood:'#ad9c73',edge:'#47685f',light:'#e9eab3',ink:'#416556',accent:'#d3ab97',floor:'#7d9d8b'},
  observatory:{wall:'#273b61',shade:'#213352',trim:'#54688e',wood:'#687491',edge:'#172640',light:'#f4d8a9',ink:'#b0cce1',accent:'#a89cce',floor:'#3e526f'},
  harbor:{wall:'#a9d6d8',shade:'#83bdca',trim:'#538d9f',wood:'#ae8b73',edge:'#435774',light:'#f5ddb3',ink:'#3a637b',accent:'#8bafce',floor:'#918574'},
  'tea-room':{wall:'#818aab',shade:'#6d789b',trim:'#4c5f83',wood:'#ac8f89',edge:'#3b415e',light:'#f8d6a7',ink:'#d0d9e8',accent:'#ac9fbf',floor:'#786f89'},
  station:{wall:'#a9bdd2',shade:'#8da7c0',trim:'#5f809f',wood:'#929aaf',edge:'#354b6a',light:'#f5dfb4',ink:'#3e5676',accent:'#9ebdaa',floor:'#74869c'},
}
/** Crisp one/two-pixel primitives; no gradients, fractional lines or stretched rooms. */
export function paintPixelScene(g:CanvasRenderingContext2D,preset:PixelPreset,time:number,action:Action):PixelLayout {
  const theme=preset.theme
  if(isGameTheme(theme))return paintGameScene(g,{theme,mood:preset.mood},time,action)
  const W=g.canvas.width,H=g.canvas.height,L=pixelLayout(W,H,action),base=PALETTES[theme]
  const p=preset.mood==='dusk'?{...base,wall:base.shade,shade:base.trim}:base
  const r=(x:number,y:number,w:number,h:number,c:string)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
  const box=(x:number,y:number,w:number,h:number,fill:string,edge=p.edge)=>{r(x,y,w,h,edge);r(x+2,y+2,w-4,h-4,fill)}
  const dot=(x:number,y:number,c=p.light)=>r(x,y,2,2,c)
  const dash=(x:number,y:number,w:number,c=p.light)=>r(x,y,w,1,c)
  const plant=(x:number,y:number,size=1)=>{
    r(x+6*size,y-19*size,2*size,21*size,'#568875')
    r(x,y-16*size,7*size,4*size,'#709d7b');r(x+7*size,y-22*size,6*size,4*size,'#86ad86')
    r(x-3*size,y-8*size,10*size,4*size,'#588b75');r(x+7*size,y-11*size,9*size,4*size,'#78a582')
    box(x,y,14*size,10*size,p.accent);r(x+3*size,y+2*size,3*size,5*size,p.light)
  }
  const book=(x:number,y:number,h:number,c:string,w=5)=>{r(x,y,w,h,c);dash(x+1,y+3,w-2,p.light);r(x+w-1,y,1,h,p.edge)}
  const books=(x:number,y:number,count:number)=>{const cs=['#7b99b8','#b98389','#c6ad79','#79a89c','#a49bc0'];for(let i=0;i<count;i++)book(x+i*7,y-(13+i%3*3),13+i%3*3,cs[i%5]!)}
  const mug=(x:number,y:number)=>{
    r(x+2,y+2,9,9,p.light);r(x+10,y+4,4,5,p.light);r(x+11,y+5,2,3,p.wood);dash(x+2,y+1,9,p.edge)
    for(let i=0;i<2;i++){const lift=(time*.8+i*.5)%1;dot(x+4+i*5+Math.round(Math.sin(time*2+i)),y-2-lift*8,lift<.75?p.light:p.shade)}
  }
  const shelf=(x:number,y:number,w:number)=>{r(x,y,w,4,p.edge);r(x,y,w,2,p.wood);r(x+4,y+4,3,5,p.trim);r(x+w-7,y+4,3,5,p.trim)}
  const clock=(x:number,y:number)=>{
    box(x,y,18,18,p.light);r(x+3,y+3,12,12,p.wall);r(x+9,y+5,1,5,p.edge);r(x+9,y+9,4,1,p.edge);dot(x+8,y+2,p.edge)
  }
  const window=(x:number,y:number,w:number,h:number,kind:'sea'|'garden'|'stars'|'rain'|'clouds')=>{
    box(x,y,w,h,p.trim);r(x+4,y+4,w-8,h-8,kind==='stars'||kind==='rain'?'#283f68':preset.mood==='day'?'#b1dbe3':'#8298bd')
    const sea=y+h*.56
    if(kind==='stars'||kind==='rain'){
      r(x+w-22,y+10,10,10,p.light);r(x+w-19,y+8,6,14,p.light);r(x+w-16,y+8,5,9,'#283f68')
      for(let i=0;i<12;i++)if((Math.floor(time*.6)+i)%5!==0)dot(x+8+(i*19)%(w-19),y+8+(i*13)%(h-19),'#8398c1')
      if(kind==='rain')for(let i=0;i<15;i++)r(x+6+i*(w-14)/15,y+5+(i*7+time*18)%(h-13),1,4,'#7199b2')
    }else{
      r(x+w-28,y+9,11,9,p.light);r(x+w-25,y+6,5,15,p.light)
      for(let i=0;i<3;i++){const cx=x+9+(i*37+time*2)%(w-37);r(cx,y+10+i%2*7,19,4,'#deebe6');r(cx+5,y+7+i%2*7,10,3,'#deebe6')}
    }
    if(kind==='sea'){
      r(x+4,sea,w-8,h*.4-4,'#628ea9');r(x+4,sea+7,w-8,8,'#517a98')
      for(let i=0;i<7;i++)dash(x+8+(i*17+Math.floor(time*3))%(w-25),sea+3+i%3*5,11,'#a0ced2')
      r(x+12,sea-5,14,4,p.edge);r(x+14,sea-8,8,4,p.edge);dot(x+15,sea-7,'#a5c4cf')
    }
    if(kind==='garden'){
      r(x+4,y+h-17,w-8,13,'#78a18b')
      for(let i=0;i<6;i++){r(x+6+i*(w-18)/6,y+h-23+i%2*4,12,12,i%2?'#618b7c':'#8ab49c');dot(x+10+i*(w-18)/6,y+h-15,'#e1c3af')}
    }
    if(kind==='clouds'){r(x+4,y+h-16,w-8,12,'#85a7c0');r(x+4,y+h-9,w-8,5,'#7093ae')}
    r(x+w/2-1,y+3,2,h-6,p.trim);r(x+3,y+h*.58,w-6,2,p.trim);r(x-3,y+h-2,w+6,4,p.wood)
    // Stepped curtains keep the window readable at the narrowest layout.
    r(x-4,y-1,7,h-2,p.accent);r(x+w-3,y-1,7,h-2,p.accent);r(x-4,y+2,2,h-8,p.light)
  }
  const desk=(x:number,y:number,w:number)=>{
    r(x+3,y+7,w-6,2,p.shade);r(x+8,y+7,5,H-y-9,p.edge);r(x+w-13,y+7,5,H-y-9,p.edge)
    box(x,y,w,7,p.wood);dash(x+3,y+1,w-6,p.light)
  }
  const monitor=(x:number,y:number)=>{
    box(x,y,45,28,p.trim);r(x+4,y+4,37,19,'#243d57')
    for(let i=0;i<4;i++){dash(x+7,y+7+i*4,8+i%3*5,i%2?'#86b8c0':'#c4cea4');dash(x+24,y+7+i*4,8,p.trim)}
    r(x+21,y+28,3,7,p.edge);r(x+13,y+34,19,2,p.edge);dot(x+37,y+24,action==='idle'?p.trim:(Math.floor(time*2)%2?p.accent:p.light))
  }
  // Three depth bands, patterned walls, a continuous skirting board and floorboards.
  r(0,0,W,H,p.wall);r(0,0,W,5,p.edge);r(0,5,W,2,p.trim)
  for(let x=12;x<W;x+=24){r(x,8,1,H-29,p.shade);for(let y=14;y<H-33;y+=16)dot(x+8,y,p.shade)}
  r(0,H-30,W,2,p.trim);r(0,H-28,W,28,p.floor);r(0,H-28,W,2,p.edge)
  for(let y=H-20;y<H;y+=8){r(0,y,W,1,p.shade);for(let x=(y%16?15:41);x<W;x+=52)r(x,y-7,1,7,p.shade)}
  // A rug anchors the sprite, with empty space reserved above it.
  const rugX=L.centerX-87;box(rugX,H-14,174,10,p.accent);r(rugX+6,H-12,162,1,p.light)
  for(let x=rugX+8;x<rugX+166;x+=10)dot(x,H-8,p.trim)
  const left=L.left,right=L.right,cy=H-20
  switch(preset.theme){
    case 'studio':
      window(left,17,115,51,'sea');shelf(left-4,82,135);books(left+4,82,5);mug(left+63,71);plant(left+103,73,.8)
      box(right-10,17,61,49,p.shade);r(right-6,39,53,3,p.wood);books(right-3,39,6);books(right-3,61,6)
      clock(right+4,71);plant(right+33,95)
      break
    case 'library':
      window(left+12,17,101,52,'garden')
      for(const x of [15,right-7]){box(x,14,64,73,p.wood);for(let y=35;y<85;y+=23){books(x+5,y,7);shelf(x+3,y,58)}}
      r(left+15,76,37,4,p.accent);r(left+20,72,32,4,p.light);mug(left+75,78)
      break
    case 'workshop':
      box(left-7,16,128,43,p.shade);for(let x=left;x<left+112;x+=8)for(let y=23;y<53;y+=8)dot(x,y,p.trim)
      for(let i=0;i<4;i++){const x=left+9+i*26;r(x,25,3,19,p.edge);r(x-3,24,9,6,i%2?p.accent:p.light);r(x-1,42,5,6,p.wood)}
      desk(left-7,81,132);monitor(left+13,45);books(left+73,81,3);mug(left+107,70)
      box(right-8,18,61,64,p.trim);for(let y=23;y<78;y+=17){box(right-4,y,53,13,p.shade);r(right+18,y+5,10,2,p.light);dot(right+39,y+5,Math.floor(time)%2?p.accent:p.light)}plant(right+15,95)
      break
    case 'greenhouse':
      window(left-3,14,130,62,'garden');r(left+61,14,2,60,p.trim)
      shelf(left-7,85,140);plant(left+5,72,1.1);plant(left+46,75,.9);plant(left+91,70,1.3)
      box(right-12,17,70,72,p.shade);for(let y=40;y<87;y+=24){shelf(right-9,y,64);plant(right-3,y-11,.8);plant(right+28,y-10,.7)}
      // Hanging vine and blossoms.
      for(let i=0;i<7;i++){r(right-9+i*3,7+i*5,3,5,'#5b8b74');dot(right-7+i*3,11+i*5,i%2?'#8eb393':'#e1c2a9')}
      break
    case 'observatory':
      window(left-7,15,135,60,'stars');shelf(left-9,83,139);books(left-3,83,4);mug(left+39,72)
      // A stepped brass telescope and tripod, drawn behind the character bay.
      r(right-11,44,43,9,p.edge);r(right-7,43,37,7,p.accent);box(right+27,40,9,14,p.light)
      r(right+6,53,3,36,p.trim);r(right-3,78,3,16,p.trim);r(right+18,78,3,16,p.trim);r(right-6,92,8,2,p.edge);r(right+17,92,8,2,p.edge)
      box(right-5,14,28,19,p.shade);dot(right+2,20);dot(right+13,24);r(right+4,22,10,1,p.trim)
      break
    case 'harbor':
      // A covered wharf: open sea, distant islands, ropes and lanterns.
      window(left-4,15,137,59,'sea');r(left+3,62,125,2,p.wood)
      r(right-12,16,66,62,'#83b7c5');r(right-12,53,66,25,'#628ea9');for(let i=0;i<4;i++)dash(right-8+(i*17+time*3)%43,59+i*4,14,'#a3cdd2')
      r(right-15,11,5,80,p.edge);r(right+52,11,5,80,p.edge);r(right-13,68,68,4,p.wood);r(right-13,81,68,4,p.wood)
      r(right+14,11,1,12,p.edge);box(right+8,23,13,18,p.light);r(right+11,26,7,12,p.accent)
      box(left+2,86,29,18,p.wood);box(left+34,90,23,14,p.wood);r(left+6,88,2,14,p.light);r(left+37,92,2,10,p.light)
      break
    case 'tea-room':
      window(left,15,118,58,'rain');shelf(left-6,82,130);mug(left+17,71);plant(left+84,70)
      box(right-12,18,66,54,p.shade);shelf(right-10,40,62);shelf(right-10,66,62)
      for(let i=0;i<3;i++){box(right-3+i*17,29,11,10,i%2?p.accent:p.light);r(right+i*17,25,5,4,p.trim)}books(right-4,65,6)
      r(right+12,72,3,20,p.edge);r(right+6,78,16,2,p.edge);r(right+2,89,24,3,p.wood);mug(right+7,77)
      break
    case 'station':
      window(left-5,14,130,56,'clouds');r(left+1,73,118,3,p.edge)
      // Distant carriages slide inside the window rather than across the mascot.
      for(let i=0;i<3;i++){const x=left+4+(i*27+time*4)%86;box(x,53,23,9,p.trim);r(x+4,55,14,3,p.light)}
      box(right-12,17,68,31,p.edge);for(let i=0;i<3;i++){dot(right-6,23+i*7,p.light);dash(right+1,24+i*7,24,p.accent);dash(right+32,24+i*7,15,p.light)}
      clock(right+11,53);box(right-5,87,26,17,p.wood);box(right+25,83,22,21,p.accent);r(right+32,79,8,4,p.edge)
      break
  }
  // Wider strips add deliberate, repeated architecture instead of stretching props.
  if(W>680)for(let x=220;x<W-170;x+=160){
    if(Math.abs(x-L.centerX)<118)continue
    box(x,20,36,28,p.shade);r(x+5,38,25,5,p.trim);r(x+11,29,13,9,p.accent);dot(x+8,25)
    shelf(x-4,79,48);books(x+2,79,3);plant(x+31,70,.6)
  }
  if(L.prone)desk(L.centerX-84,cy+2,168)
  // A few fireflies or dust motes in the free upper area are subtle and local.
  for(let i=0;i<5;i++){const x=L.centerX-58+i*29+Math.round(Math.sin(time*.6+i)*3),y=18+i%3*8+Math.round(Math.sin(time*.8+i*2)*2);if((Math.floor(time*.7)+i)%4!==0)dot(x,y,preset.theme==='observatory'?p.light:p.shade)}
  g.canvas.dataset.theme=preset.theme;g.canvas.dataset.mood=preset.mood
  return L
}

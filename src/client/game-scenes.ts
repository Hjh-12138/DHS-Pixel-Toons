import type {GameTheme,PixelPreset} from '../presets'
import type {Action} from './animation'
import {pixelLayout,type PixelLayout} from './pixel-layout'

/** Pixel reinterpretations of four game locations, with a clear central sprite bay. */
export function paintGameScene(g:CanvasRenderingContext2D,preset:Pick<PixelPreset,'mood'>&{theme:GameTheme},time:number,action:Action):PixelLayout {
  const W=g.canvas.width,H=g.canvas.height,L=pixelLayout(W,H,action),night=preset.mood==='dusk'
  // Clip primitives at the pixel boundary, including moving petals and star trails.
  const r=(x:number,y:number,w:number,h:number,c:string)=>{
    const x0=Math.max(0,Math.round(x)),y0=Math.max(0,Math.round(y)),x1=Math.min(W,Math.round(x+w)),y1=Math.min(H,Math.round(y+h))
    if(x1<=x0||y1<=y0)return
    g.fillStyle=c;g.fillRect(x0,y0,x1-x0,y1-y0)
  }
  const dot=(x:number,y:number,c:string,size=2)=>r(x,y,size,size,c)
  const box=(x:number,y:number,w:number,h:number,fill:string,edge:string)=>{r(x,y,w,h,edge);r(x+2,y+2,w-4,h-4,fill)}
  const line=(x0:number,y0:number,x1:number,y1:number,c:string,size=1)=>{
    let x=Math.round(x0),y=Math.round(y0);const tx=Math.round(x1),ty=Math.round(y1),dx=Math.abs(tx-x),dy=-Math.abs(ty-y),sx=x<tx?1:-1,sy=y<ty?1:-1
    let err=dx+dy
    for(;;){dot(x,y,c,size);if(x===tx&&y===ty)break;const e=2*err;if(e>=dy){err+=dy;x+=sx}if(e<=dx){err+=dx;y+=sy}}
  }
  const circle=(x:number,y:number,radius:number,color:string)=>{
    for(let yy=-radius;yy<=radius;yy++)for(let xx=-radius;xx<=radius;xx++)if(xx*xx+yy*yy<=radius*radius)dot(x+xx,y+yy,color,1)
  }
  const roof=(x:number,y:number,width:number,color:string,edge:string)=>{
    for(let i=0;i<10;i++)r(x+i,y+9-i,width-i*2,1,color)
    r(x-3,y+10,width+6,3,edge);r(x-6,y+8,5,3,edge);r(x+width+1,y+8,5,3,edge)
  }
  const floor=(fill:string,seam:string,wood=false)=>{
    r(0,H-27,W,27,fill);r(0,H-27,W,2,seam)
    for(let y=H-19;y<H;y+=8){r(0,y,W,1,seam);for(let x=(y%16?18:42);x<W;x+=wood?64:36)r(x,y-7,1,7,seam)}
  }
  const bench=(x:number,y:number,width:number,fill:string,edge:string,light:string)=>{
    box(x,y,width,7,fill,edge);r(x+3,y+1,width-6,1,light);r(x+8,y+7,4,H-y-9,edge);r(x+width-12,y+7,4,H-y-9,edge)
  }
  const planter=(x:number,y:number,leaf:string,pot:string)=>{
    r(x+7,y-23,2,24,leaf);for(let i=0;i<4;i++){r(x+(i%2?8:0),y-22+i*5,9,4,leaf);dot(x+3+i*3,y-23+i*5,'#b9cfa9')}
    box(x,y,17,12,pot,'#4b5c5d')
  }
  let table='#8c735f',edge='#4e535e',light='#e5d0a4'
  switch(preset.theme){
    case 'rhodes-control':{
      const wall=night?'#1e2936':'#354554',steel=night?'#3c4b5c':'#5d6e7d',cyan='#8ad3d6',yellow='#d1b978'
      table='#677c8b';edge='#243341';light=cyan
      r(0,0,W,H,wall)
      for(let x=0;x<W;x+=74){box(x+3,6,67,73,wall,steel);r(x+8,10,55,1,'#80919d');for(let y=14;y<75;y+=15)dot(x+9,y,steel)}
      floor('#465664','#2c3d4c')
      // Rhodes Island's triangular tower motif, above the head rather than on it.
      const emblemX=L.centerX-13
      for(let y=0;y<16;y++)r(emblemX+13-Math.floor(y*.8),7+y,1+Math.floor(y*.8)*2,1,'#b9cbd0')
      r(emblemX+10,12,6,9,wall);r(emblemX+8,15,10,7,wall);r(emblemX+11,10,4,2,wall)
      const screen=(x:number,width:number)=>{
        box(x,17,width,48,'#183447','#748c9b')
        for(let xx=x+7;xx<x+width-7;xx+=12)r(xx,22,1,36,'#315267')
        for(let y=24;y<61;y+=9)r(x+5,y,width-10,1,'#315267')
        const scan=22+Math.floor(time*9)%35;r(x+5,scan,width-10,1,'#6ca7b5')
        for(let i=0;i<7;i++){const a=x+10+i*(width-25)/7,b=40+Math.sin(i*1.7+time*.5)*8;line(a,b,a+12,40+Math.sin((i+1)*1.7+time*.5)*8,cyan)}
        box(x+10,49,29,9,'#597f86','#8badb4');r(x+14,52,20,2,cyan)
        bench(x-3,70,width+6,steel,edge,cyan)
        for(let i=0;i<7;i++){r(x+6+i*13,73,8,2,i%3?'#bac6c8':yellow);dot(x+8+i*13,80,Math.floor(time*2+i)%3?cyan:steel)}
      }
      screen(L.left,132)
      const rx=W-85;box(rx,14,61,68,steel,edge)
      for(let y=21;y<75;y+=16){box(rx+5,y,51,11,wall,'#8296a1');r(rx+9,y+3,26,2,cyan);dot(rx+46,y+4,Math.floor(time*2+y)%3?cyan:yellow)}
      for(const x of [10,W-69])for(let i=0;i<7;i++)r(x+i*8,H-24,5,4,i%2?edge:yellow)
      r(0,2,W,2,'#7297a8');for(let x=20;x<W;x+=140)r(x,3,44,2,cyan)
      if(W>680)for(let x=220;x<W-140;x+=158)if(Math.abs(x-L.centerX)>120)screen(x,105)
      break
    }
    case 'astral-parlor':{
      const wood=night?'#4b3b47':'#6c4d4a',gold='#c8ac79',red='#875257',space=night?'#18253e':'#2f3b59'
      table='#846450';edge='#3a3041';light='#ead4a1'
      r(0,0,W,H,wood);box(14,7,W-28,60,space,gold)
      for(let i=0;i<Math.ceil(W/14);i++){
        const x=19+(i*47+time*2)%(W-40),y=13+(i*19)%43
        if((i+Math.floor(time*.7))%5)dot(x,y,i%3?'#7288a9':'#ddcfb4',i%3?1:2)
      }
      const planetX=L.left+57;circle(planetX,33,16,night?'#817792':'#b78fa4');circle(planetX+7,29,12,space)
      line(planetX-20,41,planetX+20,29,'#c9b9b3',2)
      for(let x=170;x<W-30;x+=140)if(Math.abs(x-L.centerX)>65){r(x,7,6,60,wood);r(x+2,7,2,60,gold)}
      r(0,68,W,14,wood);r(0,70,W,2,gold);for(let x=14;x<W;x+=34)box(x,75,23,5,wood,'#96745d')
      floor('#665158','#4e3c4c',true)
      // Long red seating and gilded side lamps establish the parlor's silhouette.
      const sofa=(x:number,width:number)=>{
        box(x,65,width,24,red,edge);r(x+5,68,width-10,12,'#a76a6b');r(x+4,81,width-8,4,'#b37c74')
        for(let k=x+22;k<x+width-9;k+=27)r(k,68,1,13,'#6d414f')
        r(x-3,77,8,16,wood);r(x+width-5,77,8,16,wood);r(x+7,89,5,6,gold);r(x+width-12,89,5,6,gold)
      }
      sofa(18,134);sofa(W-150,112)
      for(const x of [10,W-22]){r(x+5,44,2,47,gold);r(x,89,13,3,gold);r(x+1,31,11,13,'#ead6a4');r(x-1,42,15,3,gold)}
      // Pixel gramophone: record, turning indicator, and a stepped brass horn.
      const gx=W-66;box(gx,58,37,14,wood,gold);r(gx+5,55,24,3,edge);dot(gx+15+Math.cos(time*3)*5,56,gold)
      r(gx+26,44,3,14,gold);r(gx+13,35,16,12,gold);r(gx+5,31,10,20,'#e2c998');r(gx+5,33,3,16,'#725961')
      const lift=(time*7)%22;line(gx+39,61-lift,gx+39,54-lift,gold);dot(gx+36,60-lift,gold,3)
      const rugX=L.centerX-83;box(rugX,H-16,166,12,'#925c60',gold);r(rugX+5,H-13,156,1,'#c99181')
      if(W>680)for(let x=220;x<W-180;x+=160)if(Math.abs(x-L.centerX)>120){sofa(x,101);planter(x+93,75,'#758f84','#bb9b79')}
      break
    }
    case 'wuling-waterfront':{
      const sky=night?'#668595':'#b4d3cf',stone=night?'#91a5a5':'#cedbd0',teal='#477f7d',water=night?'#477c86':'#77aaa7'
      table='#a99b7b';edge='#456768';light='#e2d8ab'
      r(0,0,W,H,sky)
      // Layered mountains retain the horizon on every viewport width.
      for(let x=0;x<W;x+=16){const y=23+Math.round(Math.sin(x*.024)*8);r(x,y,16,49-y,night?'#5d7b85':'#92b6b0');r(x,39+Math.round(Math.cos(x*.033)*4),16,22,night?'#506f77':'#79a49d')}
      const pavilion=(x:number,width:number)=>{
        box(x,40,width,31,stone,teal);roof(x-3,28,width+6,teal,'#335e62')
        for(let xx=x+8;xx<x+width-6;xx+=16){box(xx,46,10,20,'#598d88','#a8c6b4');r(xx+4,47,1,18,stone)}
        r(x-6,71,width+12,4,teal)
      }
      pavilion(L.left+16,99)
      r(0,H-39,W,16,water)
      for(let i=0;i<Math.ceil(W/19);i++)r((i*29+time*4)%W,H-35+i%3*4,13,1,i%2?'#bad8cb':'#99c6c0')
      floor(night?'#889891':'#c3cbbb',night?'#6c8380':'#9eb2a8')
      r(0,H-40,W,3,'#d4dfcf');for(let x=7;x<W;x+=37){r(x,H-49,3,10,stone);r(x,H-49,12,2,teal)}
      // Bamboo beside traditional roofs, paired with a compact industrial terminal.
      for(const x of [12,W-119])for(let i=0;i<3;i++){
        const bx=x+i*9;r(bx,15+i*5,2,65-i*5,'#4d7b6c');for(let y=25;y<69;y+=11){r(bx-1,y,4,2,'#95b4a1');line(bx,y,bx+Math.round(Math.sin(time*.7+i))*2+8,y-5,'#46796d',2);line(bx,y+4,bx-7,y,'#668e76',2)}
      }
      const rx=W-91;box(rx,30,64,23,'#c3d1c9','#517e7b');r(rx+5,35,36,11,'#507d7e');r(rx+9,39,25,2,'#b1dbce')
      r(rx+49,18,5,42,'#d5ddd0');r(rx+35,18,19,4,'#c3cfbf');r(rx+35,19,3,9,'#8fa79d')
      const wx=W-45,wy=69
      circle(wx,wy,17,'#426768');circle(wx,wy,14,'#b09c78');circle(wx,wy,11,water)
      for(let i=0;i<8;i++){const a=time*.4+i*Math.PI/4;line(wx,wy,wx+Math.cos(a)*15,wy+Math.sin(a)*15,'#d0bd8f',2)}circle(wx,wy,3,'#4d6460')
      r(rx+11,55,1,10,'#425f60');box(rx+6,63,11,13,'#c08a87','#67837c');r(rx+9,66,5,7,'#e4c2a2')
      // Blossoms and drifting petals give the industrial waterfront a softer edge.
      const tx=L.left+105;r(tx,41,3,31,'#716f67');line(tx+1,46,tx-10,35,'#716f67',2)
      for(let i=0;i<8;i++)r(tx-15+(i*9)%28,27+(i*7)%18,9,7,i%2?'#dca7b3':'#ecc7c2')
      for(let i=0;i<7;i++)dot((L.left+i*41+time*5)%W,19+(i*11+time*3)%45,i%2?'#e8c4be':'#d3a0af')
      if(W>680)for(let x=220;x<W-180;x+=164)if(Math.abs(x-L.centerX)>120)pavilion(x,92)
      break
    }
    case 'mondstadt-plaza':{
      const sky=night?'#8996bb':'#a5d4e5',stone=night?'#b2b3ae':'#ddd7bd',roofColor=night?'#687d97':'#668fa4',wall=night?'#9ca9b0':'#b9c7c6'
      table='#b5986f';edge='#666e7e';light='#eee0b3'
      r(0,0,W,H,sky)
      for(let i=0;i<Math.ceil(W/100);i++){const x=(i*137+time*2)%(W+40)-20;r(x,16+i%3*8,38,4,'#d6e5e1');r(x+9,12+i%3*8,20,4,'#d6e5e1')}
      // Distant spires and a continuous crenellated city wall.
      const sx=W*.66;r(sx,32,40,35,wall);for(const x of [sx-3,sx+31]){r(x,24,12,43,stone);for(let i=0;i<12;i++)r(x+Math.floor(i/2),24-i,12-Math.floor(i/2)*2,1,roofColor);r(x+5,11,2,5,'#6c8697')}
      r(0,64,W,19,wall);for(let x=0;x<W;x+=14){r(x,59,8,5,stone);r(x+2,68,10,1,'#91a8ad');r(x+6,76,9,1,'#91a8ad')}
      const house=(x:number,width:number)=>{
        box(x,49,width,34,stone,'#8f9088');for(let i=0;i<15;i++)r(x+i,48-i,width-i*2,1,roofColor)
        r(x+5,51,2,30,'#8e8275');r(x+width-7,51,2,30,'#8e8275');r(x+3,65,width-6,2,'#8e8275')
        for(let k=0;k<3;k++){box(x+12+k*15,55,8,8,night?'#e8c98d':'#7ba6bb','#918575');dot(x+14+k*15,56,'#cad6ca',1)}
        box(x+width/2-6,70,12,13,'#8e8170','#756e6b')
      }
      house(W-103,68)
      // Four lattice blades rotate on the iconic timber/stone windmill.
      const mx=L.left+47,my=33
      box(mx-13,28,26,56,stone,'#9ba69c');r(mx-8,54,16,3,'#a4ae9d');box(mx-6,68,12,16,'#8c8272','#747b76')
      for(let i=0;i<13;i++)r(mx-17+i,27-i,34-i*2,1,'#8e6e66')
      for(let i=0;i<4;i++){
        const a=time*.45+i*Math.PI/2,dx=Math.cos(a),dy=Math.sin(a),px=-dy,py=dx
        line(mx,my,mx+dx*25,my+dy*25,'#9f896b',2)
        for(let d=13;d<=25;d+=3)line(mx+dx*d-px*4,my+dy*d-py*4,mx+dx*d+px*4,my+dy*d+py*4,'#e9ddbd',2)
        line(mx+dx*12-px*4,my+dy*12-py*4,mx+dx*25-px*4,my+dy*25-py*4,'#b29c7b')
      }
      circle(mx,my,3,'#877f70')
      floor(night?'#a1aaae':'#c9d1c7',night?'#8898a0':'#a3b5b7')
      // Low fountain and flower boxes sit outside the sprite's reserved bay.
      const fx=L.centerX-119;box(fx-21,91,43,10,'#8cacba','#93a3a2');r(fx-25,96,51,4,stone);r(fx-3,81,6,12,stone);r(fx-11,86,22,3,'#bad8d4')
      for(let i=0;i<3;i++){const y=80+(time*10+i*4)%11;dot(fx-8+i*7,y,'#d0e9df');r(fx-10+i*9,98,5,1,'#b9dcd3')}
      for(let i=0;i<4;i++){const x=W-77+i*12;r(x+3,84,1,10,'#648679');circle(x+3,82,3,i%2?'#bdc6d8':'#dbb6c2');dot(x+3,81,'#efdaa7',1)}
      box(W-80,94,50,9,'#a3937d','#7c8581')
      for(let i=0;i<7;i++){const x=(i*61+time*7)%W,y=18+(i*9+Math.sin(time+i)*3)%42;dot(x,y,'#e8e9d0',1);line(x-2,y+1,x+2,y+1,'#d0e0cf')}
      if(W>680)for(let x=230;x<W-160;x+=158)if(Math.abs(x-L.centerX)>120)house(x,62)
      break
    }
  }
  // Shadow and a matching work bench preserve the existing prone animations.
  r(L.centerX-30,H-7,60,3,edge)
  if(L.prone)bench(L.centerX-84,H-18,168,table,edge,light)
  g.canvas.dataset.theme=preset.theme;g.canvas.dataset.mood=preset.mood
  return L
}

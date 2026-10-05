import type {SceneDirection,SceneProp} from '../scene-plan'
import {wrapText,textWidth} from '../engine/text'

/** Catalog props occupy the side bays; every primitive stays on whole pixels. */
export function paintDirection(g:CanvasRenderingContext2D,direction:SceneDirection,time:number):void {
  const W=g.canvas.width,H=g.canvas.height
  const dark=direction.mood==='dusk',edge='#34445d',light=dark?'#c7d7e0':'#edf4ed',blue=dark?'#547dab':'#719ac3',gold='#d5b578'
  const r=(x:number,y:number,w:number,h:number,color:string)=>{
    const x0=Math.max(0,Math.round(x)),y0=Math.max(0,Math.round(y)),x1=Math.min(W,Math.round(x+w)),y1=Math.min(H,Math.round(y+h))
    if(x1>x0&&y1>y0){g.fillStyle=color;g.fillRect(x0,y0,x1-x0,y1-y0)}
  }
  const prop=(p:SceneProp)=>{
    const x=p.slot==='left'?20:W-52,y=H-19
    r(x-3,y+3,38,3,edge);r(x-1,y+3,34,1,gold)
    switch(p.kind){
      case 'rice-bowl':
        r(x+1,y-12,29,4,edge);r(x+3,y-11,25,4,light);r(x+5,y-14,20,3,'#fcf4dd');r(x+7,y-16,16,2,light)
        r(x+4,y-7,23,5,blue);r(x+7,y-2,17,3,light)
        g.fillStyle=light;g.font='9px "Microsoft YaHei",sans-serif';g.fillText('饭',x+11,y-8,10)
        break
      case 'token-cookie':
        r(x+3,y-17,23,17,edge);r(x+5,y-19,19,21,gold);r(x+3,y-14,23,11,'#c9975e')
        for(const [dx,dy] of [[7,-12],[17,-15],[12,-5],[21,-7]])r(x+dx!,y+dy!,2,2,'#775a4e')
        r(x+6,y-17,10,2,'#eed19b');break
      case 'watermelon':
        r(x+1,y-3,30,5,'#3c7563');r(x+4,y-7,24,5,'#91b589');r(x+6,y-15,20,9,'#cd7d85');r(x+10,y-19,12,4,'#e3a09c')
        for(let i=0;i<4;i++)r(x+10+i*4,y-11+i%2*3,1,2,edge);break
      case 'memory-jelly':
        r(x+5,y-3,23,5,edge);r(x+7,y-16,19,14,blue);r(x+10,y-20,13,4,'#97ced1');r(x+10,y-14,3,9,light)
        for(let i=0;i<3;i++)r(x+17+i*3,y-10,1,2,'#bfdfd4');break
      case 'book':
        r(x+1,y-5,29,7,edge);r(x+3,y-6,25,5,light);r(x+1,y-8,29,2,blue);r(x+14,y-6,2,6,gold)
        r(x+4,y-4,7,1,'#9bafbd');r(x+19,y-4,6,1,'#9bafbd');break
      case 'terminal':
        r(x,y-27,32,23,edge);r(x+2,y-25,28,18,'#22394e');r(x+3,y-24,26,1,blue)
        for(let i=0;i<3;i++){r(x+5,y-21+i*5,3,1,gold);r(x+11,y-21+i*5,8+i*3,1,'#94c2c1')}
        r(x+14,y-4,4,4,blue);r(x+8,y,16,2,edge);break
      case 'server':
        r(x+3,y-37,26,39,edge);r(x+5,y-35,22,35,blue)
        for(let i=0;i<3;i++){r(x+7,y-32+i*11,18,8,'#455e78');r(x+9,y-29+i*11,8,1,light);r(x+21,y-29+i*11,2,2,(Math.floor(time*2+i)%3)?'#99cfc1':gold)}
        break
      case 'lantern':
        r(x+14,y-34,2,10,edge);r(x+8,y-25,15,3,edge);r(x+7,y-22,17,19,gold);r(x+10,y-20,11,14,dark?'#f0d292':light)
        r(x+15,y-20,1,14,'#bc9465');r(x+8,y-3,15,3,edge);break
    }
  }
  for(const p of direction.props)prop(p)
  for(const effect of direction.effects){
    switch(effect){
      case 'steam':{
        const slots=direction.props.length?direction.props.map(p=>p.slot):['left']
        for(const slot of slots)for(let i=0;i<3;i++){const lift=(time*.4+i/3)%1;const x=(slot==='left'?36:W-36)+Math.sin(time*1.5+i)*3;r(x,H-43-lift*16,2,3,light)}
        break
      }
      case 'scan':
        for(const x of [16,W-54]){r(x,36+Math.floor(time*9)%30,38,1,'#9cd3ce');r(x,34,1,34,blue)}break
      case 'rain':
        for(let i=0;i<14;i++){const x=i<7?8+i*7:W-51+(i-7)*7;r(x,8+(time*23+i*9)%67,1,4,'#9ab3cf')}break
      case 'fireflies':
      case 'sparkles':
      case 'bubbles':
        for(let i=0;i<8;i++){
          const x=i<4?10+i*12+Math.sin(time*.7+i)*3:W-51+(i-4)*12+Math.sin(time*.7+i)*3,y=14+(i*13-time*6+900)%57
          const c=effect==='sparkles'?gold:effect==='bubbles'?'#a0cad8':'#c9d7a8'
          if(effect==='bubbles'){r(x,y,4,1,c);r(x,y+3,4,1,c);r(x,y+1,1,2,c);r(x+3,y+1,1,2,c)}
          else if((Math.floor(time*2)+i)%4!==0){r(x,y,2,2,c);if(effect==='sparkles'){r(x-1,y+1,4,1,c);r(x+1,y-1,1,4,c)}}
        }
        break
    }
  }
  if(g.canvas.dataset){g.canvas.dataset.sceneOrigin='model';g.canvas.dataset.sceneProps=direction.props.map(p=>p.kind).join(',');g.canvas.dataset.sceneEffects=direction.effects.join(',')}
}

/** Speech uses fine canvas pixels, independently of the legacy character grid. */
export function paintDirectionBubble(g:CanvasRenderingContext2D,say:string):void {
  if(!say)return
  const W=g.canvas.width,cols=Math.max(10,Math.floor((W-32)/5)),lines=wrapText(say,Math.min(48,cols))
  const width=Math.min(W-16,Math.max(...lines.map(textWidth))*5+16),height=lines.length*12+10,x=Math.round((W-width)/2),y=3
  g.fillStyle='#3c526a';g.fillRect(x,y,width,height)
  g.fillStyle='#edf4ee';g.fillRect(x+1,y+1,width-2,height-2)
  g.fillStyle='#3c526a';g.fillRect(Math.round(W*.52)-2,y+height,5,3)
  g.font='10px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';g.textBaseline='top';g.fillStyle='#243c52'
  lines.forEach((line,index)=>g.fillText(line,x+8,y+5+index*12,width-16))
}

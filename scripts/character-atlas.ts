export type Pixels={pixels:Uint8ClampedArray;width:number;height:number}
export type Bounds={x:number;y:number;w:number;h:number}
const median=(a:number[])=>{const b=[...a].sort((x,y)=>x-y);return (b[Math.floor((b.length-1)/2)]!+b[Math.floor(b.length/2)]!)/2}

/** Each column has its own row gutters; a raised hand cannot cut another column's head. */
export function registerAtlas(p:Pixels,rows:number,standingRows:readonly number[],columns=4,dropBoundaryArtifacts=false){
 const frames:{crop:Bounds;anchorX:number;anchorY:number}[]=[]
 for(let index=0;index<rows*columns;index++){
  const col=index%columns,row=Math.floor(index/columns),x0=Math.round(col*p.width/columns),x1=Math.round((col+1)*p.width/columns)
  const blocked=dropBoundaryArtifacts?new Uint8Array((x1-x0)*(Math.ceil((row+1)*p.height/rows)-Math.floor(row*p.height/rows))):undefined
  if(blocked){
   const yStart=Math.floor(row*p.height/rows),yEnd=Math.ceil((row+1)*p.height/rows),localW=x1-x0,localH=yEnd-yStart,seen=new Uint8Array(blocked.length)
   for(let ly=0;ly<localH;ly++)for(let lx=0;lx<localW;lx++){
    const li=ly*localW+lx;if(seen[li]||p.pixels[((yStart+ly)*p.width+x0+lx)*4+3]!<=80)continue
    const queue=[li];seen[li]=1;let touchesVertical=false
    for(let q=0;q<queue.length;q++){
     const at=queue[q]!,x=at%localW,y=Math.floor(at/localW)
     if(x===0||x===localW-1)touchesVertical=true
     for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||nx>=localW||ny<0||ny>=localH)continue;const ni=ny*localW+nx;if(seen[ni]||p.pixels[((yStart+ny)*p.width+x0+nx)*4+3]!<=80)continue;seen[ni]=1;queue.push(ni)}
    }
    // Keep a legitimate oversized pose if it reaches a cell edge; remove only small bleed from a neighbor.
    if(touchesVertical&&queue.length<5000)for(const at of queue)blocked[at]=1
   }
  }
  const counts=new Uint32Array(p.height)
  for(let y=0;y<p.height;y++)for(let x=x0;x<x1;x++)if(!blocked||!blocked[(y-Math.floor(row*p.height/rows))*(x1-x0)+(x-x0)])if(p.pixels[(y*p.width+x)*4+3]!>80)counts[y]++
  const seam=(expected:number)=>{
   const radius=p.height/rows*.22;let chosen=Math.round(expected),best=Infinity,distance=Infinity
   for(let y=Math.max(1,Math.floor(expected-radius));y<Math.min(p.height-1,expected+radius);y++){
    const d=Math.abs(y-expected);if(counts[y]!<best||counts[y]===best&&d<distance){chosen=y;best=counts[y]!;distance=d}
   }
   return chosen
  }
  const y0=row?seam(row*p.height/rows):0,y1=row===rows-1?p.height:seam((row+1)*p.height/rows)
  let left=x1,right=x0,top=y1,bottom=y0
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if((!blocked||!blocked[(y-Math.floor(row*p.height/rows))*(x1-x0)+(x-x0)])&&p.pixels[(y*p.width+x)*4+3]!>80){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  if(right<=left||bottom<=top)throw new Error(`Empty source sprite ${index+1}`)
  const crop={x:left,y:top,w:right-left+1,h:bottom-top+1}
  frames.push({crop,anchorX:(col+.5)*p.width/columns-crop.x,anchorY:crop.h})
 }
 const referenceHeight=median(standingRows.flatMap(row=>frames.slice(row*columns,(row+1)*columns).map(f=>f.crop.h)))
 return {frames,referenceHeight}
}

/** Search below the hem and around the hips, excluding a tail at the outer edge. */
export function shoeContact(p:Pixels,crop:Bounds,rootX:number,bodyHeight:number){
 const left=Math.max(crop.x,Math.floor(rootX-bodyHeight*.20)),right=Math.min(crop.x+crop.w,Math.ceil(rootX+bodyHeight*.20))
 let bottom=-1
 for(let y=Math.floor(crop.y+crop.h*.72);y<crop.y+crop.h;y++)for(let x=left;x<right;x++)if(p.pixels[(y*p.width+x)*4+3]!>200)bottom=y
 if(bottom<0)throw new Error('No shoe contact found in the lower body region')
 return {y:bottom+1,left,right}
}

/** Geometry-only measurement: color changes, skirts and outer tails cannot pass a shoe test. */
export function walkGeometry(p:Pixels,frame:Bounds,baseline:number,bodyHeight:number){
 const rootX=frame.x+frame.w/2,contact=shoeContact(p,frame,rootX,bodyHeight),floor=contact.y-1
 let left=Infinity,right=-Infinity,run=0,runs:number[]=[]
 const mask=[]
 for(let y=floor-Math.round(bodyHeight*.085);y<=floor;y++)for(let x=contact.left;x<contact.right;x++){
  const ink=p.pixels[(y*p.width+x)*4+3]!>200;mask.push(ink?1:0)
  if(ink){left=Math.min(left,x);right=Math.max(right,x)}
 }
 for(let x=contact.left;x<contact.right;x++){
  const ink=p.pixels[(floor*p.width+x)*4+3]!>200||p.pixels[((floor-1)*p.width+x)*4+3]!>200
  if(ink)run++;else if(run){runs.push(run);run=0}
 }
 if(run)runs.push(run)
 return {bottom:floor-frame.y,groundGap:baseline-(contact.y-frame.y),footSpan:right-left+1,flatContact:Math.max(0,...runs),soleRuns:runs,mask}
}

/** Compare the boot and lower-leg silhouette to the neutral first pose. Wide costume hems stay mostly constant. */
export function lowerBodyPoseDifference(p:Pixels,neutral:Bounds,other:Bounds,baseline:number,bodyHeight:number){
 let changed=0,occupied=0
 const from=Math.round(baseline-bodyHeight*.169),to=Math.round(baseline)
 const left=Math.round(-bodyHeight*.35),right=Math.round(bodyHeight*.30)
 for(let y=from;y<=to;y++)for(let dx=left;dx<right;dx++){
  const ax=Math.round(neutral.x+neutral.w/2)+dx,bx=Math.round(other.x+other.w/2)+dx
  const a=p.pixels[((neutral.y+y)*p.width+ax)*4+3]!>200
  const b=p.pixels[((other.y+y)*p.width+bx)*4+3]!>200
  if(a!==b)changed++
  if(a||b)occupied++
 }
 return occupied?changed/occupied:0
}

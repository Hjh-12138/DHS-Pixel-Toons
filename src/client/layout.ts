/**
 * Grid geometry for the animation stage.
 *
 * A scene is drawn on a character grid whose cells are 8x14 pixels in the canvas
 * bitmap (one terminal cell, the ratio the pixel scenes were authored for). The
 * canvas is then stretched to the conversation column's width, so a fixed column
 * count would make the strip taller on a wider window and push the reply out of
 * view. Trading columns for rows instead keeps one height: on screen a cell is
 * about CELL_PX wide, whatever the window does.
 */
export const CELL_W=8,CELL_H=14,GRID_ROWS=8,CELL_PX=12

/** Column count that keeps the stage near its target height for a stage `width` px wide. */
export function stageColumns(width:number):number {
  if(!Number.isFinite(width)||width<=0)return 90
  return Math.max(36,Math.min(240,Math.round(width/CELL_PX)))
}

/** Canvas bitmap that matches the grid, so `paint` always works in 8x14 cells. */
export function bitmapSize(cols:number,rows:number=GRID_ROWS):{width:number;height:number} {
  return {width:cols*CELL_W,height:rows*CELL_H}
}

/** Rendered stage height once the bitmap is stretched to the stage width. */
export function stageHeight(width:number):number {
  const cols=stageColumns(width)
  return (width*bitmapSize(cols).height)/bitmapSize(cols).width
}

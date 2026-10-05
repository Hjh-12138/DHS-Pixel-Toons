import type {Phase} from './engine/library'

export const GAME_THEMES=['rhodes-control','astral-parlor','wuling-waterfront','mondstadt-plaza'] as const
export type GameTheme=typeof GAME_THEMES[number]
export const isGameTheme=(theme:string):theme is GameTheme=>(GAME_THEMES as readonly string[]).includes(theme)
export const PIXEL_THEMES=['studio','library','workshop','greenhouse','observatory','harbor','tea-room','station',...GAME_THEMES] as const
export type PixelTheme=typeof PIXEL_THEMES[number]
export const isPixelTheme=(value:unknown):value is PixelTheme=>typeof value==='string'&&(PIXEL_THEMES as readonly string[]).includes(value)
export type PixelPreset={theme:PixelTheme;mood:'day'|'dusk'}
export const THEME_NAMES:Record<PixelTheme,string>={studio:'海风书桌',library:'窗边书阁',workshop:'像素工坊',greenhouse:'玻璃花房',observatory:'星空观测室',harbor:'鲸鱼港湾','tea-room':'雨夜茶室',station:'云端车站','rhodes-control':'明日方舟 · 罗德岛控制中枢','astral-parlor':'星穹铁道 · 列车观景车厢','wuling-waterfront':'终末地 · 武陵水畔','mondstadt-plaza':'原神 · 蒙德风车广场'}
const TASK_THEMES:Record<Phase,readonly PixelTheme[]>={
  thinking:['tea-room','observatory','astral-parlor','mondstadt-plaza'],reading:['library','studio','rhodes-control','astral-parlor'],editing:['workshop','studio','rhodes-control','wuling-waterfront'],
  writing:['studio','library','astral-parlor','mondstadt-plaza'],searching:['library','greenhouse','wuling-waterfront','mondstadt-plaza'],testing:['workshop','greenhouse','rhodes-control'],
  building:['workshop','station','wuling-waterfront'],running:['station','harbor','wuling-waterfront'],git:['studio','workshop','rhodes-control'],
  web:['observatory','harbor','astral-parlor','mondstadt-plaza'],agents:['station','greenhouse','rhodes-control','astral-parlor'],
}

/** Each deck owns its rotation; every shipped theme is drawn on a real pixel grid. */
export class PixelDeck {
  private cursor=Math.floor(Math.random()*PIXEL_THEMES.length*2)
  constructor(private all=false,private theme?:PixelTheme){}
  next(phase:Phase):PixelPreset {
    const choices=this.theme?[this.theme]:this.all?PIXEL_THEMES:TASK_THEMES[phase]
    const index=this.cursor++
    return {theme:choices[index%choices.length]!,mood:Math.floor(index/choices.length)%2?'dusk':'day'}
  }
}

import type { Phase } from './engine/library'
import {PixelDeck,PIXEL_THEMES,THEME_NAMES,type PixelPreset,type PixelTheme} from './presets'
import { cleanScript, stage, type Script } from './engine/script'
import type {SceneDirection} from './scene-plan'

export type SceneSpec = { concept: string; raw: unknown; stock: boolean; preset?:PixelPreset;direction?:SceneDirection }
export const stockCount = PIXEL_THEMES.length*2
/** Shuffled scene decks stay instance-local so independent sessions never share state. */
export class SceneDeck {
  private dealer:PixelDeck
  constructor(styles: readonly string[] = ['pixel art'],theme?:PixelTheme) { this.dealer = new PixelDeck(styles.includes('all')||styles.includes('3D'),theme) }
  next(phase: Phase,what: string): SceneSpec {
    const preset=this.dealer.next(phase),task=[...what].slice(0,32).join('')
    const concept=THEME_NAMES[preset.theme]+(preset.mood==='dusk'?' · 暮色':' · 日光')+(task?` · ${task}`:'')
    return {concept,stock:true,preset,raw:{concept,code:'function frame(){clawd(w/2-7,0,{arms:"down"});}',actors:[],particles:[],background:{effect:'waves',palette:['#12254a','#244887','#6fa7db'],speed:0,intensity:0}}}
  }
}

/** Validate model JSON and execute a few bounded frames before admitting a live scene. */
export function validateScene(raw: unknown): Script {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('Scene must be a JSON object')
  const r = raw as Record<string,unknown>
  if (typeof r.concept !== 'string' || r.concept.length>400 || typeof r.code!=='string' || r.code.length>20000) throw new Error('Invalid scene concept or code')
  if (!Array.isArray(r.actors)||r.actors.length>20||!Array.isArray(r.particles)||r.particles.length>6) throw new Error('Invalid actor or particle count')
  const script = cleanScript(raw)
  if (!script) throw new Error('Scene could not be parsed')
  let seen = false
  for (const t of [0,0.5,2]) {
    stage({cols:90,rows:14,t,script,since:t*1000,reveal:1,onMascot:()=>{seen=true}})
    if (script.code?.error) throw new Error(script.code.error)
  }
  if (!seen) throw new Error('Scene must use the fixed mascot')
  const fresh=cleanScript(raw)
  if (!fresh) throw new Error('Scene could not be reset')
  return fresh
}

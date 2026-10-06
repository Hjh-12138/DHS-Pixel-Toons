import {CLIPS} from '../../src/client/animation'
import type {AnimationSheet,AnimationSprites} from '../../src/client/sprite'
export function animationFixture(sheet:AnimationSheet,overrides:Partial<AnimationSprites>={}):AnimationSprites{
 return {...Object.fromEntries(Object.keys(CLIPS).map(action=>[action,sheet])),...overrides} as AnimationSprites
}

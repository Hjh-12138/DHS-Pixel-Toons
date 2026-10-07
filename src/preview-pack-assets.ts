// Preview only. The production client gets the selected ZIP from the local Host.
import silverUrl from '../examples/character-packs/silver-music.toons.zip'
import purpleUrl from '../examples/character-packs/purple-star-cat.toons.zip'
import orangeUrl from '../examples/character-packs/orange-flower.toons.zip'
import blueUrl from '../examples/character-packs/blue-fan.toons.zip'
import blondeUrl from '../examples/character-packs/blonde-goth.toons.zip'
import blackUrl from '../examples/character-packs/black-beast.toons.zip'
const archives=new Map([
  ['builtin-silver-music',silverUrl],['builtin-purple-star-cat',purpleUrl],['builtin-orange-flower',orangeUrl],
  ['builtin-blue-fan',blueUrl],['builtin-blonde-goth',blondeUrl],['builtin-black-beast',blackUrl],
])
export function previewBuiltinArchive(id:unknown){
  if(typeof id!=='string'||!archives.has(id))throw new Error('Builtin character unavailable')
  return {id,archive:archives.get(id)!.split(',')[1]!}
}

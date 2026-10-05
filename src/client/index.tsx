import type {Context} from '@deepseek-ai/cordis'
import type {PropsRuntime,PropsLocale,InjectFace,HostObservable} from '@deepseek-ai/dsh-client-ui-slots'
import type {SessionEventWindow} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {ConnectionHandle} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import {Strip,type Rpc} from './Strip'
import {en,zh,type ToonsKey} from './locales'
import {useSyncExternalStore} from 'react'

declare module '@deepseek-ai/dsh-client-ui-slots'{interface LocaleNamespaceMap{toons:ToonsKey}}
declare module '@deepseek-ai/cordis'{interface Context{connection:ConnectionHandle}}
type Business={events:HostObservable<SessionEventWindow>;call:Rpc}
type DockProps=PropsRuntime<'conversation.input.dock'>&PropsLocale<'toons'>&InjectFace<Business>
function Dock(props:DockProps){const window=useSyncExternalStore(listener=>props.events.subscribe(listener),()=>props.events.getSnapshot());const running=props.useSession(s=>s.running);return <Strip sessionId={props.sessionId} running={running} events={window.entries.map(e=>e.event)} call={props.call} t={props.t}/>}
export const inject=['slots','sessions','connection','locale']
/** Browser half registers into the existing conversation dock without replacing its shell. */
export function apply(ctx:Context):void {
  ctx.effect(()=>ctx.locale.register('toons',{en,zh}))
  ctx.slots.inject('conversation.input.dock',()=>ctx.slots.register({name:'conversation.input.dock',id:'dsh-toons',order:20,locale:'toons',inject:(sessionId):Business=>{
    const binding=ctx.sessions.binding(sessionId);if(!binding)throw new Error('Toons session is unavailable')
    return {events:binding.eventSource,call:(endpoint,payload,signal)=>ctx.connection.rpc.call('/api',endpoint,payload,signal)}
  }},Dock))
}

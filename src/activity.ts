import type { Phase } from './engine/library'

/** Display state derived from Harness events; never inserted into agent messages. */
export type Activity = { phase: Phase; what: string; running: boolean; turn: number; seq: number; interesting: string; outcome: 'none'|'success'|'failed'|'canceled' }
export type ActivityEvent = { type: string; seq: number; data: unknown }
export const emptyActivity = (): Activity => ({ phase: 'thinking', what: '', running: false, turn: 0, seq: -1, interesting: '', outcome: 'none' })
const record = (v: unknown): Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {}
const text = (v: unknown): string => typeof v === 'string' ? v : ''

/** Classify a concrete tool and its arguments, including shell command families. */
export function classifyTool(name: string, raw: unknown): { phase: Phase; what: string } {
  let args = record(raw)
  if (typeof raw === 'string') { try { args = record(JSON.parse(raw)) } catch { args = {} } }
  const command = text(args.command || args.cmd || args.code)
  const normalized = name.toLowerCase()
  const what = text(args.file_path || args.path || args.pattern || args.url || args.query || command || name).replace(/[\r\n]/g,' ').slice(0,80)
  let phase: Phase = 'running'
  if (/subagent|spawn_agent|delegate/.test(normalized)) phase = 'agents'
  else if (/web|browse|fetch|search_web/.test(normalized)) phase = 'web'
  else if (/grep|glob|search|find/.test(normalized)) phase = 'searching'
  else if (/read|view|open_file|list_dir/.test(normalized)) phase = 'reading'
  else if (/edit|write|patch|replace/.test(normalized)) phase = 'editing'
  else if (/(?:^|[\s;&])git(?:\s|$)/.test(command)) phase = 'git'
  else if (/\b(test|pytest|vitest|jest|unittest)\b/.test(command)) phase = 'testing'
  else if (/\b(build|compile|tsc|make|webpack|vite)\b/.test(command)) phase = 'building'
  else if (/\b(rg|grep|find|ls|dir)\b/.test(command)) phase = 'searching'
  return {phase, what}
}

/** Fold one event window; a running lifecycle snapshot remains authoritative. */
export function activityFrom(events: readonly ActivityEvent[], running?: boolean): Activity {
  let a = emptyActivity()
  for (const e of events) {
    const d = record(e.data)
    if (e.type === 'turn/start') a = {...emptyActivity(),running:true,turn:Number(d.turn),seq:e.seq,interesting:`task:${d.turn}`}
    else if (e.type === 'user/message') {
      const content = Array.isArray(d.content) ? d.content : []
      const message = content.map(v=>text(record(v).text)).join(' ').slice(0,80)
      if (message) a.what = message
    } else if (e.type === 'tool/call') {
      const tool = classifyTool(text(d.name),d.arguments)
      a = {...a,...tool,seq:e.seq}
    } else if (e.type === 'tool/result') {
      const result = record(d.message)
      const error = d.isError === true || result.isError === true || d.outcome === 'error'
      if (error) a = {...a,outcome:'failed',seq:e.seq,interesting:`failure:${e.seq}`}
    } else if (e.type === 'assistant/live-chunk') {
      const chunk = record(d.chunk)
      if (chunk.type === 'text-delta' && a.phase !== 'writing') a = {...a,phase:'writing',seq:e.seq}
    } else if (e.type === 'turn/end') {
      const reason = text(record(d.reason).kind) || text(d.reason)
      a = {...a,running:false,seq:e.seq,outcome:/cancel|abort|interrupt/.test(reason)?'canceled':/error|fail|blocked/.test(reason)?'failed':'success'}
    }
  }
  if (running !== undefined) a.running = running
  return a
}

import type { AgentAuditSink, AgentHandoffAudit } from "./agent-loop"

const globalKey = "__jhadinaAgentAudit"
type GlobalAudit = { events: AgentHandoffAudit[] }

function store(): GlobalAudit {
  const root = globalThis as typeof globalThis & { [globalKey]?: GlobalAudit }
  if (!root[globalKey]) root[globalKey] = { events: [] }
  return root[globalKey]
}

export class SharedAgentAuditSink implements AgentAuditSink {
  async record(event: AgentHandoffAudit): Promise<void> {
    const events = store().events
    events.push(Object.freeze({ ...event }))
    if (events.length > 250) events.splice(0, events.length - 250)
  }
}

export function getSharedAgentAuditEvents(): readonly AgentHandoffAudit[] {
  return [...store().events].reverse()
}

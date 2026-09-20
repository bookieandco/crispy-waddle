import type { AuthorizedCommunicationDispatch } from './communication-action.js'
import type { TransportIdentity } from './communication-contracts.js'

export type TransportHealth = 'healthy' | 'degraded' | 'offline'
export type TransportCapability = 'message.send' | 'store.forward'

export type TransportRoute = Readonly<{
  identity: TransportIdentity
  health: TransportHealth
  capabilities: readonly TransportCapability[]
  priority: number
}>

export class TransportRegistry {
  constructor(private readonly routes: readonly TransportRoute[]) {}

  list(): readonly TransportRoute[] { return this.routes }

  select(dispatch: AuthorizedCommunicationDispatch, required: TransportCapability = 'message.send'): TransportRoute {
    if (!dispatch.correlationId.trim() || !dispatch.intent.correlationId.trim()) throw new Error('AUTHORIZED_DISPATCH_LINEAGE_REQUIRED')
    if (dispatch.correlationId !== dispatch.intent.correlationId) throw new Error('AUTHORIZED_DISPATCH_LINEAGE_MISMATCH')
    const candidates = this.routes
      .filter(route => route.health !== 'offline' && route.capabilities.includes(required))
      .sort((a, b) => a.priority - b.priority)
    if (!candidates.length) throw new Error('COMMUNICATION_ROUTE_UNAVAILABLE')
    return candidates[0]
  }
}

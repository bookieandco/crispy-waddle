import type { AuthorizedCommunicationDispatch } from './communication-action.js'
import { createDeliveryReceipt, type DeliveryReceipt } from './delivery-evidence.js'
import type { TransportRoute } from './transport-registry.js'

export interface ReticulumBridge {
  send(input: Readonly<{ destination: string; contentRef: string; correlationId: string }>): Promise<Readonly<{ receiptRef: string }>>
}

export class ReticulumTransportAdapter {
  readonly adapter = 'reticulum'
  constructor(private readonly bridge: ReticulumBridge) {}

  supports(route: TransportRoute): boolean {
    return route.identity.adapter === this.adapter && route.health !== 'offline' && route.capabilities.includes('message.send')
  }

  async send(input: {
    dispatch: AuthorizedCommunicationDispatch
    route: TransportRoute
    receiptId: string
    occurredAt: string
  }): Promise<DeliveryReceipt> {
    if (!this.supports(input.route)) throw new Error('RETICULUM_ROUTE_UNAVAILABLE')
    if (input.dispatch.correlationId !== input.dispatch.intent.correlationId) throw new Error('RETICULUM_LINEAGE_MISMATCH')
    const result = await this.bridge.send({
      destination: input.route.identity.address,
      contentRef: input.dispatch.intent.contentRef,
      correlationId: input.dispatch.correlationId,
    })
    return createDeliveryReceipt({
      receiptId: input.receiptId,
      dispatch: input.dispatch,
      route: input.route,
      status: 'sent',
      occurredAt: input.occurredAt,
      evidenceRefs: [result.receiptRef],
    })
  }
}

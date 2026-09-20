export type TrustState = 'discovered' | 'reachable' | 'identified' | 'trusted' | 'authorized'

export type EndpointIdentity = Readonly<{
  endpointId: string
  kind: 'person' | 'device' | 'service'
  trustState: TrustState
}>

export type TransportIdentity = Readonly<{
  transportId: string
  adapter: string
  address: string
  gatewayId?: string
}>

export type CommunicationIntent = Readonly<{
  intentId: string
  correlationId: string
  actorId: string
  recipient: EndpointIdentity
  capability: 'communications.send'
  contentRef: string
  createdAt: string
}>

export function assertCommunicationIntent(input: CommunicationIntent): CommunicationIntent {
  if (!input.intentId.trim() || !input.correlationId.trim()) throw new Error('COMMUNICATION_LINEAGE_REQUIRED')
  if (!input.actorId.trim() || !input.recipient.endpointId.trim()) throw new Error('COMMUNICATION_IDENTITY_REQUIRED')
  if (input.recipient.trustState !== 'authorized') throw new Error('RECIPIENT_NOT_AUTHORIZED')
  if (input.capability !== 'communications.send') throw new Error('COMMUNICATION_CAPABILITY_INVALID')
  if (!input.contentRef.trim()) throw new Error('COMMUNICATION_CONTENT_REF_REQUIRED')
  return Object.freeze({ ...input, recipient: Object.freeze({ ...input.recipient }) })
}

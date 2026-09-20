import type { ProviderOutreachPacket } from './provider-outreach.js'

export type EngagementChannel = 'email' | 'phone' | 'portal' | 'meeting' | 'other'
export type EngagementLedgerEventType =
  | 'send_authorized'
  | 'send_recorded'
  | 'provider_response_recorded'
  | 'authorization_revoked'

export type SendAuthorization = {
  id: string
  packetId: string
  opportunityId: string
  providerId: string
  channel: EngagementChannel
  destinationRef: string
  approvedByRef: string
  approvalRef: string
  authorizedAt: string
  expiresAt?: string
  revokedAt?: string
  scope: 'single_send'
  contractAuthority: false
}

export type EngagementLedgerEvent = {
  id: string
  type: EngagementLedgerEventType
  opportunityId: string
  providerId: string
  packetId: string
  authorizationId?: string
  channel?: EngagementChannel
  destinationRef?: string
  externalMessageRef?: string
  actorRef: string
  occurredAt: string
  notes: string[]
}

export type EngagementLedger = {
  opportunityId: string
  providerId: string
  events: EngagementLedgerEvent[]
}

function clean(value: string, label: string): string {
  const result = value.trim()
  if (!result) throw new Error(`${label} is required`)
  return result
}

export function authorizeProviderSend(
  packet: ProviderOutreachPacket,
  input: {
    id: string
    channel: EngagementChannel
    destinationRef: string
    approvedByRef: string
    approvalRef: string
    expiresAt?: string
  },
  now = new Date().toISOString(),
): SendAuthorization {
  if (!packet.draftOnly || packet.sendAuthorized !== false) {
    throw new Error('Only a governed draft packet can receive send authorization')
  }
  if (clean(input.approvalRef, 'Send approval reference') === packet.approvalRef) {
    throw new Error('Send authorization must be a separate approval from outreach-draft approval')
  }
  if (input.expiresAt && Date.parse(input.expiresAt) <= Date.parse(now)) {
    throw new Error('Send authorization expiry must be in the future')
  }
  return {
    id: clean(input.id, 'Send authorization id'),
    packetId: packet.id,
    opportunityId: packet.opportunityId,
    providerId: packet.providerId,
    channel: input.channel,
    destinationRef: clean(input.destinationRef, 'Destination reference'),
    approvedByRef: clean(input.approvedByRef, 'Approver reference'),
    approvalRef: clean(input.approvalRef, 'Send approval reference'),
    authorizedAt: now,
    expiresAt: input.expiresAt,
    scope: 'single_send',
    contractAuthority: false,
  }
}

export function isSendAuthorizationActive(
  authorization: SendAuthorization,
  packet: ProviderOutreachPacket,
  now = new Date().toISOString(),
): boolean {
  return authorization.packetId === packet.id &&
    authorization.opportunityId === packet.opportunityId &&
    authorization.providerId === packet.providerId &&
    !authorization.revokedAt &&
    (!authorization.expiresAt || Date.parse(authorization.expiresAt) > Date.parse(now))
}

export function revokeSendAuthorization(
  authorization: SendAuthorization,
  now = new Date().toISOString(),
): SendAuthorization {
  if (authorization.revokedAt) return authorization
  return { ...authorization, revokedAt: now }
}

export function createEngagementLedger(packet: ProviderOutreachPacket): EngagementLedger {
  return { opportunityId: packet.opportunityId, providerId: packet.providerId, events: [] }
}

export function recordSendAuthorization(
  ledger: EngagementLedger,
  packet: ProviderOutreachPacket,
  authorization: SendAuthorization,
  actorRef: string,
  now = new Date().toISOString(),
): EngagementLedger {
  if (!isSendAuthorizationActive(authorization, packet, now)) throw new Error('Send authorization is not active for this packet')
  assertLedgerScope(ledger, packet)
  return append(ledger, {
    id: `${authorization.id}:authorized`,
    type: 'send_authorized',
    opportunityId: packet.opportunityId,
    providerId: packet.providerId,
    packetId: packet.id,
    authorizationId: authorization.id,
    channel: authorization.channel,
    destinationRef: authorization.destinationRef,
    actorRef: clean(actorRef, 'Actor reference'),
    occurredAt: now,
    notes: [],
  })
}

export function recordProviderSend(
  ledger: EngagementLedger,
  packet: ProviderOutreachPacket,
  authorization: SendAuthorization,
  input: { actorRef: string; externalMessageRef: string; notes?: string[] },
  now = new Date().toISOString(),
): EngagementLedger {
  assertLedgerScope(ledger, packet)
  if (!isSendAuthorizationActive(authorization, packet, now)) throw new Error('Active send authorization is required')
  const alreadySent = ledger.events.some((event) => event.type === 'send_recorded' && event.authorizationId === authorization.id)
  if (alreadySent) throw new Error('Single-send authorization has already been consumed')
  const authorizationRecorded = ledger.events.some((event) => event.type === 'send_authorized' && event.authorizationId === authorization.id)
  if (!authorizationRecorded) throw new Error('Send authorization must be recorded before send receipt')
  return append(ledger, {
    id: `${authorization.id}:sent`,
    type: 'send_recorded',
    opportunityId: packet.opportunityId,
    providerId: packet.providerId,
    packetId: packet.id,
    authorizationId: authorization.id,
    channel: authorization.channel,
    destinationRef: authorization.destinationRef,
    externalMessageRef: clean(input.externalMessageRef, 'External message reference'),
    actorRef: clean(input.actorRef, 'Actor reference'),
    occurredAt: now,
    notes: input.notes ?? [],
  })
}

export function recordProviderResponse(
  ledger: EngagementLedger,
  packet: ProviderOutreachPacket,
  input: { actorRef: string; externalMessageRef: string; notes?: string[] },
  now = new Date().toISOString(),
): EngagementLedger {
  assertLedgerScope(ledger, packet)
  if (!ledger.events.some((event) => event.type === 'send_recorded')) {
    throw new Error('Provider response cannot be attached before an outbound send receipt exists')
  }
  return append(ledger, {
    id: `${packet.id}:response:${ledger.events.length + 1}`,
    type: 'provider_response_recorded',
    opportunityId: packet.opportunityId,
    providerId: packet.providerId,
    packetId: packet.id,
    externalMessageRef: clean(input.externalMessageRef, 'External message reference'),
    actorRef: clean(input.actorRef, 'Actor reference'),
    occurredAt: now,
    notes: input.notes ?? [],
  })
}

function assertLedgerScope(ledger: EngagementLedger, packet: ProviderOutreachPacket): void {
  if (ledger.opportunityId !== packet.opportunityId || ledger.providerId !== packet.providerId) {
    throw new Error('Engagement ledger scope does not match outreach packet')
  }
}

function append(ledger: EngagementLedger, event: EngagementLedgerEvent): EngagementLedger {
  if (ledger.events.some((item) => item.id === event.id)) throw new Error(`Duplicate engagement ledger event: ${event.id}`)
  return { ...ledger, events: [...ledger.events, { ...event, notes: [...new Set(event.notes.map((note) => note.trim()).filter(Boolean))] }] }
}

import { isSendAuthorizationActive, type EngagementLedger, type SendAuthorization } from './engagement-ledger.js'
import type { ProviderOutreachPacket } from './provider-outreach.js'

export type GovernedProviderTransport = {
  id:string
  send(input:{channel:SendAuthorization['channel'];destinationRef:string;subject:string;body:string;idempotencyKey:string}):Promise<{externalMessageRef:string}>
}

export type ProviderTransmissionReceipt = {
  packetId:string
  opportunityId:string
  providerId:string
  authorizationId:string
  transportId:string
  externalMessageRef:string
  sentAt:string
  contractAuthority:false
  bidSubmissionAuthority:false
}

export async function transmitAuthorizedProviderPacket(input:{
  packet:ProviderOutreachPacket
  authorization:SendAuthorization
  ledger:EngagementLedger
  transport:GovernedProviderTransport
  now?:string
}):Promise<ProviderTransmissionReceipt>{
  const now=input.now??new Date().toISOString()
  if(!isSendAuthorizationActive(input.authorization,input.packet,now))throw new Error('Active packet-scoped send authorization is required')
  const authorized=input.ledger.events.some(e=>e.type==='send_authorized'&&e.authorizationId===input.authorization.id)
  if(!authorized)throw new Error('Send authorization receipt must be recorded before transport')
  const consumed=input.ledger.events.some(e=>e.type==='send_recorded'&&e.authorizationId===input.authorization.id)
  if(consumed)throw new Error('Single-send authorization has already been consumed')
  const result=await input.transport.send({
    channel:input.authorization.channel,destinationRef:input.authorization.destinationRef,
    subject:input.packet.subject,body:input.packet.draftBody,idempotencyKey:input.authorization.id,
  })
  if(!result.externalMessageRef?.trim())throw new Error('Transport must return an external message reference')
  return {
    packetId:input.packet.id,opportunityId:input.packet.opportunityId,providerId:input.packet.providerId,
    authorizationId:input.authorization.id,transportId:input.transport.id,externalMessageRef:result.externalMessageRef.trim(),
    sentAt:now,contractAuthority:false,bidSubmissionAuthority:false,
  }
}

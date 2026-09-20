import {
  isSendAuthorizationActive,
  recordProviderSend,
  type EngagementLedger,
  type ProviderOutreachPacket,
  type SendAuthorization,
} from '@jhadina/opportunity-core'

export type SamOutboundSendRequest = {
  packet:ProviderOutreachPacket
  authorization:SendAuthorization
  ledger:EngagementLedger
  actorRef:string
  now?:string
}

export type SamOutboundSendReceipt = {
  authorizationId:string
  packetId:string
  providerId:string
  channel:SendAuthorization['channel']
  destinationRef:string
  externalMessageRef:string
  sentAt:string
}

export interface SamOutboundTransport{
  send(input:{channel:SendAuthorization['channel'];destinationRef:string;subject:string;body:string}):Promise<{externalMessageRef:string}>
}

export async function executeAuthorizedSamProviderSend(
  input:SamOutboundSendRequest,
  transport:SamOutboundTransport,
):Promise<{receipt:SamOutboundSendReceipt;ledger:EngagementLedger}>{
  const now=input.now??new Date().toISOString()
  if(!isSendAuthorizationActive(input.authorization,input.packet,now))throw new Error('Active single-send authorization is required')
  if(input.ledger.events.some(event=>event.type==='send_recorded'&&event.authorizationId===input.authorization.id)){
    throw new Error('Single-send authorization has already been consumed')
  }
  const body=[input.packet.purpose,...input.packet.scopeSummary,input.packet.proposedNextStep].filter(Boolean).join('\n\n')
  const result=await transport.send({
    channel:input.authorization.channel,
    destinationRef:input.authorization.destinationRef,
    subject:input.packet.subject,
    body,
  })
  if(!result.externalMessageRef.trim())throw new Error('Outbound transport must return a message receipt')
  const ledger=recordProviderSend(input.ledger,input.packet,input.authorization,{
    actorRef:input.actorRef,externalMessageRef:result.externalMessageRef,
  },now)
  return {
    receipt:{
      authorizationId:input.authorization.id,packetId:input.packet.id,providerId:input.packet.providerId,
      channel:input.authorization.channel,destinationRef:input.authorization.destinationRef,
      externalMessageRef:result.externalMessageRef,sentAt:now,
    },
    ledger,
  }
}

import type {SocialObservation} from '@jhadina/social-core'
import {ingestExternalSignal,type ExternalSignalObservation,type ExternalSignalPlatform} from '@jhadina/shark-intelligence-core/meme-trader'

const PLATFORM:Partial<Record<SocialObservation['platform'],ExternalSignalPlatform>>={
  x:'X',
  reddit:'REDDIT',
}

const textFromObservation=(observation:SocialObservation):string=>{
  const attributes=observation.attributes??{}
  const preferred=['text','body','title','caption','description','query']
    .flatMap(key=>typeof attributes[key]==='string'?[String(attributes[key])]:[])
  return [...preferred,...observation.evidence,observation.sourceUrl??'']
    .map(value=>value.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0,20_000)
}

export type SharkSocialSignalBridgeInput=Readonly<{
  observation:SocialObservation
  sourceHandle?:string
  channelId?:string
  availableAt?:string
}>

/**
 * Bridges already-governed Social observations into SHARK's evidence-only
 * external-signal contract. It never reads a provider directly and never
 * promotes a social observation into execution authority.
 */
export function socialObservationToSharkSignal(input:SharkSocialSignalBridgeInput):ExternalSignalObservation|null{
  const platform=PLATFORM[input.observation.platform]
  if(!platform)return null
  const text=textFromObservation(input.observation)
  if(!text)return null
  const sourceHandle=(input.sourceHandle??input.observation.providerProfileId??input.observation.accountId??input.observation.source).trim()
  if(!sourceHandle)return null
  return ingestExternalSignal({
    observationId:`social:${input.observation.id}`,
    platform,
    sourceHandle,
    channelId:input.channelId,
    text,
    observedAt:input.observation.observedAt,
    availableAt:input.availableAt??input.observation.observedAt,
  })
}

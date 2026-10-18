import type {SocialObservation} from '@jhadina/social-core'
import {
  ingestExternalSignal, createAlphaEvidenceV2,
  type ExternalSignalObservation, type ExternalSignalPlatform, type AlphaEvidenceV2,
} from '@jhadina/shark-intelligence-core/meme-trader'

const PLATFORM:Partial<Record<SocialObservation['platform'],ExternalSignalPlatform>>={
  x:'X',
  reddit:'REDDIT',
  bluesky:'BLUESKY',
}
const textFromObservation=(observation:SocialObservation):string=>{
  const attributes=observation.attributes??{}
  const preferred=['text','body','title','caption','description','query']
    .flatMap(key=>typeof attributes[key]==='string'?[String(attributes[key])]:[])
  return [...preferred,...observation.evidence,observation.sourceUrl??'']
    .map(value=>value.trim()).filter(Boolean).join('\n').slice(0,20_000)
}

export type SharkSocialSignalBridgeInput=Readonly<{
  observation:SocialObservation
  sourceHandle?:string
  channelId?:string
  /** Actual capture time, not the content's published or source-provided time. */
  receivedAt:string
  /** SHARK decision availability, never earlier than receivedAt. */
  availableAt:string
  upstreamOriginId?:string
  contentFingerprint?:string
}>
export type AttributedSharkSocialSignal=ExternalSignalObservation & Readonly<{provenance:AlphaEvidenceV2}>

/** No provider requests or financial authority. Missing receipt clocks fail closed. */
export function socialObservationToSharkSignal(input:SharkSocialSignalBridgeInput):AttributedSharkSocialSignal|null{
  const platform=PLATFORM[input.observation.platform]
  if(!platform)return null
  const text=textFromObservation(input.observation)
  if(!text)return null
  const sourceHandle=(input.sourceHandle??input.observation.providerProfileId??input.observation.accountId??input.observation.source).trim()
  if(!sourceHandle)return null
  const provenance=createAlphaEvidenceV2({
    sourceEventId:input.observation.contentId??input.observation.id,
    sourceFamily:'SOCIAL',
    sourceHandle,
    sourceUrl:input.observation.sourceUrl,
    originalEventId:input.upstreamOriginId,
    authorId:input.observation.providerProfileId,
    contentFingerprint:input.contentFingerprint,
    occurredAt:input.observation.observedAt,
    publishedAt:input.observation.observedAt,
    receivedAt:input.receivedAt,
    availableAt:input.availableAt,
    evidenceIds:['social:'+input.observation.id],
  })
  const signal=ingestExternalSignal({
    observationId:'social:'+input.observation.id,
    platform,sourceHandle,channelId:input.channelId,text,
    observedAt:provenance.occurredAt,availableAt:provenance.availableAt,
  })
  return Object.freeze({...signal,provenance})
}

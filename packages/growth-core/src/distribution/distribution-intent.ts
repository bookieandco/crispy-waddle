export type DistributionChannel =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'facebook'
  | 'pinterest'
  | 'x'
  | 'reddit'
  | 'search'
  | 'email'

export type DistributionIntent = {
  intentId: string
  opportunityId: string
  creativePackId: string
  channel: DistributionChannel
  contentRef: string
  scheduledFor?: string
  requestedAt: string
}

export type DistributionResult = {
  intentId: string
  channel: DistributionChannel
  status: 'published' | 'scheduled' | 'failed'
  externalId?: string
  publishedAt?: string
  errorCode?: string
}

export interface DistributionChannelAdapter {
  readonly channel: DistributionChannel
  publish(intent: DistributionIntent): Promise<DistributionResult>
}

export function createDistributionIntent(input: {
  intentId: string
  opportunityId: string
  creativePackId: string
  channel: DistributionChannel
  contentRef: string
  scheduledFor?: string
  requestedAt?: string
}): DistributionIntent {
  if (!input.intentId || !input.opportunityId || !input.creativePackId || !input.contentRef) {
    throw new Error('distribution_intent_missing_required_field')
  }
  return {
    ...input,
    requestedAt: input.requestedAt ?? new Date().toISOString(),
  }
}

/**
 * JH-ZERO-RIG.01 — Research taxonomy, not a new provider registry or earning authority.
 * All network status, payout eligibility, and earnings must be checked at observation time.
 * "No rig" means no purpose-built mining rig; a phone, browser or internet is still required.
 */
export type ZeroRigMechanism =
  | 'agent_bounty'
  | 'mobile_participation'
  | 'bandwidth_contribution'
  | 'attention_reward'
  | 'web3_quest'
  | 'paid_api_service'
export type ZeroRigRewardKind = 'competitive_award' | 'token' | 'points' | 'customer_payment'
export type ZeroRigResearchMethod = {
  id: string
  label: string
  mechanism: ZeroRigMechanism
  rewardKind: ZeroRigRewardKind
  referenceUrl: string
  equipment: 'existing_phone' | 'existing_computer' | 'existing_internet' | 'service_runtime'
  canonicalProviderId?: string
  sourceStatus: 'official_reference_only' | 'normalization_contract_ready'
  limitations: readonly string[]
  actionAuthorized: false
}

/** Candidates are not endorsements, guaranteed rewards, or commissioned integrations. */
export const ZERO_RIG_METHODS: readonly ZeroRigResearchMethod[] = [
  {
    id: 'superteam-agent-bounty', label: 'Superteam Earn agent bounties', mechanism: 'agent_bounty',
    rewardKind: 'competitive_award', referenceUrl: 'https://superteam.fun/earn/agents',
    equipment: 'existing_computer', canonicalProviderId: 'provider:superteam-earn-agents',
    sourceStatus: 'normalization_contract_ready',
    limitations: ['Agent-only/agent-allowed listings only', 'Competitive and non-guaranteed', 'Human claimant required'],
    actionAuthorized: false,
  },
  {
    id: 'nodle-mobile', label: 'Nodle mobile participation', mechanism: 'mobile_participation',
    rewardKind: 'token', referenceUrl: 'https://www.nodle.com/', equipment: 'existing_phone',
    sourceStatus: 'official_reference_only',
    limitations: ['Mobile availability and region must be verified', 'Uses existing phone radio/battery', 'Rewards may be tiny'],
    actionAuthorized: false,
  },
  {
    id: 'grass-bandwidth', label: 'Grass bandwidth contribution', mechanism: 'bandwidth_contribution',
    rewardKind: 'points', referenceUrl: 'https://www.getgrass.io/', equipment: 'existing_internet',
    sourceStatus: 'official_reference_only',
    limitations: ['Current payout scheme must be reverified', 'Bandwidth and IP reputation risk', 'Account/region restrictions'],
    actionAuthorized: false,
  },
  {
    id: 'brave-rewards', label: 'Brave Rewards', mechanism: 'attention_reward',
    rewardKind: 'token', referenceUrl: 'https://brave.com/brave-rewards/', equipment: 'existing_computer',
    sourceStatus: 'official_reference_only',
    limitations: ['Platform, wallet and regional eligibility vary', 'iOS ad earnings are unsupported'],
    actionAuthorized: false,
  },
  {
    id: 'galxe-quests', label: 'Galxe campaign quests', mechanism: 'web3_quest',
    rewardKind: 'points', referenceUrl: 'https://galxe.com/', equipment: 'existing_phone',
    sourceStatus: 'official_reference_only',
    limitations: ['Points are not money', 'Claim/gas fees may exceed rewards', 'No sybil or fake-account farming'],
    actionAuthorized: false,
  },
  {
    id: 'x402-services', label: 'x402 digital services', mechanism: 'paid_api_service',
    rewardKind: 'customer_payment', referenceUrl: 'https://www.x402.org/', equipment: 'service_runtime',
    sourceStatus: 'official_reference_only',
    limitations: ['Needs real customers', 'Paid hosting and per-call inference costs', 'No payment execution authorized'],
    actionAuthorized: false,
  },
] as const

export const getZeroRigMethod = (id: string): ZeroRigResearchMethod | undefined =>
  ZERO_RIG_METHODS.find(method => method.id === id)

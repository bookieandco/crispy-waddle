export type DomainId =
  | 'overageos'
  | 'musicos'
  | 'tvos'
  | 'directoros'
  | 'podcastos'
  | 'campaignos'
  | 'commerce'
  | 'creator-workstation';

export type ApprovalState = 'draft' | 'ready_for_review' | 'approved' | 'rejected';

export interface JhadinaProject {
  id: string;
  name: string;
  domain: DomainId;
  version: number;
  status: ApprovalState;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface CapabilityRequest<TInput = unknown> {
  id: string;
  projectId?: string;
  domain: DomainId;
  capability: string;
  input: TInput;
  requestedAt: string;
  requiresApproval: boolean;
}

export interface CapabilityResult<TOutput = unknown> {
  requestId: string;
  ok: boolean;
  output?: TOutput;
  error?: { code: string; message: string };
  completedAt: string;
}

export interface JhadinaEvent<TPayload = unknown> {
  id: string;
  type: string;
  source: DomainId | 'core';
  occurredAt: string;
  projectId?: string;
  payload: TPayload;
}

export interface ApprovalRequest {
  id: string;
  action: string;
  domain: DomainId;
  projectId?: string;
  reason: string;
  createdAt: string;
  state: 'pending' | 'approved' | 'rejected';
}

export interface AuditEntry {
  id: string;
  actor: 'user' | 'jhadina' | 'system' | 'external';
  action: string;
  domain?: DomainId;
  projectId?: string;
  outcome: 'allowed' | 'denied' | 'completed' | 'failed';
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface DomainManifest {
  id: DomainId;
  displayName: string;
  capabilities: string[];
  events: string[];
  requiresApprovalFor: string[];
}

export const DOMAIN_MANIFESTS: readonly DomainManifest[] = [
  { id: 'overageos', displayName: 'OverageOS', capabilities: ['surplus.discovery', 'public-records.search', 'verification'], events: ['OVERAGE_OPPORTUNITY_CREATED', 'OVERAGE_VERIFICATION_REQUIRED', 'FOIA_REQUEST_DUE', 'FOIA_RESPONSE_RECEIVED'], requiresApprovalFor: ['consequential.outreach'] },
  { id: 'musicos', displayName: 'MusicOS', capabilities: ['catalog', 'restoration', 'production', 'mixing', 'mastering'], events: ['MUSIC_TRACK_CREATED', 'MUSIC_RESTORATION_COMPLETED'], requiresApprovalFor: ['release.publish'] },
  { id: 'tvos', displayName: 'TVOS', capabilities: ['discovery', 'research', 'production', 'distribution'], events: ['TV_CONTENT_DISCOVERED', 'TV_PROJECT_UPDATED'], requiresApprovalFor: ['publish'] },
  { id: 'directoros', displayName: 'DirectorOS', capabilities: ['screenplay', 'storyboard', 'takes', 'continuity', 'editing'], events: ['SCENE_UPDATED', 'TAKE_CREATED'], requiresApprovalFor: ['publish'] },
  { id: 'podcastos', displayName: 'PodcastOS', capabilities: ['research', 'evidence-map', 'script', 'production'], events: ['PODCAST_EPISODE_UPDATED'], requiresApprovalFor: ['publish'] },
  { id: 'campaignos', displayName: 'CampaignOS', capabilities: ['geography', 'election-data', 'organizing', 'communications'], events: ['CAMPAIGN_DATA_UPDATED', 'CAMPAIGN_TASK_CREATED'], requiresApprovalFor: ['public.publish', 'consequential.outreach'] },
  { id: 'commerce', displayName: 'Commerce', capabilities: ['product-discovery', 'product-research', 'ad-generation', 'reels'], events: ['PRODUCT_OPPORTUNITY_CREATED', 'AD_DRAFT_CREATED'], requiresApprovalFor: ['paid-ad.publish', 'affiliate.publish'] },
  { id: 'creator-workstation', displayName: 'Creator Workstation', capabilities: ['timeline', 'canvas', 'audio-mixer', 'review', 'export'], events: ['PROJECT_READY_FOR_REVIEW', 'ASSET_EXPORTED'], requiresApprovalFor: ['public.publish'] },
];

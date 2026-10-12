import type { SocialAccount } from "./types.js";
import type { SocialCharacterProfile } from "./character-profiles.js";
import {
  assertBrandVoiceProfile,
  assertChannelVoiceProfile,
  type BrandVoiceProfile,
  type ChannelVoiceProfile,
} from "./voice-profiles.js";

/**
 * SOCIAL-ID.02-.03: An account-specific, expression-only identity projection.
 * This is NOT Jhadina's PersonalityState, a publishing permit, or durable storage.
 * Storage adapters must verify actor identity and implement compare-and-swap.
 */
export interface SocialIdentityScope {
  ownerUserId: string;
  brandId: SocialAccount["brand"];
  accountId: string;
  platform: SocialAccount["platform"];
  provider: string;
  providerProfileId: string;
}

export interface SocialAccountIdentity {
  schemaVersion: "jhadina.social.account-identity.v1";
  scope: Readonly<SocialIdentityScope>;
  version: number;
  characterProfileRef: string;
  brandVoiceProfileRef: string;
  brandVoiceVersion: number;
  channelVoiceProfileRef: string;
  channelVoiceVersion: number;
  speakerIdentityRef?: string;
  toneTraits: readonly string[];
  pointOfView: string;
  evidenceRefs: readonly string[];
  updatedAt: string;
  authority: "EXPRESSION_ONLY";
  canPublish: false;
  canChangeJhadinaPersonality: false;
}

export interface SocialIdentityRevision {
  id: string;
  scope: Readonly<SocialIdentityScope>;
  expectedVersion: number;
  proposedToneTraits: readonly string[];
  proposedPointOfView: string;
  evidenceRefs: readonly string[];
  rationale: string;
  proposedAt: string;
  state: "PROPOSED";
  authority: "REVIEW_ONLY";
  requiresVerifiedOwnerApproval: true;
}

export interface SocialIdentityRevisionDecision {
  proposalId: string;
  status: "APPROVED" | "REJECTED";
  approvalReceiptId: string;
  decidedAt: string;
  next?: SocialAccountIdentity;
}

/** Contract only: durable implementations must atomically compare expectedVersion. */
export interface SocialIdentityRepository {
  load(scope: SocialIdentityScope): Promise<SocialAccountIdentity | null>;
  save(scope: SocialIdentityScope, expectedVersion: number, next: SocialAccountIdentity): Promise<void>;
}

function requireText(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("SOCIAL_ID_REQUIRED:" + name);
  return value.trim();
}
function date(value: string, name: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error("SOCIAL_ID_DATE_INVALID:" + name);
  return value;
}
function refs(values: readonly string[], name: string): readonly string[] {
  if (!values.length || values.some(value => typeof value !== "string" || !value.trim()))
    throw new Error("SOCIAL_ID_EVIDENCE_REQUIRED:" + name);
  return Object.freeze([...new Set(values.map(value => value.trim()))]);
}
function traits(values: readonly string[]): readonly string[] {
  if (!values.length || values.some(value => typeof value !== "string" || !value.trim()))
    throw new Error("SOCIAL_ID_TONE_REQUIRED");
  return Object.freeze([...new Set(values.map(value => value.trim()))]);
}
function frozenScope(account: SocialAccount): Readonly<SocialIdentityScope> {
  for (const [name, value] of Object.entries({
    ownerUserId: account.userId, brandId: account.brand, accountId: account.id,
    platform: account.platform, provider: account.provider,
    providerProfileId: account.providerProfileId,
  })) requireText(value, name);
  return Object.freeze({
    ownerUserId: account.userId,
    brandId: account.brand,
    accountId: account.id,
    platform: account.platform,
    provider: account.provider,
    providerProfileId: account.providerProfileId,
  });
}
function sameScope(a: SocialIdentityScope, b: SocialIdentityScope): boolean {
  return a.ownerUserId === b.ownerUserId && a.brandId === b.brandId
    && a.accountId === b.accountId && a.platform === b.platform
    && a.provider === b.provider && a.providerProfileId === b.providerProfileId;
}
export function assertSocialIdentityScope(scope: SocialIdentityScope, account: SocialAccount): void {
  if (!sameScope(scope, frozenScope(account))) throw new Error("SOCIAL_ID_SCOPE_MISMATCH");
}
export function createSocialAccountIdentity(input: {
  account: SocialAccount;
  character: SocialCharacterProfile;
  brandVoice: BrandVoiceProfile;
  channelVoice: ChannelVoiceProfile;
  observedAt: string;
  evidenceRefs: readonly string[];
}): SocialAccountIdentity {
  const {account, character, brandVoice, channelVoice} = input;
  if (account.status !== "connected") throw new Error("SOCIAL_ID_ACCOUNT_NOT_CONNECTED");
  if (character.status !== "active") throw new Error("SOCIAL_ID_CHARACTER_INACTIVE");
  if (character.authority !== "EXPRESSION_ONLY") throw new Error("SOCIAL_ID_CHARACTER_AUTHORITY_INVALID");
  assertBrandVoiceProfile(brandVoice);
  assertChannelVoiceProfile(channelVoice);
  if (character.brand !== account.brand || brandVoice.brand !== account.brand)
    throw new Error("SOCIAL_ID_BRAND_MISMATCH");
  if (channelVoice.platform !== account.platform) throw new Error("SOCIAL_ID_CHANNEL_MISMATCH");
  if (character.voiceProfileRef !== brandVoice.voiceProfileId)
    throw new Error("SOCIAL_ID_VOICE_REF_MISMATCH");
  const scope = frozenScope(account);
  return Object.freeze({
    schemaVersion: "jhadina.social.account-identity.v1" as const,
    scope,
    version: 1,
    characterProfileRef: requireText(character.id, "characterProfileRef"),
    brandVoiceProfileRef: requireText(brandVoice.voiceProfileId, "brandVoiceProfileRef"),
    brandVoiceVersion: brandVoice.version,
    channelVoiceProfileRef: requireText(channelVoice.channelVoiceProfileId, "channelVoiceProfileRef"),
    channelVoiceVersion: channelVoice.version,
    ...(character.speakerIdentityRef ? {speakerIdentityRef: character.speakerIdentityRef} : {}),
    toneTraits: traits(character.toneTraits),
    pointOfView: requireText(character.pointOfView, "pointOfView"),
    evidenceRefs: refs([...input.evidenceRefs, ...character.evidenceRefs, ...brandVoice.evidenceRefs], "initial"),
    updatedAt: date(input.observedAt, "observedAt"),
    authority: "EXPRESSION_ONLY" as const,
    canPublish: false as const,
    canChangeJhadinaPersonality: false as const,
  });
}
/**
 * A generated proposal is inert. It cannot amend an identity, approve itself,
 * or influence publication until a server-verified owner reviews it.
 */
export function proposeSocialIdentityRevision(input: {
  current: SocialAccountIdentity;
  id: string;
  proposedToneTraits: readonly string[];
  proposedPointOfView: string;
  independentEvidenceRefs: readonly string[];
  rationale: string;
  proposedAt: string;
}): SocialIdentityRevision {
  if (input.current.authority !== "EXPRESSION_ONLY" || input.current.canPublish !== false
      || input.current.canChangeJhadinaPersonality !== false)
    throw new Error("SOCIAL_ID_AUTHORITY_INVALID");
  const evidence = refs(input.independentEvidenceRefs, "revision");
  if (evidence.length < 2) throw new Error("SOCIAL_ID_REVISION_MULTIPLE_EVIDENCE_REQUIRED");
  return Object.freeze({
    id: requireText(input.id, "proposalId"),
    scope: Object.freeze({...input.current.scope}),
    expectedVersion: input.current.version,
    proposedToneTraits: traits(input.proposedToneTraits),
    proposedPointOfView: requireText(input.proposedPointOfView, "proposedPointOfView"),
    evidenceRefs: evidence,
    rationale: requireText(input.rationale, "rationale"),
    proposedAt: date(input.proposedAt, "proposedAt"),
    state: "PROPOSED" as const,
    authority: "REVIEW_ONLY" as const,
    requiresVerifiedOwnerApproval: true as const,
  });
}
/**
 * verifiedApproverUserId and receipt must originate from the authenticated
 * server-side review boundary. This pure function is not authentication.
 */
export function decideSocialIdentityRevision(input: {
  current: SocialAccountIdentity;
  proposal: SocialIdentityRevision;
  verifiedApproverUserId: string;
  approvalReceiptId: string;
  decision: "APPROVE" | "REJECT";
  decidedAt: string;
}): SocialIdentityRevisionDecision {
  const {current, proposal} = input;
  if (!sameScope(current.scope, proposal.scope)) throw new Error("SOCIAL_ID_REVISION_SCOPE_MISMATCH");
  if (current.version !== proposal.expectedVersion) throw new Error("SOCIAL_ID_STALE_REVISION");
  if (input.verifiedApproverUserId !== current.scope.ownerUserId)
    throw new Error("SOCIAL_ID_WRONG_APPROVER");
  if (proposal.state !== "PROPOSED" || proposal.authority !== "REVIEW_ONLY"
      || proposal.requiresVerifiedOwnerApproval !== true)
    throw new Error("SOCIAL_ID_REVISION_AUTHORITY_INVALID");
  const receipt = requireText(input.approvalReceiptId, "approvalReceiptId");
  const decidedAt = date(input.decidedAt, "decidedAt");
  if (input.decision === "REJECT")
    return Object.freeze({proposalId: proposal.id, status: "REJECTED" as const,
      approvalReceiptId: receipt, decidedAt});
  if (input.decision !== "APPROVE") throw new Error("SOCIAL_ID_INVALID_DECISION");
  const next: SocialAccountIdentity = Object.freeze({
    ...current,
    scope: Object.freeze({...current.scope}),
    version: current.version + 1,
    toneTraits: traits(proposal.proposedToneTraits),
    pointOfView: requireText(proposal.proposedPointOfView, "proposedPointOfView"),
    evidenceRefs: refs([...current.evidenceRefs, ...proposal.evidenceRefs], "revision"),
    updatedAt: decidedAt,
    authority: "EXPRESSION_ONLY" as const,
    canPublish: false as const,
    canChangeJhadinaPersonality: false as const,
  });
  return Object.freeze({proposalId: proposal.id, status: "APPROVED" as const,
    approvalReceiptId: receipt, decidedAt, next});
}

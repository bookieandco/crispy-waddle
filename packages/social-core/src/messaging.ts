import type {
  JhadinaBrand,
  SocialPlatform,
  SocialProviderName,
} from "./types.js";

export const DIRECT_MESSAGE_CAPABILITY = "consequential.outreach";

export type SocialContactState =
  | "eligible"
  | "unknown"
  | "declined"
  | "stop_contact"
  | "suppressed";

export type SocialMessageProposalStatus =
  | "pending_approval"
  | "approved"
  | "queued"
  | "delivered"
  | "failed"
  | "ambiguous"
  | "cancelled";

export interface SocialMessageRecipient {
  recipientRef: string;
  providerRecipientId: string;
  provider: SocialProviderName;
  platform: SocialPlatform;
}

export interface SocialMessageEligibility {
  state: SocialContactState;
  evidenceRefs: readonly string[];
  observedAt: string;
}

export interface SocialMessageInput {
  brand: JhadinaBrand;
  senderAccountId: string;
  recipient: SocialMessageRecipient;
  text: string;
  conversationRef?: string;
  offerRef?: string;
  outreachPlanRef?: string;
  touchId?: string;
  brandVoiceProfileRef: string;
  channelVoiceProfileRef: string;
  eligibility: SocialMessageEligibility;
}

export interface SocialMessageProposal {
  id: string;
  userId: string;
  actionId: string;
  brand: JhadinaBrand;
  senderAccountId: string;
  provider: SocialProviderName;
  platform: SocialPlatform;
  providerProfileId: string;
  recipientRef: string;
  providerRecipientId: string;
  conversationRef?: string;
  text: string;
  offerRef?: string;
  outreachPlanRef?: string;
  touchId?: string;
  brandVoiceProfileRef: string;
  channelVoiceProfileRef: string;
  eligibilityEvidenceRefs: string[];
  eligibilityObservedAt: string;
  status: SocialMessageProposalStatus;
  requestFingerprint: string;
  idempotencyKey: string;
  approvalReceiptId?: string;
  providerMessageId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialMessageAction {
  proposalId: string;
  requestFingerprint: string;
}

export interface SocialMessageOutboxJob {
  id: string;
  proposalId: string;
  userId: string;
  actionId: string;
  senderAccountId: string;
  provider: SocialProviderName;
  providerProfileId: string;
  platform: SocialPlatform;
  providerRecipientId: string;
  conversationRef?: string;
  text: string;
  status: "pending" | "attempting" | "delivered" | "failed" | "ambiguous" | "cancelled";
  idempotencyKey: string;
  attemptCount: number;
  providerMessageId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialProviderMessageRequest {
  senderProviderProfileId: string;
  platform: SocialPlatform;
  providerRecipientId: string;
  conversationRef?: string;
  text: string;
  idempotencyKey: string;
}

export interface SocialProviderMessageReceipt {
  provider: SocialProviderName;
  platform: SocialPlatform;
  senderProviderProfileId: string;
  providerRecipientId: string;
  providerMessageId: string;
  state: "sent" | "delivered" | "failed" | "unknown";
  observedAt: string;
}

export interface SocialMessageProvider {
  readonly name: SocialProviderName;
  sendMessage(input: SocialProviderMessageRequest): Promise<SocialProviderMessageReceipt>;
  findMessageByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialProviderMessageReceipt | null>;
}

export function assertSendableMessageEligibility(
  eligibility: SocialMessageEligibility,
  now = new Date(),
  maxAgeMs = 24 * 60 * 60 * 1000,
): void {
  if (eligibility.state !== "eligible") throw new Error("SOCIAL_MESSAGE_ELIGIBILITY_REQUIRED");
  if (!eligibility.evidenceRefs.length || eligibility.evidenceRefs.some((ref) => !ref.trim())) {
    throw new Error("SOCIAL_MESSAGE_ELIGIBILITY_EVIDENCE_REQUIRED");
  }
  const observedAt = Date.parse(eligibility.observedAt);
  if (!Number.isFinite(observedAt)) throw new Error("SOCIAL_MESSAGE_ELIGIBILITY_TIME_INVALID");
  const age = now.getTime() - observedAt;
  if (age < 0 || age > maxAgeMs) throw new Error("SOCIAL_MESSAGE_ELIGIBILITY_STALE");
}

export function fingerprintSocialMessage(input: SocialMessageInput): string {
  const text = input.text.trim();
  if (!text) throw new Error("SOCIAL_MESSAGE_TEXT_REQUIRED");
  if (!input.senderAccountId.trim()) throw new Error("SOCIAL_MESSAGE_SENDER_REQUIRED");
  if (!input.recipient.recipientRef.trim() || !input.recipient.providerRecipientId.trim()) {
    throw new Error("SOCIAL_MESSAGE_RECIPIENT_REQUIRED");
  }
  if (!input.brandVoiceProfileRef.trim() || !input.channelVoiceProfileRef.trim()) {
    throw new Error("SOCIAL_MESSAGE_VOICE_PROFILE_REQUIRED");
  }
  assertSendableMessageEligibility(input.eligibility);

  return JSON.stringify({
    v: 1,
    brand: input.brand,
    senderAccountId: input.senderAccountId,
    recipient: {
      recipientRef: input.recipient.recipientRef,
      providerRecipientId: input.recipient.providerRecipientId,
      provider: input.recipient.provider,
      platform: input.recipient.platform,
    },
    text,
    conversationRef: input.conversationRef ?? null,
    offerRef: input.offerRef ?? null,
    outreachPlanRef: input.outreachPlanRef ?? null,
    touchId: input.touchId ?? null,
    brandVoiceProfileRef: input.brandVoiceProfileRef,
    channelVoiceProfileRef: input.channelVoiceProfileRef,
    eligibilityEvidenceRefs: [...input.eligibility.evidenceRefs].sort(),
    eligibilityObservedAt: new Date(input.eligibility.observedAt).toISOString(),
  });
}

export function messageActionFromProposal(
  proposal: Pick<SocialMessageProposal, "id" | "requestFingerprint">,
): SocialMessageAction {
  return {
    proposalId: proposal.id,
    requestFingerprint: proposal.requestFingerprint,
  };
}

export function fingerprintSocialMessageAction(action: SocialMessageAction): string {
  return `social-direct-message:v1:${action.proposalId}:${action.requestFingerprint}`;
}

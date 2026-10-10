import {
  fingerprintWeeklySocialAction,
  type ApprovedWeeklySocialCampaignPacket,
  type WeeklySocialAction,
} from "./weekly-campaign.js";

export type WeeklyDelegationDomain =
  | "social_publication"
  | "social_comment"
  | "growth_paid_media"
  | "director_production";

export interface WeeklyDelegatedActionPermit {
  id: string;
  packetId: string;
  ownerUserId: string;
  parentApprovalReceiptId: string;
  parentPacketFingerprint: string;
  actionId: string;
  actionKind: WeeklySocialAction["kind"];
  domain: WeeklyDelegationDomain;
  actionFingerprint: string;
  scheduledAt: string;
  expiresAt: string;
  idempotencyKey: string;
  singleUse: true;
  evidenceRefs: readonly string[];
  authority: "EXACT_WEEKLY_CHILD_DELEGATION";
}

export interface WeeklyDelegationManifest {
  packetId: string;
  ownerUserId: string;
  parentApprovalReceiptId: string;
  parentPacketFingerprint: string;
  approvedAt: string;
  expiresAt: string;
  permits: readonly WeeklyDelegatedActionPermit[];
  policy: Readonly<{
    noNewActionsAfterApproval: true;
    exactFingerprintRequired: true;
    exactOwnerRequired: true;
    permitSingleUse: true;
    permitCannotIncreaseSpend: true;
    permitCannotChangeAccount: true;
    permitCannotChangeProfile: true;
    permitCannotChangeSchedule: true;
    permitCannotChangeAudience: true;
    permitCannotChangeCreative: true;
  }>;
  authority: "WEEKLY_DELEGATION_MANIFEST_ONLY";
}

export interface WeeklyDelegationConsumptionStore {
  consume(input: {
    permitId: string;
    ownerUserId: string;
    packetId: string;
    actionId: string;
    actionFingerprint: string;
    consumedAt: string;
  }): Promise<boolean>;
}

export function compileWeeklyDelegationManifest(
  packet: ApprovedWeeklySocialCampaignPacket,
): WeeklyDelegationManifest {
  if (packet.approvedFingerprint !== packet.fingerprint) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_PACKET_FINGERPRINT_MISMATCH");
  }
  if (packet.approvedByUserId !== packet.ownerUserId) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_OWNER_MISMATCH");
  }
  if (Date.parse(packet.approvedAt) >= Date.parse(packet.weekEndsAt)) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_APPROVAL_EXPIRED");
  }

  const permits = packet.actions.map((action) => {
    const actionFingerprint = fingerprintWeeklySocialAction(action);
    return Object.freeze({
      id: `weekly-permit:${safe(packet.id)}:${safe(action.id)}`,
      packetId: packet.id,
      ownerUserId: packet.ownerUserId,
      parentApprovalReceiptId: packet.approvalReceiptId,
      parentPacketFingerprint: packet.fingerprint,
      actionId: action.id,
      actionKind: action.kind,
      domain: domainFor(action.kind),
      actionFingerprint,
      scheduledAt: action.scheduledAt,
      expiresAt: packet.weekEndsAt,
      idempotencyKey: `${packet.id}:${action.id}:${actionFingerprint}`,
      singleUse: true as const,
      evidenceRefs: Object.freeze(unique([
        ...action.evidenceRefs,
        `weekly-packet:${packet.id}`,
        `weekly-approval:${packet.approvalReceiptId}`,
      ])),
      authority: "EXACT_WEEKLY_CHILD_DELEGATION" as const,
    });
  });

  return Object.freeze({
    packetId: packet.id,
    ownerUserId: packet.ownerUserId,
    parentApprovalReceiptId: packet.approvalReceiptId,
    parentPacketFingerprint: packet.fingerprint,
    approvedAt: packet.approvedAt,
    expiresAt: packet.weekEndsAt,
    permits: Object.freeze(permits),
    policy: Object.freeze({
      noNewActionsAfterApproval: true as const,
      exactFingerprintRequired: true as const,
      exactOwnerRequired: true as const,
      permitSingleUse: true as const,
      permitCannotIncreaseSpend: true as const,
      permitCannotChangeAccount: true as const,
      permitCannotChangeProfile: true as const,
      permitCannotChangeSchedule: true as const,
      permitCannotChangeAudience: true as const,
      permitCannotChangeCreative: true as const,
    }),
    authority: "WEEKLY_DELEGATION_MANIFEST_ONLY" as const,
  });
}

export function assertWeeklyDelegatedAction(input: {
  packet: ApprovedWeeklySocialCampaignPacket;
  permit: WeeklyDelegatedActionPermit;
  action: WeeklySocialAction;
  ownerUserId: string;
  observedAt?: string;
}): void {
  const observedAt = input.observedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_OBSERVED_AT_INVALID");
  }
  if (input.ownerUserId !== input.packet.ownerUserId) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_OWNER_MISMATCH");
  }
  if (
    input.permit.ownerUserId !== input.ownerUserId
    || input.permit.packetId !== input.packet.id
    || input.permit.parentApprovalReceiptId !== input.packet.approvalReceiptId
    || input.permit.parentPacketFingerprint !== input.packet.fingerprint
  ) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_PARENT_MISMATCH");
  }
  if (input.permit.actionId !== input.action.id) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_ACTION_MISMATCH");
  }
  if (input.permit.actionKind !== input.action.kind) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_KIND_MISMATCH");
  }
  if (input.permit.domain !== domainFor(input.action.kind)) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_DOMAIN_MISMATCH");
  }

  const fingerprint = fingerprintWeeklySocialAction(input.action);
  if (fingerprint !== input.permit.actionFingerprint) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_ACTION_FINGERPRINT_MISMATCH");
  }
  if (Date.parse(observedAt) < Date.parse(input.packet.approvedAt)) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_BEFORE_APPROVAL");
  }
  if (Date.parse(observedAt) >= Date.parse(input.permit.expiresAt)) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_EXPIRED");
  }

  const original = input.packet.actions.find(
    (action) => action.id === input.action.id,
  );
  if (!original) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_ACTION_NOT_IN_PACKET");
  }
  if (fingerprintWeeklySocialAction(original) !== fingerprint) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_PACKET_ACTION_MUTATED");
  }
}

export async function consumeWeeklyDelegatedAction(input: {
  packet: ApprovedWeeklySocialCampaignPacket;
  permit: WeeklyDelegatedActionPermit;
  action: WeeklySocialAction;
  ownerUserId: string;
  consumedAt?: string;
  store: WeeklyDelegationConsumptionStore;
}): Promise<void> {
  const consumedAt = input.consumedAt ?? new Date().toISOString();
  assertWeeklyDelegatedAction({
    packet: input.packet,
    permit: input.permit,
    action: input.action,
    ownerUserId: input.ownerUserId,
    observedAt: consumedAt,
  });

  const fingerprint = fingerprintWeeklySocialAction(input.action);
  const consumed = await input.store.consume({
    permitId: input.permit.id,
    ownerUserId: input.ownerUserId,
    packetId: input.packet.id,
    actionId: input.action.id,
    actionFingerprint: fingerprint,
    consumedAt,
  });
  if (!consumed) {
    throw new Error("SOCIAL_WEEKLY_DELEGATION_ALREADY_CONSUMED");
  }
}

function domainFor(kind: WeeklySocialAction["kind"]): WeeklyDelegationDomain {
  switch (kind) {
    case "organic_publication":
      return "social_publication";
    case "public_comment":
      return "social_comment";
    case "paid_campaign":
      return "growth_paid_media";
    case "director_production":
      return "director_production";
  }
}

function safe(value: string): string {
  return value.replace(/[^0-9A-Za-z:_-]+/g, "-").slice(0, 160);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

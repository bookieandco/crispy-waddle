import type {
  ApprovalReceiptVerifier,
  ApprovalRequestLike,
} from "@jhadina/action-core";
import {
  PAID_AD_CAPABILITY,
  type PaidAdPublishAction,
} from "@jhadina/growth-core";
import {
  PUBLIC_PUBLISH_CAPABILITY,
  consumeWeeklyDelegatedAction,
  type ApprovedWeeklySocialCampaignPacket,
  type SocialPublishAction,
  type WeeklyDelegatedActionPermit,
  type WeeklyDelegationConsumptionStore,
  type WeeklyOrganicPublicationAction,
  type WeeklyPaidCampaignAction,
} from "@jhadina/social-core";
import type {
  MaterializedWeeklyPublication,
} from "./weekly-publication-materialization";
import {
  assertWeeklyPaidCampaignRowBinding,
  expectedPaidCampaignFingerprintFromWeeklyAction,
} from "../growth/weekly-paid-campaign-binding";
import type { GrowthPaidCampaignRow } from "../growth/production-repository";

export function createWeeklySocialPublicationApprovalVerifier(input: {
  packet: ApprovedWeeklySocialCampaignPacket;
  permit: WeeklyDelegatedActionPermit;
  action: WeeklyOrganicPublicationAction;
  materialized: MaterializedWeeklyPublication;
  store: WeeklyDelegationConsumptionStore;
  consumedAt?: string;
}): ApprovalReceiptVerifier<SocialPublishAction> {
  return {
    async verifyAndConsume(
      receiptId: string,
      request: ApprovalRequestLike<SocialPublishAction>,
    ): Promise<boolean> {
      if (
        receiptId !== input.permit.id
        || request.userId !== input.packet.ownerUserId
        || request.type !== PUBLIC_PUBLISH_CAPABILITY
        || input.permit.domain !== "social_publication"
        || input.materialized.packetId !== input.packet.id
        || input.materialized.weeklyActionId !== input.action.id
        || request.action.requestFingerprint
          !== input.materialized.requestFingerprint
      ) {
        return false;
      }

      try {
        await consumeWeeklyDelegatedAction({
          packet: input.packet,
          permit: input.permit,
          action: input.action,
          ownerUserId: request.userId,
          consumedAt: input.consumedAt,
          store: input.store,
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function createWeeklyPaidCampaignApprovalVerifier(input: {
  packet: ApprovedWeeklySocialCampaignPacket;
  permit: WeeklyDelegatedActionPermit;
  action: WeeklyPaidCampaignAction;
  campaign: GrowthPaidCampaignRow;
  store: WeeklyDelegationConsumptionStore;
  consumedAt?: string;
}): ApprovalReceiptVerifier<PaidAdPublishAction> {
  assertWeeklyPaidCampaignRowBinding({
    action: input.action,
    campaign: input.campaign,
    ownerUserId: input.packet.ownerUserId,
  });
  const expectedCampaignFingerprint =
    expectedPaidCampaignFingerprintFromWeeklyAction(input.action);

  return {
    async verifyAndConsume(
      receiptId: string,
      request: ApprovalRequestLike<PaidAdPublishAction>,
    ): Promise<boolean> {
      if (
        receiptId !== input.permit.id
        || request.userId !== input.packet.ownerUserId
        || request.type !== PAID_AD_CAPABILITY
        || input.permit.domain !== "growth_paid_media"
        || request.action.campaignId !== input.campaign.id
        || request.action.requestFingerprint !== expectedCampaignFingerprint
      ) {
        return false;
      }

      try {
        await consumeWeeklyDelegatedAction({
          packet: input.packet,
          permit: input.permit,
          action: input.action,
          ownerUserId: request.userId,
          consumedAt: input.consumedAt,
          store: input.store,
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}

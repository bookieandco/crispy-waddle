import "server-only";

import {
  recordTikTokAffiliateConversion,
  recordTikTokAffiliatePaidPayout,
  type SideHustleAffiliateEvent,
  type TikTokAffiliateOrderObservation,
  type TikTokAffiliatePayoutObservation,
} from "@jhadina/opportunity-core";
import type {
  SideHustleCommercePersistence,
} from "./side-hustle-commerce-runtime";

export type TikTokAffiliateFinanceIngestionResult = {
  opportunityId: string;
  conversionEvents: readonly SideHustleAffiliateEvent[];
  payoutEvents: readonly SideHustleAffiliateEvent[];
  persisted: number;
  creatorAuthorizationRequired: true;
  sellerTokenSufficientForCreatorFinance: false;
  externalActionAuthorized: false;
  moneyMovementAuthorized: false;
};

export async function ingestTikTokAffiliateFinanceRuntime(input: {
  opportunityId: string;
  orders?: readonly TikTokAffiliateOrderObservation[];
  payouts?: readonly TikTokAffiliatePayoutObservation[];
}, repository: SideHustleCommercePersistence): Promise<TikTokAffiliateFinanceIngestionResult> {
  const opportunityId = input.opportunityId.trim();
  if (!opportunityId) throw new Error("TIKTOK_AFFILIATE_FINANCE_OPPORTUNITY_REQUIRED");
  const stored = await repository.get(opportunityId);
  if (!stored) throw new Error("TIKTOK_AFFILIATE_FINANCE_OPPORTUNITY_NOT_FOUND");

  const conversionEvents = (input.orders ?? []).map((observation) =>
    recordTikTokAffiliateConversion({
      opportunity: stored.opportunity,
      observation,
    }),
  );
  const payoutEvents = (input.payouts ?? []).map((observation) =>
    recordTikTokAffiliatePaidPayout({
      opportunity: stored.opportunity,
      observation,
    }),
  );

  let persisted = 0;
  for (const event of [...conversionEvents, ...payoutEvents]) {
    await repository.saveSideHustleCommerceRecord("affiliate_event", event);
    persisted += 1;
  }

  return Object.freeze({
    opportunityId,
    conversionEvents: Object.freeze(conversionEvents),
    payoutEvents: Object.freeze(payoutEvents),
    persisted,
    creatorAuthorizationRequired: true as const,
    sellerTokenSufficientForCreatorFinance: false as const,
    externalActionAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  });
}

import {
  compileSocialCommercialRoutes,
  type SocialBusinessBinding,
  type SocialCommercialVariantRoute,
  type SocialJuggernautPlan,
  type GrowthId,
} from "@jhadina/growth-core";
import type { SideHustleDirectorProductionPlan } from "../opportunities/side-hustle-director-bridge";
import type { CommercialSocialAccountBinding } from "./commercial-account-binding";

export type CommercialContentOrigin =
  | Readonly<{
      kind: "director";
      contentRef: string;
      directorProjectId: string;
      productionPlanId: string;
    }>
  | Readonly<{
      kind: "existing_asset";
      contentRef: string;
    }>;

export interface CommercialContentBridge {
  id: string;
  subjectId: GrowthId;
  growthBrandId: GrowthId;
  socialBrand: CommercialSocialAccountBinding["socialBrand"];
  accountId: string;
  platform: CommercialSocialAccountBinding["platform"];
  content: CommercialContentOrigin;
  businessBindingId: string;
  routes: readonly SocialCommercialVariantRoute[];
  evidenceRefs: readonly string[];
  policy: Readonly<{
    contentBusinessLineageRequired: true;
    accountBusinessLineageRequired: true;
    destinationLineageRequired: true;
    approvalStillRequiredBeforePublication: true;
    moneyAuthorityRemainsExternal: true;
  }>;
  authority: "CONTENT_BUSINESS_BRIDGE_ONLY";
  publicationAuthority: "NONE";
  paidMediaAuthority: "NONE";
  moneyMovementAuthorized: false;
}

export function compileFacelessAffiliateContentBridge(input: {
  id: string;
  socialPlan: SocialJuggernautPlan;
  businessBinding: SocialBusinessBinding;
  accountBinding: CommercialSocialAccountBinding;
  production: Pick<
    SideHustleDirectorProductionPlan,
    | "id"
    | "opportunityId"
    | "format"
    | "directorProjectId"
    | "commercialLineageRef"
    | "evidenceRefs"
  >;
  contentRef: string;
  evidenceRefs: readonly string[];
}): CommercialContentBridge {
  if (input.production.format !== "faceless_youtube") {
    throw new Error("SOCIAL_COMMERCIAL_FACELESS_PRODUCTION_REQUIRED");
  }
  if (input.businessBinding.owner.kind !== "owned_media") {
    throw new Error("SOCIAL_COMMERCIAL_FACELESS_OWNED_MEDIA_BINDING_REQUIRED");
  }
  if (input.businessBinding.owner.ref !== input.production.opportunityId) {
    throw new Error("SOCIAL_COMMERCIAL_FACELESS_OPPORTUNITY_MISMATCH");
  }
  if (input.accountBinding.platform !== "youtube") {
    throw new Error("SOCIAL_COMMERCIAL_FACELESS_YOUTUBE_ACCOUNT_REQUIRED");
  }
  const commercialLineageRef = requireText(
    input.production.commercialLineageRef ?? "",
    "production.commercialLineageRef",
  );

  return compileBridge({
    id: input.id,
    socialPlan: input.socialPlan,
    businessBinding: input.businessBinding,
    accountBinding: input.accountBinding,
    content: {
      kind: "director",
      contentRef: requireText(input.contentRef, "contentRef"),
      directorProjectId: requireText(
        input.production.directorProjectId,
        "directorProjectId",
      ),
      productionPlanId: requireText(input.production.id, "productionPlanId"),
    },
    evidenceRefs: [
      ...input.production.evidenceRefs,
      ...input.evidenceRefs,
    ],
    requiredLineageKey: commercialLineageRef,
  });
}

export function compileCommerceContentBridge(input: {
  id: string;
  socialPlan: SocialJuggernautPlan;
  businessBinding: SocialBusinessBinding;
  accountBinding: CommercialSocialAccountBinding;
  contentRef: string;
  destinationByVariant?: Readonly<Record<string, string>>;
  evidenceRefs: readonly string[];
}): CommercialContentBridge {
  if (input.businessBinding.owner.kind !== "commerce") {
    throw new Error("SOCIAL_COMMERCIAL_COMMERCE_BINDING_REQUIRED");
  }

  return compileBridge({
    id: input.id,
    socialPlan: input.socialPlan,
    businessBinding: input.businessBinding,
    accountBinding: input.accountBinding,
    content: {
      kind: "existing_asset",
      contentRef: requireText(input.contentRef, "contentRef"),
    },
    evidenceRefs: input.evidenceRefs,
    destinationByVariant: input.destinationByVariant,
  });
}

function compileBridge(input: {
  id: string;
  socialPlan: SocialJuggernautPlan;
  businessBinding: SocialBusinessBinding;
  accountBinding: CommercialSocialAccountBinding;
  content: CommercialContentOrigin;
  evidenceRefs: readonly string[];
  destinationByVariant?: Readonly<Record<string, string>>;
  requiredLineageKey?: string;
}): CommercialContentBridge {
  requireText(input.id, "id");
  if (!input.evidenceRefs.length) {
    throw new Error("SOCIAL_COMMERCIAL_BRIDGE_EVIDENCE_REQUIRED");
  }
  if (input.socialPlan.subjectId !== input.businessBinding.subjectId) {
    throw new Error("SOCIAL_COMMERCIAL_BRIDGE_SUBJECT_MISMATCH");
  }
  if (input.socialPlan.brandId !== input.businessBinding.brandId) {
    throw new Error("SOCIAL_COMMERCIAL_BRIDGE_BRAND_MISMATCH");
  }
  if (input.accountBinding.growthBrandId !== input.socialPlan.brandId) {
    throw new Error("SOCIAL_COMMERCIAL_BRIDGE_ACCOUNT_BRAND_MISMATCH");
  }

  const boundAccount = input.businessBinding.accountRefs.find(
    (account) =>
      account.accountRef === input.accountBinding.accountId
      && account.platform === input.accountBinding.platform,
  );
  if (!boundAccount) {
    throw new Error("SOCIAL_COMMERCIAL_BRIDGE_ACCOUNT_NOT_IN_BUSINESS_BINDING");
  }

  const routes = compileSocialCommercialRoutes({
    plan: input.socialPlan,
    binding: input.businessBinding,
    destinationByVariant: input.destinationByVariant,
  }).filter((route) =>
    route.platform === input.accountBinding.platform
    && route.accountRef === input.accountBinding.accountId
    && (!input.requiredLineageKey || route.lineageKey === input.requiredLineageKey)
  );

  if (!routes.length) {
    if (input.requiredLineageKey) {
      throw new Error("SOCIAL_COMMERCIAL_BRIDGE_PRODUCTION_LINEAGE_MISMATCH");
    }
    throw new Error("SOCIAL_COMMERCIAL_BRIDGE_ROUTE_REQUIRED");
  }

  return Object.freeze({
    id: input.id.trim(),
    subjectId: input.socialPlan.subjectId,
    growthBrandId: input.socialPlan.brandId,
    socialBrand: input.accountBinding.socialBrand,
    accountId: input.accountBinding.accountId,
    platform: input.accountBinding.platform,
    content: Object.freeze({ ...input.content }),
    businessBindingId: input.businessBinding.id,
    routes: Object.freeze(routes),
    evidenceRefs: Object.freeze(unique([
      ...input.evidenceRefs,
      ...input.accountBinding.evidenceRefs,
      ...input.businessBinding.evidenceRefs,
      ...routes.flatMap((route) => route.evidenceRefs),
      `content-ref:${input.content.contentRef}`,
    ])),
    policy: Object.freeze({
      contentBusinessLineageRequired: true as const,
      accountBusinessLineageRequired: true as const,
      destinationLineageRequired: true as const,
      approvalStillRequiredBeforePublication: true as const,
      moneyAuthorityRemainsExternal: true as const,
    }),
    authority: "CONTENT_BUSINESS_BRIDGE_ONLY" as const,
    publicationAuthority: "NONE" as const,
    paidMediaAuthority: "NONE" as const,
    moneyMovementAuthorized: false as const,
  });
}

function requireText(value: string, field: string): string {
  const clean = value.trim();
  if (!clean) throw new Error(`SOCIAL_COMMERCIAL_BRIDGE_FIELD_REQUIRED:${field}`);
  return clean;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

import { describe, expect, it } from "vitest";
import {
  bindBrandSocialCommerce,
  bindFacelessYouTubeAffiliate,
  compileSocialJuggernautPlan,
  type SocialPortfolioSubject,
} from "@jhadina/growth-core";
import type { OwnedMediaProperty } from "@jhadina/opportunity-core";
import {
  compileCommerceContentBridge,
  compileFacelessAffiliateContentBridge,
} from "./commercial-content-bridge";
import type { CommercialSocialAccountBinding } from "./commercial-account-binding";

const facelessSubject: SocialPortfolioSubject = {
  id: "subject:faceless:buyers",
  kind: "owned_media",
  brandId: "brand:buyer-guides",
  label: "Buyer Guides",
  audienceSignals: ["buyer intent", "comparison"],
  objectives: ["discovery", "qualified_traffic"],
  preferredSurfaces: ["social:youtube"],
  evidenceRefs: ["niche:buyer-guides"],
  scores: {
    businessValue: 88,
    evidenceQuality: 84,
    contentReadiness: 90,
    learningValue: 86,
    urgency: 70,
  },
};

const property: OwnedMediaProperty = {
  id: "owned-media:youtube:buyers",
  opportunityId: "opportunity:owned-media:buyers",
  family: "owned_media",
  propertyType: "youtube_channel",
  label: "Buyer Guides",
  providerRef: "youtube:buyers",
  evidenceRefs: ["youtube:property"],
  status: "active",
  createdAt: "2026-10-07T18:00:00.000Z",
  updatedAt: "2026-10-07T18:00:00.000Z",
  authority: "OWNED_MEDIA_REGISTRY_ONLY",
  externalActionAuthorized: false,
  publishingAuthorized: false,
  moneyMovementAuthorized: false,
};

const facelessAccount: CommercialSocialAccountBinding = {
  growthBrandId: "brand:buyer-guides",
  socialBrand: "venture:owned-media-buyers",
  accountId: "acct:youtube:buyers",
  platform: "youtube",
  provider: "hootsuite",
  providerProfileId: "youtube:buyers",
  evidenceRefs: ["social-account:youtube:buyers"],
  authority: "ACCOUNT_BINDING_ONLY",
  publicationAuthority: "NONE",
};

const pupSubject: SocialPortfolioSubject = {
  id: "subject:pupsonstuff:ig",
  kind: "product",
  brandId: "brand:pupsonstuff",
  label: "PupsonStuff",
  audienceSignals: ["pet owner", "gift"],
  objectives: ["discovery", "product_sale"],
  preferredSurfaces: ["social:instagram"],
  evidenceRefs: ["product:pupsonstuff"],
  scores: {
    businessValue: 92,
    evidenceQuality: 90,
    contentReadiness: 90,
    learningValue: 80,
    urgency: 75,
  },
};

const pupAccount: CommercialSocialAccountBinding = {
  growthBrandId: "brand:pupsonstuff",
  socialBrand: "pupsonstuff",
  accountId: "acct:pup:ig",
  platform: "instagram",
  provider: "hootsuite",
  providerProfileId: "ig:pup",
  evidenceRefs: ["social-account:pup:ig"],
  authority: "ACCOUNT_BINDING_ONLY",
  publicationAuthority: "NONE",
};

describe("commercial content bridge", () => {
  it("connects a faceless Director project to the exact YouTube account and affiliate destination", () => {
    const socialPlan = compileSocialJuggernautPlan(facelessSubject);
    const businessBinding = bindFacelessYouTubeAffiliate({
      id: "binding:faceless:affiliate",
      subjectId: facelessSubject.id,
      brandId: facelessSubject.brandId,
      ownedMediaProperty: property,
      youtubeAccountRef: facelessAccount.accountId,
      affiliateOpportunityId: "opportunity:affiliate:merchant",
      affiliateProgramRef: "partnerize:program:merchant",
      affiliateProviderRef: "provider:partnerize",
      destinationRef: "affiliate-destination:merchant",
      disclosureRef: "disclosure:affiliate:v1",
      evidenceRefs: ["affiliate:verified"],
    });

    const bridge = compileFacelessAffiliateContentBridge({
      id: "content-business:faceless:1",
      socialPlan,
      businessBinding,
      accountBinding: facelessAccount,
      production: {
        id: "director-plan:faceless:1",
        opportunityId: property.opportunityId,
        format: "faceless_youtube",
        directorProjectId: "director:faceless:1",
        evidenceRefs: ["director:qc"],
      },
      contentRef: "director-asset:faceless:final",
      evidenceRefs: ["content:approved"],
    });

    expect(bridge.platform).toBe("youtube");
    expect(bridge.content.kind).toBe("director");
    expect(bridge.businessBindingId).toBe("binding:faceless:affiliate");
    expect(bridge.routes.length).toBeGreaterThan(0);
    expect(bridge.routes.every((route) => route.destinationKind === "affiliate_program")).toBe(true);
    expect(bridge.routes.every((route) => route.accountRef === facelessAccount.accountId)).toBe(true);
    expect(bridge.publicationAuthority).toBe("NONE");
  });

  it("connects PupsonStuff Instagram content to the PupsonStuff storefront route", () => {
    const socialPlan = compileSocialJuggernautPlan(pupSubject);
    const businessBinding = bindBrandSocialCommerce({
      id: "binding:pup:ig",
      subjectId: pupSubject.id,
      brandId: pupSubject.brandId,
      ownerRef: "venture:pupsonstuff",
      platform: "instagram",
      socialAccountRef: pupAccount.accountId,
      destination: {
        label: "PupsonStuff store",
        destinationRef: "storefront:pupsonstuff",
        offerRef: "offer:pupsonstuff",
        productRef: "catalog:pupsonstuff",
        evidenceRefs: ["commerce:pupsonstuff"],
      },
      evidenceRefs: ["brand:pupsonstuff"],
    });

    const bridge = compileCommerceContentBridge({
      id: "content-business:pup:1",
      socialPlan,
      businessBinding,
      accountBinding: pupAccount,
      contentRef: "asset:pup:worst-photo-challenge",
      evidenceRefs: ["asset:pup:approved"],
    });

    expect(bridge.platform).toBe("instagram");
    expect(bridge.content.kind).toBe("existing_asset");
    expect(bridge.routes.every((route) => route.destinationRef === "storefront:pupsonstuff")).toBe(true);
    expect(bridge.routes.every((route) => route.accountRef === "acct:pup:ig")).toBe(true);
  });

  it("blocks a faceless production from being attached to the wrong owned-media business", () => {
    const socialPlan = compileSocialJuggernautPlan(facelessSubject);
    const businessBinding = bindFacelessYouTubeAffiliate({
      id: "binding:faceless:affiliate",
      subjectId: facelessSubject.id,
      brandId: facelessSubject.brandId,
      ownedMediaProperty: property,
      youtubeAccountRef: facelessAccount.accountId,
      affiliateOpportunityId: "opportunity:affiliate:merchant",
      affiliateProgramRef: "partnerize:program:merchant",
      affiliateProviderRef: "provider:partnerize",
      destinationRef: "affiliate-destination:merchant",
      disclosureRef: "disclosure:affiliate:v1",
      evidenceRefs: ["affiliate:verified"],
    });

    expect(() => compileFacelessAffiliateContentBridge({
      id: "content-business:faceless:wrong",
      socialPlan,
      businessBinding,
      accountBinding: facelessAccount,
      production: {
        id: "director-plan:wrong",
        opportunityId: "opportunity:owned-media:other",
        format: "faceless_youtube",
        directorProjectId: "director:wrong",
        evidenceRefs: ["director:wrong"],
      },
      contentRef: "director-asset:wrong",
      evidenceRefs: ["content:wrong"],
    })).toThrow(/OPPORTUNITY_MISMATCH/);
  });

  it("blocks an account that is not present in the commercial binding", () => {
    const socialPlan = compileSocialJuggernautPlan(pupSubject);
    const businessBinding = bindBrandSocialCommerce({
      id: "binding:pup:ig",
      subjectId: pupSubject.id,
      brandId: pupSubject.brandId,
      ownerRef: "venture:pupsonstuff",
      platform: "instagram",
      socialAccountRef: "acct:pup:ig",
      destination: {
        label: "PupsonStuff store",
        destinationRef: "storefront:pupsonstuff",
        evidenceRefs: ["commerce:pupsonstuff"],
      },
      evidenceRefs: ["brand:pupsonstuff"],
    });

    expect(() => compileCommerceContentBridge({
      id: "content-business:pup:wrong-account",
      socialPlan,
      businessBinding,
      accountBinding: {
        ...pupAccount,
        accountId: "acct:other:ig",
      },
      contentRef: "asset:pup:1",
      evidenceRefs: ["asset:pup:1"],
    })).toThrow(/ACCOUNT_NOT_IN_BUSINESS_BINDING/);
  });
});

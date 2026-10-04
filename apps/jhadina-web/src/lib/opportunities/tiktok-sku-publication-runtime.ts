import "server-only";

import { createHash } from "node:crypto";
import type {
  ApprovalReceiptVerifier,
  ApprovalRequestLike,
} from "@jhadina/action-core";
import type { TikTokCommercialQcResult } from "@jhadina/director-core";

export const TIKTOK_SKU_PUBLISH_ACTION_TYPE =
  "tiktok.shop.sku.publish" as const;

export type TikTokSkuPublicationAction = {
  id: string;
  userId: string;
  opportunityId: string;
  ventureId: string;
  shopRef: string;
  productRef: string;
  skuRefs: readonly string[];
  qc: TikTokCommercialQcResult;
  creativeArtifactRefs: readonly string[];
  provider: "printify" | "tiktok_shop" | (string & {});
  providerShopId: string;
  providerProductId: string;
  evidenceRefs: readonly string[];
  requestedAt: string;
};

export type TikTokSkuProviderPublicationResult = {
  provider: string;
  providerShopId: string;
  providerProductId: string;
  providerListingRef?: string;
  state: "submitted" | "published" | "failed" | "unknown";
  observedAt: string;
  evidenceRefs: readonly string[];
  error?: string;
};

export type TikTokSkuPublisher = {
  publish(
    action: TikTokSkuPublicationAction,
  ): Promise<TikTokSkuProviderPublicationResult>;
};

export type TikTokSkuPublicationReceipt = {
  id: string;
  actionId: string;
  approvalReceiptId: string;
  userId: string;
  opportunityId: string;
  ventureId: string;
  shopRef: string;
  productRef: string;
  skuRefs: readonly string[];
  provider: string;
  providerShopId: string;
  providerProductId: string;
  providerListingRef?: string;
  state: TikTokSkuProviderPublicationResult["state"];
  qcReceiptId: string;
  creativeArtifactRefs: readonly string[];
  evidenceRefs: readonly string[];
  observedAt: string;
  authorizationEffect: "NONE";
  moneyMovementAuthorized: false;
};

export async function publishTikTokSkuWithApproval(input: {
  action: TikTokSkuPublicationAction;
  approvalReceiptId: string;
  verifier: ApprovalReceiptVerifier<TikTokSkuPublicationAction>;
  publisher: TikTokSkuPublisher;
}): Promise<TikTokSkuPublicationReceipt> {
  validatePublicationAction(input.action);
  requireText(
    input.approvalReceiptId,
    "TIKTOK_SKU_APPROVAL_RECEIPT_REQUIRED",
  );

  const request: ApprovalRequestLike<TikTokSkuPublicationAction> = {
    id: input.action.id,
    userId: input.action.userId,
    type: TIKTOK_SKU_PUBLISH_ACTION_TYPE,
    action: input.action,
    requestedAt: input.action.requestedAt,
  };
  const approved = await input.verifier.verifyAndConsume(
    input.approvalReceiptId,
    request,
  );
  if (!approved) throw new Error("TIKTOK_SKU_APPROVAL_INVALID_OR_CONSUMED");

  const providerResult = await input.publisher.publish(input.action);
  if (
    providerResult.providerShopId !== input.action.providerShopId ||
    providerResult.providerProductId !== input.action.providerProductId
  ) {
    throw new Error("TIKTOK_SKU_PROVIDER_RECEIPT_TARGET_MISMATCH");
  }

  return Object.freeze({
    id: `tiktok-sku-publication:${input.action.id}`,
    actionId: input.action.id,
    approvalReceiptId: input.approvalReceiptId,
    userId: input.action.userId,
    opportunityId: input.action.opportunityId,
    ventureId: input.action.ventureId,
    shopRef: input.action.shopRef,
    productRef: input.action.productRef,
    skuRefs: Object.freeze([...input.action.skuRefs]),
    provider: providerResult.provider,
    providerShopId: providerResult.providerShopId,
    providerProductId: providerResult.providerProductId,
    providerListingRef: providerResult.providerListingRef,
    state: providerResult.state,
    qcReceiptId: input.action.qc.id,
    creativeArtifactRefs: Object.freeze([...input.action.creativeArtifactRefs]),
    evidenceRefs: Object.freeze(unique([
      ...input.action.evidenceRefs,
      ...input.action.qc.evidenceIds,
      ...providerResult.evidenceRefs,
      `approval:${input.approvalReceiptId}`,
    ])),
    observedAt: providerResult.observedAt,
    authorizationEffect: "NONE" as const,
    moneyMovementAuthorized: false as const,
  });
}

export function fingerprintTikTokSkuPublicationRequest(
  request: ApprovalRequestLike<TikTokSkuPublicationAction>,
): string {
  const action = request.action;
  return `sha256:${createHash("sha256").update(JSON.stringify({
    type: request.type,
    id: request.id,
    userId: request.userId,
    opportunityId: action.opportunityId,
    ventureId: action.ventureId,
    shopRef: action.shopRef,
    productRef: action.productRef,
    skuRefs: [...action.skuRefs].sort(),
    qcReceiptId: action.qc.id,
    creativeArtifactRefs: [...action.creativeArtifactRefs].sort(),
    provider: action.provider,
    providerShopId: action.providerShopId,
    providerProductId: action.providerProductId,
  })).digest("hex")}`;
}

export function createPrintifyTikTokSkuPublisher(input: {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
} = {}): TikTokSkuPublisher {
  const apiKey = (input.apiKey ?? process.env.PRINTIFY_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("TIKTOK_SKU_PRINTIFY_API_KEY_REQUIRED");
  const baseUrl = normalizeHttpsBaseUrl(
    input.baseUrl ?? "https://api.printify.com",
    "TIKTOK_SKU_PRINTIFY_BASE_URL_INVALID",
  );
  const fetchImpl = input.fetchImpl ?? fetch;

  return {
    async publish(action) {
      if (action.provider !== "printify") {
        throw new Error("TIKTOK_SKU_PRINTIFY_PROVIDER_MISMATCH");
      }
      const response = await fetchImpl(
        `${baseUrl}/v1/shops/${encodeURIComponent(action.providerShopId)}/products/${encodeURIComponent(action.providerProductId)}/publish.json`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            title: true,
            description: true,
            images: true,
            variants: true,
            tags: true,
            keyFeatures: true,
            shipping_template: true,
          }),
          cache: "no-store",
        },
      );
      const text = await response.text();
      const observedAt = new Date().toISOString();
      if (!response.ok) {
        return Object.freeze({
          provider: "printify",
          providerShopId: action.providerShopId,
          providerProductId: action.providerProductId,
          state: "failed" as const,
          observedAt,
          evidenceRefs: Object.freeze([
            `printify:publish:${action.providerProductId}:${response.status}`,
          ]),
          error: safeMessage(text),
        });
      }
      return Object.freeze({
        provider: "printify",
        providerShopId: action.providerShopId,
        providerProductId: action.providerProductId,
        providerListingRef: action.providerProductId,
        state: "submitted" as const,
        observedAt,
        evidenceRefs: Object.freeze([
          `printify:publish:${action.providerProductId}:${observedAt}`,
        ]),
      });
    },
  };
}

function validatePublicationAction(
  action: TikTokSkuPublicationAction,
): void {
  for (const [value, code] of [
    [action.id, "TIKTOK_SKU_ACTION_ID_REQUIRED"],
    [action.userId, "TIKTOK_SKU_USER_REQUIRED"],
    [action.opportunityId, "TIKTOK_SKU_OPPORTUNITY_REQUIRED"],
    [action.ventureId, "TIKTOK_SKU_VENTURE_REQUIRED"],
    [action.shopRef, "TIKTOK_SKU_SHOP_REQUIRED"],
    [action.productRef, "TIKTOK_SKU_PRODUCT_REQUIRED"],
    [action.providerShopId, "TIKTOK_SKU_PROVIDER_SHOP_REQUIRED"],
    [action.providerProductId, "TIKTOK_SKU_PROVIDER_PRODUCT_REQUIRED"],
  ] as const) requireText(value, code);

  if (action.qc.status !== "pass") throw new Error("TIKTOK_SKU_QC_PASS_REQUIRED");
  if (action.qc.productRef !== action.productRef) {
    throw new Error("TIKTOK_SKU_QC_PRODUCT_MISMATCH");
  }
  if (!action.skuRefs.length) throw new Error("TIKTOK_SKU_REFS_REQUIRED");
  if (!action.creativeArtifactRefs.length) {
    throw new Error("TIKTOK_SKU_CREATIVE_ARTIFACT_REQUIRED");
  }
  if (!action.evidenceRefs.length) throw new Error("TIKTOK_SKU_EVIDENCE_REQUIRED");
  if (!Number.isFinite(Date.parse(action.requestedAt))) {
    throw new Error("TIKTOK_SKU_REQUESTED_AT_INVALID");
  }
}

function normalizeHttpsBaseUrl(value: string, code: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "https:") throw new Error(code);
  return url.toString().replace(/\/+$/, "");
}

function requireText(value: string, code: string): void {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function safeMessage(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 300);
}

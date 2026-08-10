export type CreationAsset = {
  id: string;
  kind: "original-photo" | "ai-artwork" | "production-artwork" | "proof";
  url?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  qualityScore?: number;
};

export type PupsonCreation = {
  id: string;
  customerId?: string;
  productId: string;
  variantId?: string;
  customizationPrompt?: string;
  assets: CreationAsset[];
  approvedAt?: string;
};

export function isProductionApproved(creation: PupsonCreation) {
  const production = creation.assets.find((asset) => asset.kind === "production-artwork");
  return Boolean(creation.approvedAt && production && (production.qualityScore ?? 0) >= 90);
}

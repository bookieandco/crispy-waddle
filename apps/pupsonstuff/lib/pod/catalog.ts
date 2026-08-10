import type { PrintProfile } from "./quality-gate";

export type PodProvider = "printify" | "manual";

export type PodProductProfile = PrintProfile & {
  productId: string;
  provider: PodProvider;
  providerProductId?: string;
  providerVariantIds?: string[];
};

export const POD_PRODUCTS: Record<string, PodProductProfile> = {
  shirt: { productId: "shirt", name: "T-Shirt", printWidthInches: 12, printHeightInches: 16, minDpi: 150, safeMarginInches: 0.25, provider: "printify" },
  hoodie: { productId: "hoodie", name: "Hoodie", printWidthInches: 12, printHeightInches: 16, minDpi: 150, safeMarginInches: 0.25, provider: "printify" },
  mug: { productId: "mug", name: "Mug", printWidthInches: 8.5, printHeightInches: 3.5, minDpi: 150, safeMarginInches: 0.15, provider: "printify" },
  pillow: { productId: "pillow", name: "Pillow", printWidthInches: 18, printHeightInches: 18, minDpi: 150, safeMarginInches: 0.25, provider: "printify" },
  tote: { productId: "tote", name: "Tote Bag", printWidthInches: 12, printHeightInches: 14, minDpi: 150, safeMarginInches: 0.25, provider: "printify" },
};

export function getPodProductProfile(productId: string): PodProductProfile | null {
  return POD_PRODUCTS[productId] ?? null;
}

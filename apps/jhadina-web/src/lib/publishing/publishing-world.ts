export type PublishingFormat = "ebook" | "pdf" | "digital-file" | "paperback" | "hardcover";
export type PublishingStatus = "draft" | "review" | "ready" | "published" | "archived";

export interface PublishingProduct {
  id: string;
  title: string;
  description?: string;
  formats: PublishingFormat[];
  status: PublishingStatus;
  price?: number;
  currency?: string;
  coverImageUrl?: string;
  fileAssetIds: string[];
  isbn?: string;
  salesChannels: string[];
}

export interface PublishingCapability {
  id: string;
  label: string;
  enabled: boolean;
}

export const PUBLISHING_CAPABILITIES: PublishingCapability[] = [
  { id: "write", label: "Write", enabled: true },
  { id: "format", label: "Format ebook/PDF", enabled: true },
  { id: "cover", label: "Create cover", enabled: true },
  { id: "proof", label: "Proof and QA", enabled: true },
  { id: "pod", label: "Print-on-demand", enabled: true },
  { id: "digital-sales", label: "Sell digital files", enabled: true },
  { id: "ebook-sales", label: "Sell ebooks", enabled: true },
  { id: "catalog", label: "Manage catalog", enabled: true },
  { id: "orders", label: "Track orders", enabled: true },
  { id: "analytics", label: "Sales analytics", enabled: true },
];

export function createPublishingProduct(input: Omit<PublishingProduct, "id" | "status">): PublishingProduct {
  return { ...input, id: crypto.randomUUID(), status: "draft" };
}

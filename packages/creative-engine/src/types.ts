export type CreativeOperation =
  | "background_remove"
  | "generate"
  | "edit"
  | "enhance"
  | "upscale"
  | "video"
  | "compose_product";

export type CreativeJobStatus =
  | "queued"
  | "preprocessing"
  | "generating"
  | "reviewing"
  | "completed"
  | "failed"
  | "cancelled";

export type ReferenceRole =
  | "subject"
  | "style"
  | "composition"
  | "product"
  | "environment"
  | "color"
  | "inspiration";

export type BackgroundMode = "auto" | "transparent" | "keep" | "generate";

export interface CreativeReference {
  assetId: string;
  role: ReferenceRole;
  uri?: string;
}

export interface CreativeIntent {
  operation: CreativeOperation | "generate_product_design";
  prompt?: string;
  references: CreativeReference[];
  outputCount?: number;
  productId?: string;
  backgroundMode?: BackgroundMode;
  metadata?: Record<string, unknown>;
}

export interface CreativeJob {
  id: string;
  intent: CreativeIntent;
  status: CreativeJobStatus;
  outputs: CreativeOutput[];
  provider?: string;
  providerJobId?: string;
  error?: string;
}

export interface CreativeOutput {
  id: string;
  assetId: string;
  uri: string;
  metadata?: Record<string, unknown>;
}

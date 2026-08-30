export type CreativeOperation =
  | "generate"
  | "edit"
  | "enhance"
  | "upscale";

export type ReferenceRole =
  | "subject"
  | "style"
  | "composition"
  | "product"
  | "environment"
  | "color"
  | "inspiration";

export interface CreativeReference {
  assetId: string;
  role: ReferenceRole;
  uri?: string;
}

export interface CreativeIntent {
  operation: CreativeOperation;
  prompt?: string;
  references: CreativeReference[];
  outputCount?: number;
  productId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreativeJob {
  id: string;
  intent: CreativeIntent;
  status: "queued" | "running" | "completed" | "failed";
  outputs: CreativeOutput[];
}

export interface CreativeOutput {
  id: string;
  assetId: string;
  uri: string;
  metadata?: Record<string, unknown>;
}

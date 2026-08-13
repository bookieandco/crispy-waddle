export interface KdpResearchSnapshot {
  seed: string;
  keywords: string[];
  categories: string[];
  competitorSignals: string[];
  notes: string[];
  source: "kdp-scout" | "other";
  capturedAt: string;
}

export interface KdpAutomationJob {
  id: string;
  operation: "prepare" | "metadata-review" | "upload" | "price-review" | "publish";
  publishingProductId: string;
  status: "proposed" | "awaiting-approval" | "running" | "complete" | "failed";
  requiresApproval: boolean;
}

export function createKdpAutomationJob(input: Omit<KdpAutomationJob, "id" | "status">): KdpAutomationJob {
  return {
    ...input,
    id: crypto.randomUUID(),
    status: input.requiresApproval ? "awaiting-approval" : "proposed",
  };
}

export function createKdpResearchSnapshot(seed: string, data: Omit<KdpResearchSnapshot, "seed" | "capturedAt">): KdpResearchSnapshot {
  return { ...data, seed, capturedAt: new Date().toISOString() };
}

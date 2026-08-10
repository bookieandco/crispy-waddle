export type PodJobStage =
  | "photo_received"
  | "ai_generation"
  | "artwork_qa"
  | "print_composition"
  | "production_qa"
  | "customer_approval"
  | "provider_upload"
  | "order_created"
  | "production"
  | "shipping"
  | "complete";

export type PodJobStatus = "queued" | "running" | "waiting" | "failed" | "complete";

export type PodJob = {
  id: string;
  creationId: string;
  stage: PodJobStage;
  status: PodJobStatus;
  attempts: number;
  lastError?: string;
  updatedAt: string;
};

const NEXT: Partial<Record<PodJobStage, PodJobStage>> = {
  photo_received: "ai_generation",
  ai_generation: "artwork_qa",
  artwork_qa: "print_composition",
  print_composition: "production_qa",
  production_qa: "customer_approval",
  customer_approval: "provider_upload",
  provider_upload: "order_created",
  order_created: "production",
  production: "shipping",
  shipping: "complete",
};

export function advancePodJob(job: PodJob): PodJob {
  const next = NEXT[job.stage];
  if (!next) return { ...job, status: "complete", updatedAt: new Date().toISOString() };
  return { ...job, stage: next, status: "queued", updatedAt: new Date().toISOString(), lastError: undefined };
}

export function failPodJob(job: PodJob, error: string): PodJob {
  return { ...job, status: "failed", attempts: job.attempts + 1, lastError: error, updatedAt: new Date().toISOString() };
}

export function retryPodJob(job: PodJob): PodJob {
  return { ...job, status: "queued", updatedAt: new Date().toISOString() };
}

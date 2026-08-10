export type ReplacementStage = "detect" | "segment" | "track" | "replace" | "composite" | "qa" | "export";
export type ReplacementModelFamily = "adetailer" | "segmentation" | "mask-rcnn" | "custom";

export interface ReplacementTarget {
  id: string;
  label: string;
  modelFamily: ReplacementModelFamily;
  confidenceThreshold: number;
  preserveMotion: boolean;
  preserveLighting: boolean;
}

export interface VideoReplacementJob {
  id: string;
  sourceAssetId: string;
  target: ReplacementTarget;
  replacementAssetId: string;
  stage: ReplacementStage;
  requiresReview: boolean;
  status: "draft" | "processing" | "review" | "approved" | "failed";
}

export const VIDEO_REPLACEMENT_PIPELINE: ReplacementStage[] = [
  "detect", "segment", "track", "replace", "composite", "qa", "export",
];

export function createVideoReplacementJob(input: Omit<VideoReplacementJob, "id" | "stage" | "status">): VideoReplacementJob {
  return { ...input, id: crypto.randomUUID(), stage: "detect", status: "draft", requiresReview: true };
}

export function advanceReplacementStage(job: VideoReplacementJob): VideoReplacementJob {
  const index = VIDEO_REPLACEMENT_PIPELINE.indexOf(job.stage);
  if (index < 0 || index === VIDEO_REPLACEMENT_PIPELINE.length - 1) return { ...job, status: "review" };
  return { ...job, stage: VIDEO_REPLACEMENT_PIPELINE[index + 1], status: "processing" };
}

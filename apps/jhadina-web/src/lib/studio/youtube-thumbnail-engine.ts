export type ThumbnailStyle = "cinematic" | "bold" | "reaction" | "music" | "story" | "minimal";
export type ThumbnailStatus = "draft" | "generating" | "qc" | "approved";

export interface ThumbnailConcept { id: string; title: string; hook: string; focalSubject: string; style: ThumbnailStyle; text?: string; sourceAssetIds: string[]; status: ThumbnailStatus; score?: number; }
export interface ThumbnailQC { readability: number; focalClarity: number; contrast: number; composition: number; brandFit: number; mobileLegibility: number; overall: number; warnings: string[]; }

export function createThumbnailConcept(input: Omit<ThumbnailConcept, "id" | "status">): ThumbnailConcept {
  return { ...input, id: crypto.randomUUID(), status: "draft" };
}

export function scoreThumbnail(qc: Omit<ThumbnailQC, "overall">): ThumbnailQC {
  const values = [qc.readability, qc.focalClarity, qc.contrast, qc.composition, qc.brandFit, qc.mobileLegibility];
  const overall = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return { ...qc, overall };
}

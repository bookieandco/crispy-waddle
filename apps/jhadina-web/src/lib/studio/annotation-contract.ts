export type AnnotationKind = "bbox" | "polygon" | "mask" | "keypoint" | "landmark" | "track" | "classification" | "attribute";

export interface MediaAnnotation {
  id: string;
  assetId: string;
  frameStart?: number;
  frameEnd?: number;
  kind: AnnotationKind;
  label: string;
  confidence?: number;
  geometry: Record<string, unknown>;
  source: "human" | "model" | "imported";
  approved: boolean;
  provenance?: string;
}

export interface AnnotationSet {
  assetId: string;
  annotations: MediaAnnotation[];
  version: number;
}

export function validateAnnotations(set: AnnotationSet): string[] {
  const warnings: string[] = [];
  for (const a of set.annotations) {
    if (!a.label) warnings.push(`Annotation ${a.id} has no label.`);
    if (a.confidence !== undefined && (a.confidence < 0 || a.confidence > 1)) warnings.push(`Annotation ${a.id} has invalid confidence.`);
    if (a.source === "model" && !a.provenance) warnings.push(`Model annotation ${a.id} is missing provenance.`);
  }
  return warnings;
}

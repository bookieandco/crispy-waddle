export type ContinuityDimensionValue = string | number | boolean | null;

export type ContinuityManifest = {
  manifestId?: string;
  takeId?: string;
  locked: Record<string, ContinuityDimensionValue>;
  metadata?: Record<string, unknown>;
};

export function createContinuityManifest(
  locked: Record<string, ContinuityDimensionValue>,
  metadata?: Record<string, unknown>,
): ContinuityManifest {
  return { locked: { ...locked }, metadata };
}

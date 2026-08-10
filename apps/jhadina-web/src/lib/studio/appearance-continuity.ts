export interface AppearanceIdentity {
  characterId: string;
  skinTone?: string;
  hair: { style: string; color: string; length: string; physicsProfile?: string };
  clothing: Array<{ id: string; garment: string; color?: string; material?: string; fit?: string; physicsProfile?: string }>;
  accessories: Array<{ id: string; type: string; description?: string }>;
  details: Array<{ id: string; type: string; value: string; persistent: boolean }>;
}

export interface AppearanceQC {
  identityMatch: number | null;
  hairConsistency: number | null;
  clothingConsistency: number | null;
  detailConsistency: number | null;
  warnings: string[];
}

export function validateAppearanceIdentity(identity: AppearanceIdentity): string[] {
  const warnings: string[] = [];
  if (!identity.characterId) warnings.push("Character identity is missing.");
  if (!identity.hair.style || !identity.hair.color) warnings.push("Hair identity is incomplete.");
  const ids = identity.clothing.map(c => c.id);
  if (new Set(ids).size !== ids.length) warnings.push("Duplicate clothing IDs detected.");
  return warnings;
}

export function scoreAppearanceQC(qc: AppearanceQC): number | null {
  const values = [qc.identityMatch, qc.hairConsistency, qc.clothingConsistency, qc.detailConsistency].filter((v): v is number => typeof v === "number");
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100;
}

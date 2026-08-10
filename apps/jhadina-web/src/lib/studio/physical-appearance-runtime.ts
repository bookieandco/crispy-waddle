export type PhysicsKind = "cloth" | "hair" | "rigid-body" | "soft-body";

export interface PhysicsAsset {
  id: string;
  characterId?: string;
  kind: PhysicsKind;
  colliderIds: string[];
  material: { mass?: number; friction?: number; restitution?: number; stiffness?: number; damping?: number };
  attachment?: { boneId: string; offset?: [number, number, number] };
}

export interface ShotAppearanceState {
  shotId: string;
  characterId: string;
  garmentIds: string[];
  hairAssetId?: string;
  accessoryIds: string[];
  appearanceHash: string;
  physicsAssetIds: string[];
}

export interface ContinuityIssue {
  type: "garment" | "hair" | "accessory" | "attachment" | "physics";
  severity: "warning" | "error";
  message: string;
}

export function checkShotContinuity(previous: ShotAppearanceState, current: ShotAppearanceState): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  if (previous.characterId !== current.characterId) return [{ type: "attachment", severity: "error", message: "Shot states belong to different characters." }];
  if (previous.hairAssetId !== current.hairAssetId) issues.push({ type: "hair", severity: "warning", message: "Hair asset changed between shots." });
  if (previous.appearanceHash !== current.appearanceHash) issues.push({ type: "garment", severity: "warning", message: "Appearance identity changed between shots." });
  const prevGarments = new Set(previous.garmentIds);
  if (current.garmentIds.some(id => !prevGarments.has(id))) issues.push({ type: "garment", severity: "warning", message: "A garment was introduced or swapped." });
  if (!current.physicsAssetIds.length) issues.push({ type: "physics", severity: "warning", message: "No physics assets are attached to the current shot." });
  return issues;
}

export function buildPhysicsBindings(assets: PhysicsAsset[]): Record<string, unknown> {
  return Object.fromEntries(assets.map(asset => [asset.id, { kind: asset.kind, colliders: asset.colliderIds, material: asset.material, attachment: asset.attachment }]));
}

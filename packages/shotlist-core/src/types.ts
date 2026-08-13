/** Canonical shotlist types and additive Director Control Extension. */
export interface DirectorControls {
  lens?: string;
  cameraMovement?: string;
  framing?: string;
  lightingMood?: string;
  performanceIntensity?: string;
  durationSeconds?: number;
  lookPreset?: string;
}

export type ShotStatus = "draft" | "pending_approval" | "approved" | "rejected";

export interface Entity {
  id: string;
  name: string;
  lockedTraits: string[];
}

export type ControlType = "pose" | "depth" | "canny" | "reference-only" | "style";

export interface ReferenceAsset {
  id: string;
  entityId: string;
  uri: string;
  kind?: string;
  controlType?: ControlType;
  strength?: number;
}

export interface Shot {
  id: string;
  projectId: string;
  sceneScriptOrder: number;
  ordinal: number;
  shotType: string;
  angle?: string;
  lensMm?: number;
  movement?: string;
  durationSec: number;
  action: string;
  emotion?: string;
  lighting?: string;
  audioNote?: string;
  entityHandles: string[];
  status: ShotStatus;
  director?: DirectorControls;
}

export function isApproved(shot: Shot): boolean {
  return shot.status === "approved";
}

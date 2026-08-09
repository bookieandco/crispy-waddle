/**
 * Director Control Extension — canonical types.
 *
 * `DirectorControls` is additive cinematic intent that sits alongside a
 * shot's existing fields. It does not replace `lensMm` / `movement` /
 * `durationSec` / `lighting` — those remain the loose per-field values a
 * shot is drafted with. `DirectorControls` groups a *deliberate* director
 * pass on top of a shot (or a subset of shots) as one named object, the
 * way the spec asked for, without requiring every shot to carry it.
 */
export interface DirectorControls {
  lens?: string;
  cameraMovement?: string;
  framing?: string;
  lightingMood?: string;
  performanceIntensity?: string;
  durationSeconds?: number;
  /**
   * Optional id into the `lookPresets` catalog (see `polish.ts`). Applied
   * as a post-processing pass on the rendered prompt — a structured
   * photographic-treatment block meant to push output away from generic
   * "AI slop" look. Unset or unrecognized ids are a no-op.
   */
  lookPreset?: string;
}

export type ShotStatus = "draft" | "pending_approval" | "approved" | "rejected";

/**
 * An entity (character, prop, location, ...) with the locked traits that
 * keep its depiction consistent across shots. This is the real
 * character-consistency mechanism; `DirectorControls` sits alongside it
 * in a prompt, it does not touch or duplicate it.
 */
export interface Entity {
  id: string;
  name: string;
  lockedTraits: string[];
}

/**
 * Structural control conditioning for a reference asset — the taxonomy
 * ControlNet uses to constrain generation beyond what text can specify
 * (Mikubill/sd-webui-controlnet: pose skeletons, depth maps, edge maps,
 * loose reference-only, color/style transfer). This is a data taxonomy
 * only, not the extension itself — sd-webui-controlnet is a Python
 * AUTOMATIC1111 extension, wrong stack to vendor here, and doesn't
 * publish a portable schema of its own. `strength` mirrors ControlNet's
 * conditioning-weight concept (0–1; unset means "let the generator
 * decide," not zero).
 */
export type ControlType = "pose" | "depth" | "canny" | "reference-only" | "style";

/** A reference asset (image, plate, style board, ...) tied to an entity. */
export interface ReferenceAsset {
  id: string;
  entityId: string;
  uri: string;
  kind?: string;
  controlType?: ControlType;
  strength?: number;
}

/**
 * Canonical shot record.
 *
 * `director` is optional and additive: every shot created before this
 * extension, and every call site that builds a `Shot` without knowing
 * about `DirectorControls`, keeps compiling and behaving exactly as
 * before. There is no separate "DB-backed" vs. "emitter-local" Shot
 * split here — this codebase has no persistence layer for shots yet, so
 * introducing that split now would model a database that doesn't exist.
 * `director` lives on this one canonical type; if/when persistence is
 * added, it persists like any other optional field.
 */
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

/** Existing approval workflow gate: unchanged, unaware of `director`. */
export function isApproved(shot: Shot): boolean {
  return shot.status === "approved";
}

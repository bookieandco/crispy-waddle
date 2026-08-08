// lib/product3d/types.ts
//
// Shared types for the Product3D system. This is Layer 1 + the start of
// Layer 2 (Product Viewer + Asset Pipeline) from the roadmap: a generic
// engine driven by config, not hardcoded per product.
//
// One honest correction to the roadmap's example schema: it showed print
// areas as `{ name, uv: [...] }`. Decal placement in @react-three/drei
// (what this engine uses) doesn't work in raw UV space — it projects a
// texture onto the mesh from a 3D position + orientation, closer to how a
// sticker is aimed and pressed onto a surface than a UV paint operation.
// So PrintArea below uses position/rotation/scale, which is what the
// renderer actually accepts. Literal UV-space placement would mean a
// different technique entirely (baking the decal into the texture atlas
// ahead of time) — worth knowing if "uv" specifically matters later.

import type { ReactNode } from "react";

export interface PrintArea {
  /** e.g. "front", "back", "sleeve" — matches keys in the `decals` map passed to the engine */
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export interface Product3DCamera {
  position: [number, number, number];
  fov?: number;
  minDistance?: number;
  maxDistance?: number;
}

export interface Product3DConfig {
  id: string;
  displayName: string;
  /** path under /public, e.g. "/models/shirt_baked.glb" */
  glbPath: string;
  /** the mesh name inside the .glb (single-mesh models only for now — see README) */
  meshName: string;
  /** the material name inside the .glb */
  materialName: string;
  printAreas: PrintArea[];
  camera: Product3DCamera;
  defaultColor?: string;
  /** if true, `material-color` is applied; some baked materials ignore it */
  supportsColorChange?: boolean;
  /**
   * Corrective rotation [x,y,z] in radians, applied to the whole model at
   * render time. Some sourced/generated meshes (e.g. Stable Fast 3D output)
   * come oriented lying flat rather than standing upright — this fixes
   * that without touching the source geometry. [0,0,0] if the mesh is
   * already oriented correctly.
   */
  modelRotation?: [number, number, number];
  /**
   * Uniform scale multiplier applied to the whole model. Different source
   * pipelines export at wildly different unit scales (a Stable Fast 3D
   * shirt export vs. a modeled-in-cm pillow can differ by ~100x) — the
   * camera-distance heuristic in the audit pipeline compensates for this
   * automatically per-asset since each product renders in its own isolated
   * <Canvas>, so this defaults to 1 and usually doesn't need setting. It
   * starts to matter if multiple products are ever composited into one
   * shared scene (e.g. a future "see it in the boutique" 3D view) — at
   * that point mismatched units between assets would need this to line
   * them up. Not needed yet, but the field exists so it's not a rewrite
   * later.
   */
  modelScale?: number;
}

/** Map of print area name -> texture URL (or null if nothing generated for that area yet) */
export type DecalMap = Record<string, string | null>;

export interface Product3DPluginContext {
  config: Product3DConfig;
  canvasElement: HTMLCanvasElement | null;
}

/**
 * Extension point (roadmap item 6). A plugin can contribute extra R3F scene
 * content (lights, effects, future AR markers, etc.) and/or extra UI
 * controls rendered alongside the canvas — without the engine itself
 * needing to know what the plugin does. Only one real plugin exists today
 * (screenshot export); text-to-3D and AR are intentionally NOT built yet —
 * this is just the seam they'd plug into later.
 */
export interface Product3DPlugin {
  id: string;
  renderControls?: (ctx: Product3DPluginContext) => ReactNode;
}

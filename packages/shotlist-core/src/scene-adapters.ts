import type { SceneSpec } from "./scene.js";

export type SceneRenderTarget = "threejs" | "aframe" | "webxr" | "unity" | "custom";

export interface SceneRenderRequest {
  scene: SceneSpec;
  target: SceneRenderTarget;
  quality?: "preview" | "draft" | "final";
}

export interface SceneRenderResult {
  sceneId: string;
  target: SceneRenderTarget;
  previewUri?: string;
  artifactUri?: string;
  metadata?: Record<string, string>;
}

/** Rendering remains outside shotlist-core; adapters translate SceneSpec into a concrete renderer. */
export interface SceneRendererAdapter {
  readonly id: string;
  readonly target: SceneRenderTarget;
  canRender(request: SceneRenderRequest): boolean | Promise<boolean>;
  render(request: SceneRenderRequest): Promise<SceneRenderResult>;
}

export interface SceneAdapterRegistry {
  adapters: SceneRendererAdapter[];
  find(target: SceneRenderTarget): SceneRendererAdapter[];
}

export const sceneAdapterRegistry = (adapters: SceneRendererAdapter[]): SceneAdapterRegistry => ({
  adapters,
  find: (target) => adapters.filter((adapter) => adapter.target === target),
});

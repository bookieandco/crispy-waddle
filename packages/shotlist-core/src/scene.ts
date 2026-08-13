export type SceneNodeKind = "group" | "camera" | "light" | "mesh" | "character" | "prop" | "terrain" | "audio" | "effect";

export interface Vector3 { x: number; y: number; z: number; }
export interface Rotation3 { x: number; y: number; z: number; }
export interface Transform3 { position?: Vector3; rotation?: Rotation3; scale?: Vector3; }

export interface SceneCameraSpec {
  projection: "perspective" | "orthographic";
  focalLengthMm?: number;
  aperture?: number;
  sensorWidthMm?: number;
  nearClipM?: number;
  farClipM?: number;
  targetNodeId?: string;
  fixed?: boolean;
}

export interface SceneLightSpec {
  type: "point" | "spot" | "directional" | "area" | "environment";
  intensity?: number;
  color?: string;
  temperatureK?: number;
  castShadow?: boolean;
}

export interface SceneReference {
  id: string;
  uri: string;
  kind: "model" | "image" | "video" | "material" | "environment" | "motion";
  locked?: boolean;
  provenance?: string;
}

export interface SceneNodeSpec {
  id: string;
  kind: SceneNodeKind;
  name?: string;
  transform?: Transform3;
  parentId?: string;
  referenceId?: string;
  camera?: SceneCameraSpec;
  light?: SceneLightSpec;
  tags?: string[];
}

export interface SceneEnvironmentSpec {
  world?: string;
  latitude?: number;
  longitude?: number;
  elevationM?: number;
  terrain?: boolean;
  timeOfDay?: string;
  weather?: string;
  ambientIntensity?: number;
}

export interface SceneSpec {
  id: string;
  name: string;
  units: "meters" | "centimeters";
  nodes: SceneNodeSpec[];
  references: SceneReference[];
  environment?: SceneEnvironmentSpec;
  activeCameraId?: string;
  version: 1;
}

export interface SceneValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
}

export function validateScene(scene: SceneSpec): SceneValidationIssue[] {
  const issues: SceneValidationIssue[] = [];
  const ids = new Set<string>();
  for (const node of scene.nodes) {
    if (ids.has(node.id)) issues.push({ severity: "error", code: "duplicate_node_id", message: `Duplicate node id: ${node.id}`, nodeId: node.id });
    ids.add(node.id);
    if (node.parentId && !scene.nodes.some((candidate) => candidate.id === node.parentId)) {
      issues.push({ severity: "error", code: "missing_parent", message: `Missing parent node: ${node.parentId}`, nodeId: node.id });
    }
    if (node.referenceId && !scene.references.some((reference) => reference.id === node.referenceId)) {
      issues.push({ severity: "error", code: "missing_reference", message: `Missing reference: ${node.referenceId}`, nodeId: node.id });
    }
    if (node.kind === "camera" && !node.camera) issues.push({ severity: "warning", code: "camera_spec_missing", message: "Camera node has no camera specification", nodeId: node.id });
    if (node.kind === "light" && !node.light) issues.push({ severity: "warning", code: "light_spec_missing", message: "Light node has no light specification", nodeId: node.id });
  }
  if (scene.activeCameraId && !scene.nodes.some((node) => node.id === scene.activeCameraId && node.kind === "camera")) {
    issues.push({ severity: "error", code: "invalid_active_camera", message: `Active camera does not reference a camera node: ${scene.activeCameraId}` });
  }
  return issues;
}

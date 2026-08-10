export type ID = string;

export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
}

export interface Layer {
  id: ID;
  name: string;
  visible: boolean;
  metadata?: Record<string, unknown>;
}

export interface Marker {
  id: ID;
  layerId?: ID;
  position: GeoPoint;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface Route {
  id: ID;
  layerId?: ID;
  points: GeoPoint[];
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface SpatialAnnotation {
  id: ID;
  layerId?: ID;
  geometry: unknown;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface Measurement {
  id: ID;
  type: "distance" | "area" | "bearing";
  value: number;
  unit: string;
  geometry?: unknown;
}

export interface TimelineEvent {
  id: ID;
  timestamp: string;
  title: string;
  description?: string;
  spatialObjectIds?: ID[];
  metadata?: Record<string, unknown>;
}

export interface Scenario {
  id: ID;
  name: string;
  basePlanId: ID;
  changes: Record<string, unknown>;
  status: "draft" | "active" | "archived";
}

export interface PlanningPlan {
  id: ID;
  name: string;
  version: number;
  layers: Layer[];
  markers: Marker[];
  routes: Route[];
  annotations: SpatialAnnotation[];
  measurements: Measurement[];
  scenarios: Scenario[];
  timeline: TimelineEvent[];
  metadata?: Record<string, unknown>;
}

export interface PlanningProposal {
  id: ID;
  planId: ID;
  description: string;
  requestedAt: string;
  requestedBy: ID;
  actionType: string;
  payload: Record<string, unknown>;
}

/** Planning Core is descriptive/planning-only until a proposal crosses Jhadina policy enforcement. */
export interface PlanningPolicyBoundary {
  evaluate(proposal: PlanningProposal): Promise<{
    allowed: boolean;
    reason: string;
  }>;
}

export interface PlanningRegistry {
  getPlan(id: ID): Promise<PlanningPlan | null>;
  savePlan(plan: PlanningPlan): Promise<void>;
  listPlans(): Promise<PlanningPlan[]>;
  createProposal(proposal: PlanningProposal): Promise<void>;
}

export const PLANNING_CORE_VERSION = "0.1.0";

import type { PlacementActor } from "./command-api.js";
import type { PlacementDependencies } from "./composition.js";

export interface PlacementServerContext {
  actor: PlacementActor;
  requestId: string;
  dependencies: PlacementDependencies;
}

export function requirePlacementActor(actor: PlacementActor | null | undefined): PlacementActor {
  if (!actor?.userId || !actor.organizationId) {
    const error = new Error("Authenticated PlacementOS actor is required");
    error.name = "UnauthorizedError";
    throw error;
  }

  return actor;
}

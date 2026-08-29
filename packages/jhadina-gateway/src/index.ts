import type { PlacementCommandApi } from "../../placement-core/src/command-api.js";

export interface StaffingEventEnvelope<T = unknown> {
  id: string;
  type: string;
  occurredAt: string;
  source: "staffingos";
  payload: T;
}

export interface JhadinaStaffingGateway {
  inspect(event: StaffingEventEnvelope): Promise<{
    decision: "ALLOW" | "FLAG" | "ESCALATE";
    reason?: string;
  }>;
}

export function connectStaffingToJhadina(
  _commands: PlacementCommandApi,
  gateway: JhadinaStaffingGateway,
): JhadinaStaffingGateway {
  return gateway;
}

export * from "./command-gateway";
export * from "./command-entry-adapter";
export * from "./command-runtime";
export * from "./jhadina-runtime";
export * from "./control-plane-command";

import type { JhadinaCommand } from "../../jhadina-command-core/src";
import type { JhadinaControlPlane, ControlPlaneResponse } from "./control-plane-command";

export interface ControlPlaneRequest {
  utterance: string;
  source?: JhadinaCommand["source"];
  contextRefs?: string[];
}

export interface ControlPlaneTransport {
  submit(request: ControlPlaneRequest): Promise<ControlPlaneResponse>;
}

export function createControlPlaneTransport(
  controlPlane: JhadinaControlPlane,
  idFactory: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): ControlPlaneTransport {
  return {
    submit: (request) => controlPlane.submit({
      id: idFactory(),
      source: request.source ?? "text",
      utterance: request.utterance,
      occurredAt: now(),
      contextRefs: request.contextRefs,
    }),
  };
}

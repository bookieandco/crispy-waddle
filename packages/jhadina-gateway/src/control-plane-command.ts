import type { JhadinaCommand } from "../../jhadina-command-core/src";
import type { GatewayCommandRuntime, GatewayCommandResult } from "./command-runtime";

export interface ControlPlaneResponse {
  commandId: string;
  status: "completed" | "answered" | "needs_clarification" | "denied";
  result: GatewayCommandResult;
}

export class JhadinaControlPlane {
  constructor(private readonly runtime: GatewayCommandRuntime) {}

  async submit(command: JhadinaCommand): Promise<ControlPlaneResponse> {
    const result = await this.runtime.execute(command);
    const status = result.disposition === "execute"
      ? "completed"
      : result.disposition === "clarify"
        ? "needs_clarification"
        : result.disposition === "deny"
          ? "denied"
          : "answered";

    return { commandId: command.id, status, result };
  }
}

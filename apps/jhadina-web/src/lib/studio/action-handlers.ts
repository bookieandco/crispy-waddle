export type StudioAction = "voice-sync" | "qc" | "character-replace" | "rig" | "animate" | "render";
export type HandlerStatus = "ready" | "running" | "complete" | "failed";

export interface StudioActionRequest { action: StudioAction; projectId: string; inputIds: string[]; parameters?: Record<string, unknown>; requiresApproval?: boolean; }
export interface StudioActionResult { action: StudioAction; status: HandlerStatus; outputIds: string[]; qcRequired: boolean; message: string; }

export interface StudioActionHandler {
  action: StudioAction;
  execute(request: StudioActionRequest): Promise<StudioActionResult>;
}

export class StudioHandlerRegistry {
  private readonly handlers = new Map<StudioAction, StudioActionHandler>();
  register(handler: StudioActionHandler): void { this.handlers.set(handler.action, handler); }
  get(action: StudioAction): StudioActionHandler | undefined { return this.handlers.get(action); }
}

export async function executeStudioAction(registry: StudioHandlerRegistry, request: StudioActionRequest): Promise<StudioActionResult> {
  const handler = registry.get(request.action);
  if (!handler) return { action: request.action, status: "failed", outputIds: [], qcRequired: false, message: `No Studio handler registered for ${request.action}` };
  return handler.execute(request);
}

export const STUDIO_ACTIONS: StudioAction[] = ["voice-sync", "qc", "character-replace", "rig", "animate", "render"];

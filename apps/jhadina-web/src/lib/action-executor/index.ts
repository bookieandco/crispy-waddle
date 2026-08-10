export type ActionDomain = "studio" | "music" | "publishing" | "shopping" | "recipes" | "tv" | "podcast" | "money" | "awareness";
export type ActionStatus = "proposed" | "awaiting-approval" | "running" | "completed" | "failed" | "cancelled";
export type PolicyDecision = "allow" | "approval-required" | "deny";

export interface ActionRequest { id: string; domain: ActionDomain; intent: string; handler: string; parameters: Record<string, unknown>; reversible: boolean; externalSideEffect: boolean; }
export interface PolicyResult { decision: PolicyDecision; reasons: string[]; }
export interface ActionRecord extends ActionRequest { status: ActionStatus; createdAt: string; approvedAt?: string; completedAt?: string; error?: string; }

export interface ActionHandler { name: string; domains: ActionDomain[]; canHandle(request: ActionRequest): boolean; execute(request: ActionRequest): Promise<unknown>; }

export function createActionRequest(input: Omit<ActionRequest, "id">): ActionRequest {
  return { ...input, id: crypto.randomUUID() };
}

export function evaluatePolicy(request: ActionRequest): PolicyResult {
  if (!request.externalSideEffect) return { decision: "allow", reasons: ["No external side effect"] };
  if (request.reversible) return { decision: "approval-required", reasons: ["External side effect requires user approval"] };
  return { decision: "approval-required", reasons: ["Irreversible or external action requires explicit approval"] };
}

export class ActionExecutor {
  private readonly handlers = new Map<string, ActionHandler>();
  private readonly records = new Map<string, ActionRecord>();

  register(handler: ActionHandler): void { this.handlers.set(handler.name, handler); }
  get(id: string): ActionRecord | undefined { return this.records.get(id); }

  async execute(request: ActionRequest, approved = false): Promise<ActionRecord> {
    const policy = evaluatePolicy(request);
    if (policy.decision === "deny") throw new Error(policy.reasons.join("; "));
    if (policy.decision === "approval-required" && !approved) {
      const record: ActionRecord = { ...request, status: "awaiting-approval", createdAt: new Date().toISOString() };
      this.records.set(request.id, record);
      return record;
    }
    const handler = this.handlers.get(request.handler);
    if (!handler || !handler.canHandle(request)) throw new Error(`No handler available for ${request.handler}`);
    const running: ActionRecord = { ...request, status: "running", createdAt: new Date().toISOString(), ...(approved ? { approvedAt: new Date().toISOString() } : {}) };
    this.records.set(request.id, running);
    try {
      await handler.execute(request);
      const completed: ActionRecord = { ...running, status: "completed", completedAt: new Date().toISOString() };
      this.records.set(request.id, completed);
      return completed;
    } catch (error) {
      const failed: ActionRecord = { ...running, status: "failed", error: error instanceof Error ? error.message : String(error) };
      this.records.set(request.id, failed);
      return failed;
    }
  }
}

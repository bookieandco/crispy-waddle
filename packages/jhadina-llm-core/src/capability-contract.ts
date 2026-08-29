export type CapabilityRisk = "read" | "write" | "external" | "privileged";

export interface CapabilityContext {
  conversationId: string;
  userInstruction: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityResult {
  status: "completed" | "needs-approval" | "failed";
  content?: unknown;
  artifacts?: Array<{ id: string; type: string; uri?: string; metadata?: Record<string, unknown> }>;
  receipt?: Record<string, unknown>;
  error?: string;
}

export interface JhadinaCapability {
  readonly id: string;
  readonly description: string;
  readonly risks: CapabilityRisk[];
  canHandle(input: { task: string; instruction: string }): Promise<boolean> | boolean;
  execute(context: CapabilityContext): Promise<CapabilityResult>;
}

export interface CapabilityRegistry {
  register(capability: JhadinaCapability): void;
  list(): JhadinaCapability[];
  resolve(input: { task: string; instruction: string }): Promise<JhadinaCapability | null>;
}

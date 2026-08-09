import { getWorld, type JhadinaWorldId, type JhadinaWorldDefinition } from "./jhadina-world-registry";

export interface JhadinaWorldContext {
  world: JhadinaWorldDefinition;
  userId: string;
  route: string;
  memory: unknown[];
  preferences: Record<string, unknown>;
  awareness: unknown[];
  recentActivity: unknown[];
  permissions: Record<string, boolean>;
}

export function createWorldContext(input: {
  worldId: JhadinaWorldId;
  userId: string;
  route: string;
  memory?: unknown[];
  preferences?: Record<string, unknown>;
  awareness?: unknown[];
  recentActivity?: unknown[];
  permissions?: Record<string, boolean>;
}): JhadinaWorldContext {
  const world = getWorld(input.worldId);
  if (!world) throw new Error(`Unknown Jhadina world: ${input.worldId}`);

  return {
    world,
    userId: input.userId,
    route: input.route,
    memory: input.memory ?? [],
    preferences: input.preferences ?? {},
    awareness: input.awareness ?? [],
    recentActivity: input.recentActivity ?? [],
    permissions: input.permissions ?? {},
  };
}

export function canUseCapability(context: JhadinaWorldContext, capabilityId: string): boolean {
  const capability = context.world.capabilities.find((item) => item.id === capabilityId);
  return Boolean(capability?.enabled && context.permissions[capabilityId] !== false);
}

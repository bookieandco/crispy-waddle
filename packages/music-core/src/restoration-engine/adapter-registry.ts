import type { RestorationAdapter } from "./candidate-engine.js";
import type { RestorationCandidate, RestorationEvidence, RestorationPlan } from "./types.js";

export type RestorationCapability =
  | "analysis" | "denoise" | "declick" | "dehum" | "declip"
  | "spectral-repair" | "timebase" | "phase" | "vocal-restoration"
  | "singer-identity" | "audio-to-midi" | "tape-simulation" | "render"
  | "mix" | "generative-reconstruction";

export interface RegisteredRestorationAdapter extends RestorationAdapter {
  readonly capabilities: readonly RestorationCapability[];
  readonly version: string;
  readonly isolation: "in-process" | "subprocess" | "service";
  readonly license?: string;
}

/** Capability discovery only. Adapters remain isolated execution boundaries. */
export class RestorationAdapterRegistry {
  private readonly adapters = new Map<string, RegisteredRestorationAdapter>();

  register(adapter: RegisteredRestorationAdapter): void {
    if (this.adapters.has(adapter.id)) throw new Error(`Adapter already registered: ${adapter.id}`);
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): RegisteredRestorationAdapter | undefined { return this.adapters.get(id); }

  findByCapability(capability: RestorationCapability): readonly RegisteredRestorationAdapter[] {
    return [...this.adapters.values()].filter((a) => a.capabilities.includes(capability));
  }

  all(): readonly RegisteredRestorationAdapter[] { return [...this.adapters.values()]; }
}

export function createUnavailableAdapter(
  id: string,
  capability: RestorationCapability,
  version = "unbound",
): RegisteredRestorationAdapter {
  return {
    id, capabilities: [capability], version, isolation: "subprocess",
    operationClass: "reconstruction",
    supports: () => false,
    propose: (_input: { plan: RestorationPlan; evidence: readonly RestorationEvidence[] }): readonly RestorationCandidate[] => [],
  };
}

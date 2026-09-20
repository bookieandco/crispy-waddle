export type CapabilityRisk = 'read' | 'write' | 'external' | 'financial' | 'destructive';

export interface SubsystemHealthDefinition {
  readonly subsystemId: string;
  readonly capabilityIds: readonly string[];
  readonly dependencies: readonly string[];
  readonly protectedPaths: readonly string[];
  readonly diagnostics: {
    readonly healthChecks: readonly string[];
    readonly targetedTests: readonly string[];
    readonly regressionTests: readonly string[];
    readonly staticAnalysis: readonly string[];
    readonly runtimeEvidence: readonly string[];
  };
  readonly repair: {
    readonly governed: true;
    readonly executor: 'jhadina-evolution-core';
    readonly rollbackRequired: boolean;
    /** Informational only. Authorization is owned by Security Core's evolution capabilities. */
    readonly authorizationCapability: 'evolution.propose' | 'evolution.merge';
  };
  readonly invariants: readonly string[];
}

export interface CapabilityDefinition {
  readonly name: string;
  readonly description: string;
  readonly risk: CapabilityRisk;
  readonly version: number;
  readonly subsystemId?: string;
}

export class CapabilityRegistry {
  private readonly definitions = new Map<string, CapabilityDefinition>();
  private readonly subsystems = new Map<string, SubsystemHealthDefinition>();

  register(definition: CapabilityDefinition): void {
    if (!definition.name.trim()) throw new Error('Capability name is required');
    if (!Number.isInteger(definition.version) || definition.version < 1) throw new Error(`Invalid capability version: ${definition.name}`);
    if (this.definitions.has(definition.name)) throw new Error(`Capability already registered: ${definition.name}`);
    this.definitions.set(definition.name, Object.freeze({ ...definition }));
  }

  registerSubsystem(definition: SubsystemHealthDefinition): void {
    if (!definition.subsystemId.trim()) throw new Error('Subsystem id is required');
    if (this.subsystems.has(definition.subsystemId)) throw new Error(`Subsystem already registered: ${definition.subsystemId}`);
    for (const capabilityId of definition.capabilityIds) {
      if (!this.definitions.has(capabilityId)) throw new Error(`Unknown subsystem capability: ${capabilityId}`);
    }
    this.subsystems.set(definition.subsystemId, deepFreezeSubsystem(definition));
  }

  get(name: string): CapabilityDefinition | undefined { return this.definitions.get(name); }
  has(name: string): boolean { return this.definitions.has(name); }
  list(): readonly CapabilityDefinition[] { return [...this.definitions.values()].sort((a,b)=>a.name.localeCompare(b.name)); }
  getSubsystem(id: string): SubsystemHealthDefinition | undefined { return this.subsystems.get(id); }
  listSubsystems(): readonly SubsystemHealthDefinition[] { return [...this.subsystems.values()].sort((a,b)=>a.subsystemId.localeCompare(b.subsystemId)); }

  dependentsOf(subsystemId: string): readonly SubsystemHealthDefinition[] {
    return this.listSubsystems().filter((definition) => definition.dependencies.includes(subsystemId));
  }

  regressionCommandsFor(subsystemId: string): readonly string[] {
    const target = this.subsystems.get(subsystemId);
    if (!target) throw new Error(`Unknown subsystem: ${subsystemId}`);
    return [...new Set([...target.diagnostics.regressionTests, ...this.dependentsOf(subsystemId).flatMap((d)=>d.diagnostics.targetedTests)])];
  }
}

function deepFreezeSubsystem(input: SubsystemHealthDefinition): SubsystemHealthDefinition {
  return Object.freeze({
    ...input,
    capabilityIds: Object.freeze([...input.capabilityIds]),
    dependencies: Object.freeze([...input.dependencies]),
    protectedPaths: Object.freeze([...input.protectedPaths]),
    invariants: Object.freeze([...input.invariants]),
    diagnostics: Object.freeze({
      healthChecks: Object.freeze([...input.diagnostics.healthChecks]),
      targetedTests: Object.freeze([...input.diagnostics.targetedTests]),
      regressionTests: Object.freeze([...input.diagnostics.regressionTests]),
      staticAnalysis: Object.freeze([...input.diagnostics.staticAnalysis]),
      runtimeEvidence: Object.freeze([...input.diagnostics.runtimeEvidence]),
    }),
    repair: Object.freeze({ ...input.repair }),
  });
}

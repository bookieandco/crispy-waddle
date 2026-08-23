export type CapabilityRisk = 'read' | 'write' | 'external' | 'financial' | 'destructive';

export interface CapabilityDefinition {
  readonly name: string;
  readonly description: string;
  readonly risk: CapabilityRisk;
  readonly version: number;
}

export class CapabilityRegistry {
  private readonly definitions = new Map<string, CapabilityDefinition>();

  register(definition: CapabilityDefinition): void {
    if (!definition.name.trim()) throw new Error('Capability name is required');
    if (!Number.isInteger(definition.version) || definition.version < 1) {
      throw new Error(`Invalid capability version: ${definition.name}`);
    }
    if (this.definitions.has(definition.name)) {
      throw new Error(`Capability already registered: ${definition.name}`);
    }
    this.definitions.set(definition.name, Object.freeze({ ...definition }));
  }

  get(name: string): CapabilityDefinition | undefined {
    return this.definitions.get(name);
  }

  has(name: string): boolean {
    return this.definitions.has(name);
  }

  list(): readonly CapabilityDefinition[] {
    return [...this.definitions.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}

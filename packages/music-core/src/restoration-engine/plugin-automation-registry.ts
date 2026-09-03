import type { PluginDescriptor } from "./plugin-automation.js";

export interface PluginRegistryEntry extends PluginDescriptor {
  capabilities: string[];
  source: "builtin" | "external" | "user-approved";
}

/** Immutable-by-convention registry for discovered/approved plugin binaries. */
export class PluginAutomationRegistry {
  private readonly entries = new Map<string, PluginRegistryEntry>();

  register(entry: PluginRegistryEntry): void {
    if (this.entries.has(entry.id)) throw new Error(`Plugin already registered: ${entry.id}`);
    if (!entry.binaryHash) throw new Error("Plugin binary hash is required.");
    this.entries.set(entry.id, {
      ...entry,
      capabilities: [...new Set(entry.capabilities)],
      parameters: entry.parameters.map((parameter) => ({ ...parameter })),
    });
  }

  get(id: string): PluginRegistryEntry | undefined {
    const entry = this.entries.get(id);
    return entry ? { ...entry, capabilities: [...entry.capabilities], parameters: entry.parameters.map((p) => ({ ...p })) } : undefined;
  }

  require(id: string): PluginRegistryEntry {
    const entry = this.get(id);
    if (!entry) throw new Error(`Plugin is not registered: ${id}`);
    return entry;
  }

  list(): PluginRegistryEntry[] {
    return [...this.entries.values()].map((entry) => ({
      ...entry,
      capabilities: [...entry.capabilities],
      parameters: entry.parameters.map((p) => ({ ...p })),
    }));
  }
}

export function assertPluginBinary(plugin: PluginDescriptor, observedBinaryHash: string): void {
  if (plugin.binaryHash !== observedBinaryHash) {
    throw new Error("Plugin binary hash does not match the authorized descriptor.");
  }
}

import type { PluginDescriptor } from "./plugin-automation.js";
import type { Vst3DiscoveryResult, Vst3DiscoveryHost } from "./vst3-discovery.js";

export interface Vst3ProcessorHandle {
  release(): Promise<void>;
}

export interface Vst3InstantiationHost extends Vst3DiscoveryHost {
  createProcessor(classId: string): Promise<Vst3ProcessorHandle>;
}

/**
 * Creates only the processor component whose class identity and binary were
 * already proven by discovery. The edit controller is intentionally outside
 * this processing boundary.
 */
export async function instantiateAuthorizedVst3(
  host: Vst3InstantiationHost,
  descriptor: PluginDescriptor,
  discovery: Vst3DiscoveryResult,
): Promise<Vst3ProcessorHandle> {
  if (descriptor.format !== "vst3") {
    throw new Error("VST3 instantiation requires a VST3 descriptor");
  }
  if (discovery.binaryHash !== descriptor.binaryHash) {
    throw new Error("VST3 binary hash changed after discovery");
  }
  if (discovery.pluginPath !== `/workspace/plugins/${descriptor.id}`) {
    throw new Error("VST3 discovery path is not bound to the authorized plugin");
  }
  const component = await host.createProcessor(descriptor.id);
  if (!component) {
    throw new Error("VST3 processor instance was not created");
  }
  return component;
}

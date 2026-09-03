import type { NativePluginBackend } from "./native-plugin-worker.js";
import type { NativePluginIpcBinding, NativePluginRuntimeMetadata } from "./native-plugin-ipc.js";
import type { PluginAutomationPlan, PluginDescriptor } from "./plugin-automation.js";

/** Narrow native-host session boundary. The worker owns policy/lifecycle; the session owns native API calls. */
export interface NativeHostSession {
  discover(pluginPath: string): Promise<PluginDescriptor>;
  load(pluginPath: string): Promise<void>;
  configure(audio: NativePluginIpcBinding["audio"]): Promise<void>;
  setAutomation(automation: PluginAutomationPlan): Promise<void>;
  processBlock(sampleOffset: number, numSamples: number): Promise<void>;
  flush(): Promise<void>;
  collectMetadata(): Promise<NativePluginRuntimeMetadata>;
  shutdown(): Promise<void>;
}

/** Adapts a native VST3/CLAP host session without exposing authorization or promotion authority. */
export function createNativeHostBackend(session: NativeHostSession): NativePluginBackend {
  return {
    discover: (pluginPath) => session.discover(pluginPath),
    load: (pluginPath) => session.load(pluginPath),
    configure: (audio) => session.configure(audio),
    setAutomation: (request) => session.setAutomation(request.automation),
    processBlock: (sampleOffset, numSamples) => session.processBlock(sampleOffset, numSamples),
    flush: () => session.flush(),
    collectMetadata: () => session.collectMetadata(),
    shutdown: () => session.shutdown(),
  };
}

/** Native VST3 lifecycle mapped to the worker boundary. */
export const VST3_HOST_LIFECYCLE = [
  "discover", "load", "configure", "set_automation", "process_block", "flush", "collect_metadata", "shutdown",
] as const;

export type Vst3HostLifecycleStep = (typeof VST3_HOST_LIFECYCLE)[number];

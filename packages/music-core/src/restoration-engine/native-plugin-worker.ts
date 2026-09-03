import type { NativePluginIpcBinding, NativePluginIpcRequest, NativePluginIpcResponse, NativePluginIpcState, NativePluginRuntimeMetadata } from "./native-plugin-ipc.js";
import { NATIVE_PLUGIN_IPC_PROTOCOL, NATIVE_PLUGIN_IPC_VERSION, assertWorkerCannotAuthorizeOrPromote, validateNativePluginIpcRequest } from "./native-plugin-ipc.js";
import type { PluginDescriptor } from "./plugin-automation.js";

export interface NativePluginBackend {
  discover(pluginPath: string, binding: NativePluginIpcBinding): Promise<PluginDescriptor>;
  load(pluginPath: string, binding: NativePluginIpcBinding): Promise<void>;
  configure(audio: NativePluginIpcBinding["audio"]): Promise<void>;
  setAutomation(request: Extract<NativePluginIpcRequest, { type: "set_automation" }>): Promise<void>;
  processBlock(sampleOffset: number, numSamples: number): Promise<void>;
  flush(): Promise<void>;
  collectMetadata(): Promise<NativePluginRuntimeMetadata>;
  shutdown(): Promise<void>;
}

export interface NativePluginWorker { handle(request: NativePluginIpcRequest): Promise<NativePluginIpcResponse>; }

export function createNativePluginWorker(binding: NativePluginIpcBinding, backend: NativePluginBackend): NativePluginWorker {
  let state: NativePluginIpcState = "CREATED";
  let discovered: PluginDescriptor | undefined;
  const response = (request: NativePluginIpcRequest, extra: Partial<NativePluginIpcResponse> = {}): NativePluginIpcResponse => ({ protocol: NATIVE_PLUGIN_IPC_PROTOCOL, version: NATIVE_PLUGIN_IPC_VERSION, sequence: request.sequence, jobId: binding.jobId, executionId: binding.executionId, type: "ok", state, ...extra });
  const error = (request: NativePluginIpcRequest, e: unknown): NativePluginIpcResponse => ({ protocol: NATIVE_PLUGIN_IPC_PROTOCOL, version: NATIVE_PLUGIN_IPC_VERSION, sequence: request.sequence, jobId: binding.jobId, executionId: binding.executionId, type: "error", state, error: { code: "NATIVE_WORKER_FAILURE", message: e instanceof Error ? e.message : "Native plugin worker request failed." } });
  return { async handle(request) {
    validateNativePluginIpcRequest(request);
    if (request.binding.jobId !== binding.jobId || request.binding.executionId !== binding.executionId || request.binding.sourceHash !== binding.sourceHash || request.binding.plugin.binaryHash !== binding.plugin.binaryHash || request.binding.automationPlanHash !== binding.automationPlanHash) throw new Error("Native plugin worker binding mismatch.");
    assertWorkerCannotAuthorizeOrPromote(request.type);
    try {
      switch (request.type) {
        case "discover": discovered = await backend.discover(request.pluginPath, binding); state = "DISCOVERED"; return response(request, { metadata: { plugin: discovered, hostVersion: "jhadina-native-host", runtimeVersion: "1.0.0", format: binding.plugin.format, state } });
        case "load": if (!discovered) throw new Error("Plugin must be discovered before load."); await backend.load(request.pluginPath, binding); state = "LOADED"; return response(request);
        case "configure": await backend.configure(request.audio); state = "CONFIGURED"; return response(request);
        case "set_automation": await backend.setAutomation(request); state = "AUTOMATION_BOUND"; return response(request);
        case "process_block": await backend.processBlock(request.sampleOffset, request.numSamples); state = "PROCESSING"; return response(request);
        case "flush": await backend.flush(); state = "FLUSHING"; return response(request);
        case "collect_metadata": state = "COMPLETED"; return response(request, { metadata: await backend.collectMetadata() });
        case "shutdown": await backend.shutdown(); state = "SHUTDOWN"; return response(request);
      }
    } catch (e) { return error(request, e); }
  } };
}

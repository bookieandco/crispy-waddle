import type { NativePluginIpcBinding, NativePluginIpcRequest, NativePluginIpcResponse, NativePluginIpcState } from "./native-plugin-ipc.js";
import { assertNativePluginIpcTransition, createNativePluginIpcRequest } from "./native-plugin-ipc.js";

export interface NativePluginProcess {
  send(request: NativePluginIpcRequest): Promise<NativePluginIpcResponse>;
  terminate(): Promise<void>;
}

export interface NativePluginProcessFactory {
  spawn(binding: NativePluginIpcBinding): Promise<NativePluginProcess>;
}

export interface NativePluginProcessAdapter {
  discover(pluginPath: string): Promise<NativePluginIpcResponse>;
  load(pluginPath: string): Promise<NativePluginIpcResponse>;
  configure(): Promise<NativePluginIpcResponse>;
  bindAutomation(automation: NativePluginIpcRequest & { type: "set_automation" }): Promise<NativePluginIpcResponse>;
  processBlock(sampleOffset: number, numSamples: number): Promise<NativePluginIpcResponse>;
  flush(): Promise<NativePluginIpcResponse>;
  collectMetadata(): Promise<NativePluginIpcResponse>;
  shutdown(): Promise<NativePluginIpcResponse>;
}

const NEXT_STATE: Record<NativePluginIpcRequest["type"], NativePluginIpcState> = {
  discover: "DISCOVERED",
  load: "LOADED",
  configure: "CONFIGURED",
  set_automation: "AUTOMATION_BOUND",
  process_block: "PROCESSING",
  flush: "FLUSHING",
  collect_metadata: "COMPLETED",
  shutdown: "SHUTDOWN",
};

export function createNativePluginProcessAdapter(
  binding: NativePluginIpcBinding,
  factory: NativePluginProcessFactory,
): NativePluginProcessAdapter {
  let state: NativePluginIpcState = "CREATED";
  let sequence = 0;
  let process: NativePluginProcess | undefined;

  const ensureProcess = async (): Promise<NativePluginProcess> => {
    process ??= await factory.spawn(binding);
    return process;
  };

  const dispatch = async (
    type: NativePluginIpcRequest["type"],
    extra: Record<string, unknown> = {},
  ): Promise<NativePluginIpcResponse> => {
    assertNativePluginIpcTransition(state, type);
    const request = createNativePluginIpcRequest({
      protocol: "jhadina.music.native-plugin-ipc.v1",
      version: 1,
      sequence,
      binding,
      type,
      state,
      ...extra,
    } as NativePluginIpcRequest);
    const worker = await ensureProcess();
    const response = await worker.send(request);
    if (response.protocol !== request.protocol || response.version !== request.version) {
      throw new Error("Native plugin worker protocol mismatch.");
    }
    if (response.sequence !== request.sequence || response.jobId !== binding.jobId || response.executionId !== binding.executionId) {
      throw new Error("Native plugin worker response binding mismatch.");
    }
    if (response.type === "error") throw new Error(response.error?.message ?? "Native plugin worker request failed.");
    state = NEXT_STATE[type];
    sequence += 1;
    return response;
  };

  return {
    discover: (pluginPath) => dispatch("discover", { pluginPath: undefined }),
    load: (pluginPath) => dispatch("load", { pluginPath }),
    configure: () => dispatch("configure", { audio: binding.audio }),
    bindAutomation: (automation) => dispatch("set_automation", { automation }),
    processBlock: (sampleOffset, numSamples) => dispatch("process_block", { sampleOffset, numSamples }),
    flush: () => dispatch("flush"),
    collectMetadata: () => dispatch("collect_metadata"),
    shutdown: async () => {
      const response = await dispatch("shutdown");
      await process?.terminate();
      process = undefined;
      return response;
    },
  };
}

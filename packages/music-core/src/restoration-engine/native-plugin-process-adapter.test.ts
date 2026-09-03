import { describe, expect, it } from "vitest";
import { createNativePluginProcessAdapter, type NativePluginProcessFactory } from "./native-plugin-process-adapter.js";
import type { NativePluginIpcBinding, NativePluginIpcRequest, NativePluginIpcResponse } from "./native-plugin-ipc.js";

const binding: NativePluginIpcBinding = {
  jobId: "job:1", executionId: "exec:1", sourceArtifactId: "src:1", sourceHash: "0123456789abcdef0123456789abcdef",
  plugin: { id: "plugin:1", vendor: "Vendor", name: "Plugin", version: "1.0.0", format: "vst3", binaryHash: "abcdef0123456789abcdef0123456789" },
  automationPlanId: "auto:1", automationPlanHash: "abcdef0123456789abcdef0123456789", authorizationReceiptId: "receipt:1",
  audio: { sampleRate: 48000, channels: 2, blockSize: 512 }, inputPath: "/workspace/in.wav", outputPath: "/workspace/out.wav",
};

const factory: NativePluginProcessFactory = {
  spawn: async () => ({
    send: async (request: NativePluginIpcRequest): Promise<NativePluginIpcResponse> => ({ protocol: request.protocol, version: request.version, sequence: request.sequence, jobId: request.binding.jobId, executionId: request.binding.executionId, type: "ok", state: request.state }),
    terminate: async () => undefined,
  }),
};

describe("native plugin process adapter", () => {
  it("drives the worker through the authorized lifecycle", async () => {
    const adapter = createNativePluginProcessAdapter(binding, factory);
    await adapter.discover("/workspace/plugin.vst3");
    await adapter.load("/workspace/plugin.vst3");
    await adapter.configure();
    const automation = { protocol: "jhadina.music.native-plugin-ipc.v1" as const, version: 1 as const, sequence: 3, binding, type: "set_automation" as const, state: "CONFIGURED" as const, automation: { id: "auto:1", pluginId: "plugin:1", pluginBinaryHash: binding.plugin.binaryHash, sourceArtifactId: "src:1", tracks: [], allowedParameterIds: [], protectedRegions: [], maxParameterDelta: {}, evidenceIds: [] } };
    await adapter.bindAutomation(automation);
    await adapter.processBlock(0, 512);
    await adapter.flush();
    await adapter.collectMetadata();
    await adapter.shutdown();
  });

  it("fails closed when the worker returns an error", async () => {
    const badFactory: NativePluginProcessFactory = { spawn: async () => ({ send: async (request) => ({ protocol: request.protocol, version: request.version, sequence: request.sequence, jobId: request.binding.jobId, executionId: request.binding.executionId, type: "error", state: request.state, error: { code: "PLUGIN_FAILURE", message: "native failure" } }), terminate: async () => undefined }) };
    const adapter = createNativePluginProcessAdapter(binding, badFactory);
    await expect(adapter.discover("/workspace/plugin.vst3")).rejects.toThrow("native failure");
  });

  it("rejects illegal lifecycle calls", async () => {
    const adapter = createNativePluginProcessAdapter(binding, factory);
    await expect(adapter.processBlock(0, 1)).rejects.toThrow(/transition/);
  });
});

import { describe, expect, it } from "vitest";
import {
  assertNativePluginIpcTransition,
  assertWorkerCannotAuthorizeOrPromote,
  createNativePluginIpcRequest,
  type NativePluginIpcBinding,
  type NativePluginIpcRequest,
} from "./native-plugin-ipc.js";
import type { PluginAutomationPlan } from "./plugin-automation.js";

const binding: NativePluginIpcBinding = {
  jobId: "job:1",
  executionId: "exec:1",
  sourceArtifactId: "src:1",
  sourceHash: "0123456789abcdef0123456789abcdef",
  plugin: { id: "plugin:1", vendor: "Vendor", name: "Plugin", version: "1.0.0", format: "vst3", binaryHash: "abcdef0123456789abcdef0123456789" },
  automationPlanId: "auto:1",
  automationPlanHash: "abcdef0123456789abcdef0123456789",
  authorizationReceiptId: "receipt:1",
  audio: { sampleRate: 48000, channels: 2, blockSize: 512 },
  inputPath: "/workspace/in.wav",
  outputPath: "/workspace/out.wav",
};

const base = { protocol: "jhadina.music.native-plugin-ipc.v1" as const, version: 1 as const, sequence: 0, binding };
const automation: PluginAutomationPlan = {
  id: "auto:1", pluginId: "plugin:1", pluginBinaryHash: binding.plugin.binaryHash, sourceArtifactId: "src:1",
  tracks: [], allowedParameterIds: [], protectedRegions: [], maxParameterDelta: {}, evidenceIds: [],
};

function request(type: NativePluginIpcRequest["type"], state: NativePluginIpcRequest["state"], extra: Record<string, unknown> = {}): NativePluginIpcRequest {
  return { ...base, type, state, ...extra } as NativePluginIpcRequest;
}

describe("native plugin IPC contract", () => {
  it("rejects protocol version drift", () => {
    expect(() => createNativePluginIpcRequest({ ...request("discover", "CREATED"), version: 2 } as never)).toThrow(/protocol version/);
  });

  it("requires valid source and plugin hashes", () => {
    expect(() => createNativePluginIpcRequest({ ...request("discover", "CREATED"), binding: { ...binding, sourceHash: "not-a-hash" } })).toThrow(/source hash/);
    expect(() => createNativePluginIpcRequest({ ...request("discover", "CREATED"), binding: { ...binding, plugin: { ...binding.plugin, binaryHash: "not-a-hash" } })).toThrow(/binary hash/);
  });

  it("rejects sandbox path traversal", () => {
    expect(() => createNativePluginIpcRequest({ ...request("load", "DISCOVERED"), pluginPath: "/workspace/../plugin.vst3" })).toThrow(/workspace/);
  });

  it("rejects invalid audio configuration", () => {
    expect(() => createNativePluginIpcRequest({ ...request("configure", "LOADED"), audio: { sampleRate: 0, channels: 2, blockSize: 512 } })).toThrow(/sample rate/);
    expect(() => createNativePluginIpcRequest({ ...request("configure", "LOADED"), audio: { sampleRate: 48000, channels: 2, blockSize: 0 } })).toThrow(/block size/);
  });

  it("rejects process before automation is bound", () => {
    expect(() => createNativePluginIpcRequest(request("process_block", "CONFIGURED"))).toThrow(/transition/);
  });

  it("rejects automation before configuration", () => {
    expect(() => createNativePluginIpcRequest({ ...request("set_automation", "LOADED"), automation })).toThrow(/transition/);
  });

  it("rejects automation bound to the wrong source or plugin binary", () => {
    expect(() => createNativePluginIpcRequest({ ...request("set_automation", "CONFIGURED"), automation: { ...automation, sourceArtifactId: "src:other" } })).toThrow(/source artifact/);
    expect(() => createNativePluginIpcRequest({ ...request("set_automation", "CONFIGURED"), automation: { ...automation, pluginBinaryHash: "0123456789abcdef0123456789abcdef" } })).toThrow(/plugin hash/);
  });

  it("rejects process after shutdown", () => {
    expect(() => assertNativePluginIpcTransition("SHUTDOWN", "process_block")).toThrow(/transition/);
  });

  it("rejects worker authorization and promotion attempts", () => {
    expect(() => assertWorkerCannotAuthorizeOrPromote("authorize")).toThrow(/cannot authorize/);
    expect(() => assertWorkerCannotAuthorizeOrPromote("promote")).toThrow(/cannot authorize/);
    expect(() => assertWorkerCannotAuthorizeOrPromote("commit")).toThrow(/cannot authorize/);
  });

  it("accepts the full lifecycle in order", () => {
    const lifecycle: Array<[NativePluginIpcRequest["type"], NativePluginIpcRequest["state"], Record<string, unknown>]> = [
      ["discover", "CREATED", {}],
      ["load", "DISCOVERED", { pluginPath: "/workspace/plugin.vst3" }],
      ["configure", "LOADED", { audio: binding.audio }],
      ["set_automation", "CONFIGURED", { automation }],
      ["process_block", "AUTOMATION_BOUND", { sampleOffset: 0, numSamples: 512 }],
      ["flush", "PROCESSING", {}],
      ["collect_metadata", "FLUSHING", {}],
      ["shutdown", "COMPLETED", {}],
    ];
    for (const [type, state, extra] of lifecycle) expect(() => createNativePluginIpcRequest(request(type, state, extra))).not.toThrow();
  });
});

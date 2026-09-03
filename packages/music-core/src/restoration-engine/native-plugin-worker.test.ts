import assert from "node:assert/strict";
import test from "node:test";
import { assertWorkerCannotAuthorizeOrPromote, createNativePluginIpcBinding, createNativePluginIpcRequest } from "./native-plugin-ipc.js";

test("native worker contract rejects authorization and promotion authority", () => {
  assert.throws(() => assertWorkerCannotAuthorizeOrPromote("authorize"));
  assert.throws(() => assertWorkerCannotAuthorizeOrPromote("promote"));
  assert.throws(() => assertWorkerCannotAuthorizeOrPromote("commit"));
});

test("native worker contract accepts only workspace plugin paths", () => {
  const binding = createNativePluginIpcBinding({
    jobId: "job-1",
    executionId: "exec-1",
    sourceArtifactId: "source-1",
    sourceHash: "0123456789abcdef0123456789abcdef",
    plugin: { id: "plugin-1", vendor: "test", name: "Test", version: "1", format: "vst3", binaryHash: "abcdef0123456789abcdef0123456789" },
    automationPlanId: "automation-1",
    automationPlanHash: "abcdef0123456789abcdef0123456789",
    authorizationReceiptId: "receipt-1",
    audio: { sampleRate: 48000, channels: 2, blockSize: 512 },
    inputPath: "/workspace/input.wav",
    outputPath: "/workspace/output.wav",
  });

  assert.throws(() => createNativePluginIpcRequest({
    protocol: "jhadina.music.native-plugin-ipc.v1",
    version: 1,
    sequence: 0,
    binding,
    type: "load",
    state: "DISCOVERED",
    pluginPath: "/tmp/escape.vst3",
  }));
});

test("native worker contract rejects oversized process blocks", () => {
  const binding = createNativePluginIpcBinding({
    jobId: "job-2",
    executionId: "exec-2",
    sourceArtifactId: "source-2",
    sourceHash: "0123456789abcdef0123456789abcdef",
    plugin: { id: "plugin-2", vendor: "test", name: "Test", version: "1", format: "clap", binaryHash: "abcdef0123456789abcdef0123456789" },
    automationPlanId: "automation-2",
    automationPlanHash: "abcdef0123456789abcdef0123456789",
    authorizationReceiptId: "receipt-2",
    audio: { sampleRate: 44100, channels: 2, blockSize: 128 },
    inputPath: "/workspace/input.wav",
    outputPath: "/workspace/output.wav",
  });

  assert.throws(() => createNativePluginIpcRequest({
    protocol: "jhadina.music.native-plugin-ipc.v1",
    version: 1,
    sequence: 0,
    binding,
    type: "process_block",
    state: "AUTOMATION_BOUND",
    sampleOffset: 0,
    numSamples: 129,
  }));
});

import assert from "node:assert/strict";
import test from "node:test";
import { createNativeHostBackend, VST3_HOST_LIFECYCLE, type NativeHostSession } from "./native-host-backend.js";
import type { NativePluginIpcBinding } from "./native-plugin-ipc.js";
import type { PluginAutomationPlan, PluginDescriptor } from "./plugin-automation.js";

const audio: NativePluginIpcBinding["audio"] = { sampleRate: 48000, channels: 2, blockSize: 512 };
const descriptor: PluginDescriptor = {
  id: "plugin-1",
  vendor: "test",
  name: "Test",
  version: "1.0.0",
  format: "vst3",
  binaryHash: "abcdef0123456789abcdef0123456789",
  parameters: [],
};
const automation = { pluginId: descriptor.id, pluginBinaryHash: descriptor.binaryHash, sourceArtifactId: "source-1", tracks: [], maxParameterDelta: {}, protectedRegions: [] } as PluginAutomationPlan;

test("native host backend preserves the canonical VST3 lifecycle", () => {
  assert.deepEqual(VST3_HOST_LIFECYCLE, [
    "discover", "load", "configure", "set_automation", "process_block", "flush", "collect_metadata", "shutdown",
  ]);
});

test("native host backend forwards operations without adding authority", async () => {
  const calls: string[] = [];
  const session: NativeHostSession = {
    async discover(path) { calls.push(`discover:${path}`); return descriptor; },
    async load(path) { calls.push(`load:${path}`); },
    async configure(value) { calls.push(`configure:${value.sampleRate}:${value.channels}:${value.blockSize}`); },
    async setAutomation(value) { calls.push(`automation:${value.pluginId}`); },
    async processBlock(offset, samples) { calls.push(`process:${offset}:${samples}`); },
    async flush() { calls.push("flush"); },
    async collectMetadata() { calls.push("metadata"); return { pluginId: descriptor.id, pluginBinaryHash: descriptor.binaryHash }; },
    async shutdown() { calls.push("shutdown"); },
  };

  const backend = createNativeHostBackend(session);
  assert.deepEqual(await backend.discover("/workspace/plugins/plugin-1"), descriptor);
  await backend.load("/workspace/plugins/plugin-1");
  await backend.configure(audio);
  await backend.setAutomation({ automation } as never);
  await backend.processBlock(0, 512);
  await backend.flush();
  assert.deepEqual(await backend.collectMetadata(), { pluginId: descriptor.id, pluginBinaryHash: descriptor.binaryHash });
  await backend.shutdown();

  assert.deepEqual(calls, [
    "discover:/workspace/plugins/plugin-1",
    "load:/workspace/plugins/plugin-1",
    "configure:48000:2:512",
    "automation:plugin-1",
    "process:0:512",
    "flush",
    "metadata",
    "shutdown",
  ]);
});

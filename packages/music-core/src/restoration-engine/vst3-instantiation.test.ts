import assert from "node:assert/strict";
import test from "node:test";
import { instantiateAuthorizedVst3 } from "./vst3-instantiation.js";
import type { PluginDescriptor } from "./plugin-automation.js";

const descriptor: PluginDescriptor = {
  id: "plugin-1", vendor: "Acme", name: "Restorer", version: "1.0.0", format: "vst3", binaryHash: "abcdef0123456789abcdef0123456789",
};

const discovery = {
  pluginPath: "/workspace/plugins/plugin-1",
  binaryHash: descriptor.binaryHash,
  factory: { vendor: "Acme", url: "https://example.invalid", email: "host@example.invalid" },
  classes: [{ classId: descriptor.id, name: descriptor.name, vendor: descriptor.vendor, version: descriptor.version, category: "Fx" }],
} as const;

test("instantiates only the discovered authorized VST3 processor", async () => {
  let created = "";
  const handle = { release: async () => undefined };
  const host = {
    discover: async () => discovery,
    createProcessor: async (classId: string) => { created = classId; return handle; },
  };
  const result = await instantiateAuthorizedVst3(host, descriptor, discovery);
  assert.equal(result, handle);
  assert.equal(created, descriptor.id);
});

test("rejects a post-discovery binary hash change", async () => {
  const host = { discover: async () => discovery, createProcessor: async () => ({ release: async () => undefined }) };
  await assert.rejects(() => instantiateAuthorizedVst3(host, descriptor, { ...discovery, binaryHash: "0123456789abcdef0123456789abcdef" }));
});

test("rejects discovery outside the authorized plugin workspace", async () => {
  const host = { discover: async () => discovery, createProcessor: async () => ({ release: async () => undefined }) };
  await assert.rejects(() => instantiateAuthorizedVst3(host, descriptor, { ...discovery, pluginPath: "/tmp/plugin-1" }));
});

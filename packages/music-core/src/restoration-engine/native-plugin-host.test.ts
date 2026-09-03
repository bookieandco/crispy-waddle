import { describe, expect, it } from "vitest";
import { discoverAuthorizedPlugin, renderAuthorizedPlugin, type NativePluginHost } from "./native-plugin-host.js";
import type { PluginDescriptor, PluginAutomationPlan } from "./plugin-automation.js";

const plugin: PluginDescriptor = { id: "lsp:test", vendor: "LSP Plugins", name: "Test", version: "1.0", format: "vst3", binaryHash: "sha256:abc", parameters: [{ id: "gain", name: "Gain", stepCount: 0, defaultNormalizedValue: .5, automatable: true }] };
const automation: PluginAutomationPlan = { id: "auto:1", pluginId: plugin.id, pluginBinaryHash: plugin.binaryHash, sourceArtifactId: "src:1", tracks: [], allowedParameterIds: [], protectedRegions: [], maxParameterDelta: {}, evidenceIds: [] };
const request = { plugin, automation, inputPath: "/workspace/in.wav", outputPath: "/workspace/out.wav", sampleRate: 48000, channels: 2 };
const identity = { ...plugin, parameters: plugin.parameters };

const host: NativePluginHost = {
  discover: async () => identity,
  render: async () => ({ exitCode: 0, outputPath: request.outputPath, outputHash: "sha256:out" }),
};

describe("native plugin host boundary", () => {
  it("accepts matching discovered identity", async () => { await expect(discoverAuthorizedPlugin(plugin, "/workspace/plugins/lsp-test.vst3", host)).resolves.toEqual(identity); });
  it("rejects a binary identity change", async () => { const bad = { ...identity, binaryHash: "sha256:bad" }; const h = { ...host, discover: async () => bad }; await expect(discoverAuthorizedPlugin(plugin, "/workspace/p.vst3", h)).rejects.toThrow(/binary hash/); });
  it("rejects parameter metadata drift", async () => { const bad = { ...identity, parameters: [{ ...identity.parameters[0], stepCount: 1 }] }; const h = { ...host, discover: async () => bad }; await expect(discoverAuthorizedPlugin(plugin, "/workspace/p.vst3", h)).rejects.toThrow(/parameter metadata/); });
  it("rejects plugin paths outside the sandbox", async () => { await expect(discoverAuthorizedPlugin(plugin, "/etc/plugin.vst3", host)).rejects.toThrow(/sandbox workspace/); });
  it("binds automation to the discovered binary before render", async () => { await expect(renderAuthorizedPlugin(plugin, request, host)).resolves.toMatchObject({ outputPath: "/workspace/out.wav" }); });
  it("rejects a mismatched request descriptor", async () => { const other = { ...plugin, id: "other" }; await expect(renderAuthorizedPlugin(plugin, { ...request, plugin: other }, host)).rejects.toThrow(/does not match registered/); });
});

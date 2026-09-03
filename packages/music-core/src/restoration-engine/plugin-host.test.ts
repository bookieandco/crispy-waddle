import { describe, expect, it } from "vitest";
import { createPluginHostCommand, validatePluginHostRequest, validatePluginHostResult, type PluginHostRequest } from "./plugin-host.js";

const request: PluginHostRequest = {
  plugin: { id: "lsp:test", vendor: "LSP", name: "Test", version: "1", format: "vst3", binaryHash: "sha256:plugin", parameters: [] },
  automation: { id: "auto:1", pluginId: "lsp:test", pluginBinaryHash: "sha256:plugin", sourceArtifactId: "src:1", tracks: [], allowedParameterIds: [], protectedRegions: [], maxParameterDelta: {}, evidenceIds: [] },
  inputPath: "/workspace/input.wav",
  outputPath: "/workspace/output.wav",
  sampleRate: 48000,
  channels: 2,
};

describe("plugin host boundary", () => {
  it("binds plugin identity, hash, automation and sandbox paths", () => {
    const command = createPluginHostCommand(request);
    expect(command.workingDirectory).toBe("/workspace");
    expect(command.argv).toContain("--format");
    expect(command.argv).toContain("vst3");
    expect(command.argv).toContain("--plugin-binary-hash");
    expect(command.argv).toContain("sha256:plugin");
    expect(command.argv).toContain("--automation-plan");
    expect(command.argv).toContain("auto:1");
  });

  it("rejects plugin/hash mismatch", () => {
    expect(() => validatePluginHostRequest({ ...request, automation: { ...request.automation, pluginBinaryHash: "sha256:other" } })).toThrow();
  });

  it("rejects paths outside the sandbox workspace", () => {
    expect(() => validatePluginHostRequest({ ...request, inputPath: "/tmp/input.wav" })).toThrow();
  });

  it("rejects traversal", () => {
    expect(() => validatePluginHostRequest({ ...request, outputPath: "/workspace/../escape.wav" })).toThrow();
  });

  it("rejects non-VST3/CLAP formats", () => {
    expect(() => validatePluginHostRequest({ ...request, plugin: { ...request.plugin, format: "lv2" } })).toThrow();
  });

  it("rejects host failures and output mismatch", () => {
    expect(() => validatePluginHostResult(request, { exitCode: 1, outputPath: request.outputPath })).toThrow();
    expect(() => validatePluginHostResult(request, { exitCode: 0, outputPath: "/workspace/other.wav" })).toThrow();
  });
});

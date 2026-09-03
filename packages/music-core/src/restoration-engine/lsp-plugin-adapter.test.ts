import { describe, expect, it } from "vitest";
import { createLspPluginExecutionPlan, validateLspPluginResult } from "./lsp-plugin-adapter.js";
import type { PluginRegistryEntry } from "./plugin-automation-registry.js";

const plugin: PluginRegistryEntry = {
  id: "lsp:test",
  vendor: "LSP Plugins",
  name: "Test EQ",
  version: "1.0.0",
  format: "vst3",
  binaryHash: "sha256:plugin",
  capabilities: ["eq"],
  source: "user-approved",
  parameters: [{ id: "gain", name: "Gain", stepCount: 100, defaultNormalizedValue: 0.5, automatable: true }],
};

const automation = {
  id: "automation:1",
  pluginId: plugin.id,
  pluginBinaryHash: plugin.binaryHash,
  sourceArtifactId: "source:1",
  tracks: [],
  allowedParameterIds: [],
  protectedRegions: [],
  maxParameterDelta: {},
  evidenceIds: [],
};

describe("LSP plugin adapter", () => {
  it("creates a host plan only for a matching registered binary", () => {
    const plan = createLspPluginExecutionPlan({
      plugin,
      automation,
      observedBinaryHash: "sha256:plugin",
      inputPath: "/workspace/in.wav",
      outputPath: "/workspace/out.wav",
      sampleRate: 48000,
      channels: 2,
    });
    expect(plan.command.argv).toContain("--format");
    expect(plan.command.argv).toContain("vst3");
    expect(plan.command.argv).toContain("--plugin-binary-hash");
    expect(plan.command.workingDirectory).toBe("/workspace");
  });

  it("rejects a binary that differs from the registered hash", () => {
    expect(() => createLspPluginExecutionPlan({
      plugin,
      automation,
      observedBinaryHash: "sha256:other",
      inputPath: "/workspace/in.wav",
      outputPath: "/workspace/out.wav",
      sampleRate: 48000,
      channels: 2,
    })).toThrow(/binary hash/i);
  });

  it("rejects non-LSP plugins", () => {
    expect(() => createLspPluginExecutionPlan({
      plugin: { ...plugin, vendor: "Other Vendor" },
      automation,
      observedBinaryHash: plugin.binaryHash,
      inputPath: "/workspace/in.wav",
      outputPath: "/workspace/out.wav",
      sampleRate: 48000,
      channels: 2,
    })).toThrow(/LSP/i);
  });

  it("rejects output identity drift", () => {
    const plan = createLspPluginExecutionPlan({
      plugin,
      automation,
      observedBinaryHash: plugin.binaryHash,
      inputPath: "/workspace/in.wav",
      outputPath: "/workspace/out.wav",
      sampleRate: 48000,
      channels: 2,
    });
    expect(() => validateLspPluginResult(plan, { exitCode: 0, outputPath: "/workspace/other.wav" })).toThrow(/output path/i);
  });
});

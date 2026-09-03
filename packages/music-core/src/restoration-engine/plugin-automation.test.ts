import { describe, expect, it } from "vitest";
import { validatePluginAutomationPlan, type PluginAutomationPlan, type PluginDescriptor } from "./plugin-automation.js";

const plugin: PluginDescriptor = {
  id: "lsp:eq",
  vendor: "LSP",
  name: "EQ",
  version: "1.0.0",
  format: "vst3",
  binaryHash: "sha256:plugin",
  parameters: [
    { id: "gain", name: "Gain", unit: "dB", stepCount: 0, defaultNormalizedValue: 0.5, automatable: true },
    { id: "meter", name: "Meter", stepCount: 0, defaultNormalizedValue: 0, automatable: false },
  ],
};

const plan = (overrides: Partial<PluginAutomationPlan> = {}): PluginAutomationPlan => ({
  id: "automation-1",
  pluginId: plugin.id,
  pluginBinaryHash: plugin.binaryHash,
  sourceArtifactId: "source",
  tracks: [{ parameterId: "gain", points: [{ sampleOffset: 0, normalizedValue: 0.5 }, { sampleOffset: 1000, normalizedValue: 0.55 }] }],
  allowedParameterIds: ["gain"],
  protectedRegions: [{ startSample: 2000, endSample: 3000 }],
  maxParameterDelta: { gain: 0.1 },
  evidenceIds: ["e1"],
  ...overrides,
});

describe("plugin automation policy", () => {
  it("accepts stable, authorized automation", () => {
    expect(validatePluginAutomationPlan(plugin, plan()).allowed).toBe(true);
  });

  it("rejects unknown or non-automatable parameters", () => {
    const result = validatePluginAutomationPlan(plugin, plan({
      tracks: [
        { parameterId: "meter", points: [{ sampleOffset: 0, normalizedValue: 0.2 }] },
        { parameterId: "missing", points: [{ sampleOffset: 0, normalizedValue: 0.2 }] },
      ],
    }));
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("not automatable");
    expect(result.reasons.join(" ")).toContain("Unknown plugin parameter");
  });

  it("rejects automation outside the policy, excessive deltas, and protected regions", () => {
    const result = validatePluginAutomationPlan(plugin, plan({
      tracks: [{ parameterId: "gain", points: [
        { sampleOffset: 2500, normalizedValue: 0.9 },
        { sampleOffset: 4000, normalizedValue: 0.1 },
      ] }],
      allowedParameterIds: [],
      maxParameterDelta: { gain: 0.1 },
    }));
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("outside the automation policy");
    expect(result.reasons.join(" ")).toContain("protected region");
    expect(result.reasons.join(" ")).toContain("exceeds policy");
  });

  it("rejects a plugin binary that is different from the authorized one", () => {
    const result = validatePluginAutomationPlan(plugin, plan({ pluginBinaryHash: "sha256:other" }));
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("Plugin binary hash does not match the authorized descriptor.");
  });
});

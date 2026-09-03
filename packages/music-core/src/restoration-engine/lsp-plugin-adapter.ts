import type { AudioCommand } from "./audio-execution-sandbox.js";
import { assertPluginBinary, type PluginRegistryEntry } from "./plugin-automation-registry.js";
import type { PluginAutomationPlan } from "./plugin-automation.js";
import { createPluginHostCommand, validatePluginHostRequest, type PluginHostRequest, type PluginHostResult } from "./plugin-host.js";

export interface LspPluginRequest {
  plugin: PluginRegistryEntry;
  automation: PluginAutomationPlan;
  observedBinaryHash: string;
  inputPath: string;
  outputPath: string;
  sampleRate: number;
  channels: number;
}

export interface LspPluginExecutionPlan {
  hostRequest: PluginHostRequest;
  command: AudioCommand;
}

/**
 * LSP-specific admission layer. It does not load native code or authorize
 * execution; it converts an already-registered LSP plugin into the neutral
 * host contract after rechecking binary identity.
 */
export function createLspPluginExecutionPlan(request: LspPluginRequest): LspPluginExecutionPlan {
  if (!request.plugin.vendor.toLowerCase().includes("lsp")) {
    throw new Error("Only registered LSP plugins may use the LSP adapter.");
  }
  if (request.plugin.format !== "vst3" && request.plugin.format !== "clap") {
    throw new Error("LSP adapter supports only VST3 and CLAP binaries.");
  }
  assertPluginBinary(request.plugin, request.observedBinaryHash);

  const hostRequest: PluginHostRequest = {
    plugin: request.plugin,
    automation: request.automation,
    inputPath: request.inputPath,
    outputPath: request.outputPath,
    sampleRate: request.sampleRate,
    channels: request.channels,
  };
  validatePluginHostRequest(hostRequest);
  return { hostRequest, command: createPluginHostCommand(hostRequest) };
}

export function validateLspPluginResult(
  plan: LspPluginExecutionPlan,
  result: PluginHostResult,
): void {
  if (result.outputPath !== plan.hostRequest.outputPath) {
    throw new Error("LSP plugin output path does not match authorized output.");
  }
  if (result.exitCode !== 0) throw new Error(`LSP plugin host exited with code ${result.exitCode}.`);
}

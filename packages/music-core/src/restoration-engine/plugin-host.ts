import type { AudioCommand } from "./audio-execution-sandbox.js";
import type { PluginAutomationPlan, PluginDescriptor } from "./plugin-automation.js";

export type PluginHostFormat = "vst3" | "clap";

export interface PluginHostRequest {
  plugin: PluginDescriptor;
  automation: PluginAutomationPlan;
  inputPath: string;
  outputPath: string;
  sampleRate: number;
  channels: number;
}

export interface PluginHostResult {
  exitCode: number;
  outputPath: string;
  outputHash?: string;
}

export interface PluginHostAdapter {
  readonly format: PluginHostFormat;
  buildCommand(request: PluginHostRequest): AudioCommand;
  validateResult(request: PluginHostRequest, result: PluginHostResult): void;
}

function sandboxPath(path: string): boolean {
  return path.startsWith("/workspace/") && !path.includes("..") && !/[\r\n]/.test(path);
}

export function validatePluginHostRequest(request: PluginHostRequest): void {
  if (!request.plugin.id || !request.plugin.binaryHash) throw new Error("Plugin identity and binary hash are required.");
  if (request.plugin.format !== "vst3" && request.plugin.format !== "clap") {
    throw new Error("Only VST3 and CLAP are supported by this host boundary.");
  }
  if (request.automation.pluginId !== request.plugin.id) throw new Error("Automation plugin does not match host plugin.");
  if (request.automation.pluginBinaryHash !== request.plugin.binaryHash) throw new Error("Automation binary hash does not match host plugin.");
  if (request.automation.sourceArtifactId.length === 0) throw new Error("Automation source artifact is required.");
  if (!sandboxPath(request.inputPath) || !sandboxPath(request.outputPath)) {
    throw new Error("Plugin host paths must remain inside the sandbox workspace.");
  }
  if (!Number.isInteger(request.sampleRate) || request.sampleRate <= 0) throw new Error("Invalid sample rate.");
  if (!Number.isInteger(request.channels) || request.channels <= 0) throw new Error("Invalid channel count.");
}

/**
 * Host-neutral contract. Concrete VST3/CLAP hosts are workers, not policy
 * engines. The command is supplied to an isolated runtime and never grants
 * authorization or changes provenance.
 */
export function createPluginHostCommand(request: PluginHostRequest): AudioCommand {
  validatePluginHostRequest(request);
  return {
    argv: [
      "music-plugin-host",
      "--format", request.plugin.format,
      "--plugin-id", request.plugin.id,
      "--plugin-binary-hash", request.plugin.binaryHash,
      "--automation-plan", request.automation.id,
      "--input", request.inputPath,
      "--output", request.outputPath,
      "--sample-rate", String(request.sampleRate),
      "--channels", String(request.channels),
    ],
    workingDirectory: "/workspace",
  };
}

export function validatePluginHostResult(request: PluginHostRequest, result: PluginHostResult): void {
  validatePluginHostRequest(request);
  if (result.exitCode !== 0) throw new Error(`Plugin host exited with code ${result.exitCode}.`);
  if (result.outputPath !== request.outputPath) throw new Error("Plugin host output path does not match authorized output.");
}

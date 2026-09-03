import type { PluginAutomationPlan, PluginDescriptor } from "./plugin-automation.js";
import type { PluginHostFormat } from "./plugin-host.js";

export const NATIVE_PLUGIN_IPC_PROTOCOL = "jhadina.music.native-plugin-ipc.v1" as const;
export const NATIVE_PLUGIN_IPC_VERSION = 1 as const;

export type NativePluginIpcState =
  | "CREATED"
  | "DISCOVERED"
  | "LOADED"
  | "CONFIGURED"
  | "AUTOMATION_BOUND"
  | "PROCESSING"
  | "FLUSHING"
  | "COMPLETED"
  | "SHUTDOWN";

export interface NativePluginAudioConfig {
  sampleRate: number;
  channels: number;
  blockSize: number;
}

export interface NativePluginIpcBinding {
  jobId: string;
  executionId: string;
  sourceArtifactId: string;
  sourceHash: string;
  plugin: Pick<PluginDescriptor, "id" | "vendor" | "name" | "version" | "format" | "binaryHash">;
  automationPlanId: string;
  automationPlanHash: string;
  authorizationReceiptId: string;
  audio: NativePluginAudioConfig;
  inputPath: string;
  outputPath: string;
}

export interface NativePluginIpcEnvelope {
  protocol: typeof NATIVE_PLUGIN_IPC_PROTOCOL;
  version: typeof NATIVE_PLUGIN_IPC_VERSION;
  sequence: number;
  binding: NativePluginIpcBinding;
}

export type NativePluginIpcRequest =
  | (NativePluginIpcEnvelope & { type: "discover"; state: "CREATED" })
  | (NativePluginIpcEnvelope & { type: "load"; state: "DISCOVERED"; pluginPath: string })
  | (NativePluginIpcEnvelope & { type: "configure"; state: "LOADED"; audio: NativePluginAudioConfig })
  | (NativePluginIpcEnvelope & { type: "set_automation"; state: "CONFIGURED"; automation: PluginAutomationPlan })
  | (NativePluginIpcEnvelope & { type: "process_block"; state: "AUTOMATION_BOUND"; sampleOffset: number; numSamples: number })
  | (NativePluginIpcEnvelope & { type: "flush"; state: "PROCESSING" })
  | (NativePluginIpcEnvelope & { type: "collect_metadata"; state: "FLUSHING" })
  | (NativePluginIpcEnvelope & { type: "shutdown"; state: "COMPLETED" });

export interface NativePluginRuntimeMetadata {
  plugin: PluginDescriptor;
  hostVersion: string;
  runtimeVersion: string;
  format: PluginHostFormat;
  state: NativePluginIpcState;
}

export interface NativePluginIpcResponse {
  protocol: typeof NATIVE_PLUGIN_IPC_PROTOCOL;
  version: typeof NATIVE_PLUGIN_IPC_VERSION;
  sequence: number;
  jobId: string;
  executionId: string;
  type: "ok" | "error";
  state: NativePluginIpcState;
  outputHash?: string;
  outputPath?: string;
  metadata?: NativePluginRuntimeMetadata;
  error?: { code: string; message: string };
}

const SUPPORTED_FORMATS = new Set<PluginHostFormat>(["vst3", "clap"]);
const ID = /^[A-Za-z0-9._:-]{1,200}$/;
const HASH = /^[A-Fa-f0-9]{32,128}$/;

function assertId(value: string, field: string): void {
  if (!ID.test(value)) throw new Error(`Invalid ${field}.`);
}

function assertHash(value: string, field: string): void {
  if (!HASH.test(value)) throw new Error(`Invalid ${field}.`);
}

function assertWorkspacePath(value: string, field: string): void {
  if (!value.startsWith("/workspace/") || value.includes("..") || /[\r\n]/.test(value)) {
    throw new Error(`${field} must remain inside /workspace/.`);
  }
}

function assertAudioConfig(audio: NativePluginAudioConfig): void {
  if (!Number.isInteger(audio.sampleRate) || audio.sampleRate < 8000 || audio.sampleRate > 384000) throw new Error("Invalid sample rate.");
  if (!Number.isInteger(audio.channels) || audio.channels < 1 || audio.channels > 64) throw new Error("Invalid channel count.");
  if (!Number.isInteger(audio.blockSize) || audio.blockSize < 1 || audio.blockSize > 65536) throw new Error("Invalid block size.");
}

export function validateNativePluginIpcBinding(binding: NativePluginIpcBinding): void {
  assertId(binding.jobId, "job ID");
  assertId(binding.executionId, "execution ID");
  assertId(binding.sourceArtifactId, "source artifact ID");
  assertHash(binding.sourceHash, "source hash");
  assertId(binding.plugin.id, "plugin ID");
  assertId(binding.automationPlanId, "automation plan ID");
  assertHash(binding.plugin.binaryHash, "plugin binary hash");
  assertHash(binding.automationPlanHash, "automation plan hash");
  assertId(binding.authorizationReceiptId, "authorization receipt ID");
  if (!SUPPORTED_FORMATS.has(binding.plugin.format)) throw new Error("Unsupported native plugin format.");
  assertWorkspacePath(binding.inputPath, "Input path");
  assertWorkspacePath(binding.outputPath, "Output path");
  assertAudioConfig(binding.audio);
}

export function validateNativePluginIpcRequest(request: NativePluginIpcRequest): void {
  if (request.protocol !== NATIVE_PLUGIN_IPC_PROTOCOL || request.version !== NATIVE_PLUGIN_IPC_VERSION) throw new Error("Unsupported native plugin IPC protocol version.");
  if (!Number.isInteger(request.sequence) || request.sequence < 0) throw new Error("Invalid IPC sequence.");
  validateNativePluginIpcBinding(request.binding);
  if (request.type === "load") assertWorkspacePath(request.pluginPath, "Plugin path");
  if (request.type === "configure") assertAudioConfig(request.audio);
  if (request.type === "process_block") {
    if (!Number.isInteger(request.sampleOffset) || request.sampleOffset < 0) throw new Error("Invalid process sample offset.");
    if (!Number.isInteger(request.numSamples) || request.numSamples < 1 || request.numSamples > request.binding.audio.blockSize) throw new Error("Invalid process block size.");
  }
  if (request.type === "set_automation") {
    if (request.automation.id !== request.binding.automationPlanId) throw new Error("Automation plan ID does not match IPC binding.");
    if (request.automation.pluginBinaryHash !== request.binding.plugin.binaryHash) throw new Error("Automation plugin hash does not match IPC binding.");
    if (request.automation.sourceArtifactId !== request.binding.sourceArtifactId) throw new Error("Automation source artifact does not match IPC binding.");
    for (const track of request.automation.tracks) for (const point of track.points) {
      if (!Number.isInteger(point.sampleOffset) || point.sampleOffset < 0) throw new Error("Invalid automation sample offset.");
      if (!Number.isFinite(point.normalizedValue) || point.normalizedValue < 0 || point.normalizedValue > 1) throw new Error("Invalid normalized automation value.");
    }
  }
}

const TRANSITIONS: Record<NativePluginIpcState, NativePluginIpcRequest["type"][]> = {
  CREATED: ["discover"],
  DISCOVERED: ["load"],
  LOADED: ["configure"],
  CONFIGURED: ["set_automation"],
  AUTOMATION_BOUND: ["process_block"],
  PROCESSING: ["process_block", "flush"],
  FLUSHING: ["collect_metadata"],
  COMPLETED: ["shutdown"],
  SHUTDOWN: [],
};

export function assertNativePluginIpcTransition(state: NativePluginIpcState, type: NativePluginIpcRequest["type"]): void {
  if (!TRANSITIONS[state].includes(type)) throw new Error(`Invalid native plugin IPC transition: ${state} -> ${type}.`);
}

export function createNativePluginIpcBinding(input: NativePluginIpcBinding): NativePluginIpcBinding {
  validateNativePluginIpcBinding(input);
  return { ...input, plugin: { ...input.plugin }, audio: { ...input.audio } };
}

export function createNativePluginIpcRequest(request: NativePluginIpcRequest): NativePluginIpcRequest {
  validateNativePluginIpcRequest(request);
  assertNativePluginIpcTransition(request.state, request.type);
  return request;
}

export function assertWorkerCannotAuthorizeOrPromote(type: string): void {
  if (type === "authorize" || type === "promote" || type === "commit") throw new Error("Native plugin worker cannot authorize or promote artifacts.");
}

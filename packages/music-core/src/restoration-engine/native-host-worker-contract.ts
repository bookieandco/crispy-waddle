import type { NativePluginIpcBinding, NativePluginIpcResponse } from "./native-plugin-ipc.js";

export const NATIVE_HOST_WORKER_PROTOCOL = "jhadina.music.native-host-worker.v1" as const;
export const NATIVE_HOST_WORKER_VERSION = 1 as const;

export type NativeHostWorkerCommand =
  | { type: "handshake"; binding: NativePluginIpcBinding }
  | { type: "run"; argv: string[] }
  | { type: "shutdown" };

export interface NativeHostWorkerEnvelope {
  protocol: typeof NATIVE_HOST_WORKER_PROTOCOL;
  version: typeof NATIVE_HOST_WORKER_VERSION;
  sequence: number;
  binding: NativePluginIpcBinding;
  command: NativeHostWorkerCommand;
}

export interface NativeHostWorkerTransport {
  send(request: NativeHostWorkerEnvelope): Promise<NativePluginIpcResponse>;
  terminate(): Promise<void>;
}

export function validateNativeHostWorkerEnvelope(request: NativeHostWorkerEnvelope): void {
  if (request.protocol !== NATIVE_HOST_WORKER_PROTOCOL || request.version !== NATIVE_HOST_WORKER_VERSION) {
    throw new Error("Native host worker protocol mismatch.");
  }
  if (!Number.isSafeInteger(request.sequence) || request.sequence < 0) {
    throw new Error("Native host worker sequence is invalid.");
  }
  if (request.binding.jobId.length === 0 || request.binding.executionId.length === 0) {
    throw new Error("Native host worker binding identifiers are required.");
  }
  if (request.command.type === "run") {
    if (request.command.argv.length === 0) throw new Error("Native host worker executable is required.");
    for (const arg of request.command.argv) {
      if (!arg || arg.includes("\u0000") || arg.includes("\r") || arg.includes("\n")) {
        throw new Error("Native host worker command contains an invalid argument.");
      }
    }
  }
}

export function assertNativeHostWorkerResponse(
  request: NativeHostWorkerEnvelope,
  response: NativePluginIpcResponse,
): void {
  if (response.protocol !== request.binding.protocol || response.version !== request.binding.version) {
    throw new Error("Native host worker IPC protocol mismatch.");
  }
  if (response.sequence !== request.sequence || response.jobId !== request.binding.jobId || response.executionId !== request.binding.executionId) {
    throw new Error("Native host worker response binding mismatch.");
  }
  if (response.type === "error") throw new Error(response.error?.message ?? "Native host worker failed.");
}

import { describe, expect, it } from "vitest";
import type { AudioExecutionSandbox, AudioSandboxHandle, AudioSandboxJob, SandboxArtifact } from "./audio-execution-sandbox.js";
import type { NativePluginIpcBinding, NativePluginIpcRequest, NativePluginIpcResponse } from "./native-plugin-ipc.js";
import type { NativePluginProcessFactory } from "./native-plugin-process-adapter.js";
import { createNativeWorkerSupervisor } from "./native-worker-supervisor.js";

const binding: NativePluginIpcBinding = { jobId: "job:1", executionId: "exec:1", sourceArtifactId: "src:1", sourceHash: "0123456789abcdef0123456789abcdef", plugin: { id: "plugin:1", vendor: "Vendor", name: "Plugin", version: "1.0.0", format: "vst3", binaryHash: "abcdef0123456789abcdef0123456789" }, automationPlanId: "auto:1", automationPlanHash: "abcdef0123456789abcdef0123456789", authorizationReceiptId: "receipt:1", audio: { sampleRate: 48000, channels: 2, blockSize: 512 }, inputPath: "/workspace/in.wav", outputPath: "/workspace/out.wav" };
const job: AudioSandboxJob = { id: "job:1", sourceArtifactId: "src:1", sourceArtifactHash: binding.sourceHash, pluginId: "plugin:1", pluginBinaryHash: binding.plugin.binaryHash, automationPlanId: "auto:1", workerImage: "worker", workerImageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", sampleRate: 48000, channels: 2, resourceLimits: { cpuMillis: 1000, memoryMb: 512, timeoutSeconds: 10 }, network: { mode: "deny" }, inputPath: binding.inputPath, outputPath: binding.outputPath };

function makeProcess(): NativePluginProcessFactory {
  return { spawn: async () => ({ send: async (r: NativePluginIpcRequest): Promise<NativePluginIpcResponse> => ({ protocol: r.protocol, version: r.version, sequence: r.sequence, jobId: r.binding.jobId, executionId: r.binding.executionId, type: "ok", state: r.state }), terminate: async () => undefined }) };
}
function makeSandbox(events: string[]): AudioExecutionSandbox {
  const artifact: SandboxArtifact = { path: binding.outputPath, contentHash: "abcdef0123456789abcdef0123456789" };
  return { createJob: async () => { events.push("create"); return { id: "sb:1" } as AudioSandboxHandle; }, execute: async () => ({ exitCode: 0, outputPath: binding.outputPath }), collectArtifact: async () => { events.push("collect"); return artifact; }, destroy: async () => { events.push("destroy"); } };
}

describe("native worker supervisor", () => {
  it("requires handshake before RUNNING and cleans up normally", async () => {
    const events: string[] = [];
    const supervisor = createNativeWorkerSupervisor({ binding, sandboxJob: job, sandbox: makeSandbox(events), processFactory: makeProcess(), heartbeat: { check: async () => { events.push("heartbeat"); } }, quarantine: { quarantine: async () => { events.push("quarantine"); } }, policy: { heartbeatIntervalMs: 20, heartbeatTimeoutMs: 100 } });
    await expect(supervisor.run(async () => undefined)).rejects.toThrow(/READY/);
    await supervisor.start("/workspace/plugin.vst3");
    expect(supervisor.state).toBe("READY");
    await supervisor.run(async () => "ok");
    expect(supervisor.state).toBe("RUNNING");
    await supervisor.terminate();
    expect(supervisor.state).toBe("TERMINATED");
    expect(events).toEqual(expect.arrayContaining(["create", "heartbeat", "destroy"]));
  });

  it("quarantines output after a worker operation failure", async () => {
    const events: string[] = [];
    const supervisor = createNativeWorkerSupervisor({ binding, sandboxJob: job, sandbox: makeSandbox(events), processFactory: makeProcess(), heartbeat: { check: async () => undefined }, quarantine: { quarantine: async () => { events.push("quarantine"); } }, policy: { heartbeatIntervalMs: 20, heartbeatTimeoutMs: 100 } });
    await supervisor.start("/workspace/plugin.vst3");
    await expect(supervisor.run(async () => { throw new Error("worker crash"); })).rejects.toThrow("worker crash");
    expect(supervisor.state).toBe("CLEANED");
    expect(events).toEqual(expect.arrayContaining(["collect", "quarantine", "destroy"]));
  });

  it("fails closed on heartbeat failure and quarantines the artifact", async () => {
    const events: string[] = [];
    const supervisor = createNativeWorkerSupervisor({ binding, sandboxJob: job, sandbox: makeSandbox(events), processFactory: makeProcess(), heartbeat: { check: async () => { throw new Error("worker heartbeat lost"); } }, quarantine: { quarantine: async () => { events.push("quarantine"); } }, policy: { heartbeatIntervalMs: 20, heartbeatTimeoutMs: 40 } });
    await expect(supervisor.start("/workspace/plugin.vst3")).rejects.toThrow("worker heartbeat lost");
    expect(supervisor.state).toBe("CLEANED");
    expect(events).toEqual(expect.arrayContaining(["collect", "quarantine", "destroy"]));
  });
});

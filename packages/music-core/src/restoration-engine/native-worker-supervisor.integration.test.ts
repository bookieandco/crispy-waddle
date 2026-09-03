import assert from "node:assert/strict";
import test from "node:test";
import { createNativePluginWorker, type NativePluginBackend } from "./native-plugin-worker.js";
import { createNativePluginIpcBinding, type NativePluginRuntimeMetadata } from "./native-plugin-ipc.js";
import { createNativeWorkerSupervisor } from "./native-worker-supervisor.js";
import type { AudioSandboxJob } from "./audio-execution-sandbox.js";
import type { PluginAutomationPlan, PluginDescriptor } from "./plugin-automation.js";

const plugin: PluginDescriptor = { id: "mock-plugin", vendor: "Jhadina", name: "Mock", version: "1.0.0", format: "vst3", binaryHash: "abcdef0123456789abcdef0123456789", parameters: [{ id: "gain", name: "Gain", stepCount: 100, defaultNormalizedValue: 0.5, automatable: true }] };
const automation: PluginAutomationPlan = { id: "automation-1", pluginId: plugin.id, pluginBinaryHash: plugin.binaryHash, sourceArtifactId: "source-1", tracks: [{ parameterId: "gain", points: [{ sampleOffset: 0, normalizedValue: 0.5 }] }], allowedParameterIds: ["gain"], protectedRegions: [], maxParameterDelta: { gain: 0.5 }, evidenceIds: ["evidence-1"] };

function makeBackend(log: string[], failProcessing = false): NativePluginBackend {
  return {
    async discover(path) { log.push(`discover:${path}`); return plugin; },
    async load(path) { log.push(`load:${path}`); },
    async configure(audio) { log.push(`configure:${audio.sampleRate}`); },
    async setAutomation() { log.push("automation"); },
    async processBlock(offset, samples) { log.push(`process:${offset}:${samples}`); if (failProcessing) throw new Error("mock native crash"); },
    async flush() { log.push("flush"); },
    async collectMetadata(): Promise<NativePluginRuntimeMetadata> { log.push("metadata"); return { plugin, hostVersion: "test-host", runtimeVersion: "test-runtime", format: "vst3", state: "COMPLETED" }; },
    async shutdown() { log.push("shutdown"); },
  };
}

function makeFixture(failProcessing = false) {
  const log: string[] = [];
  const binding = createNativePluginIpcBinding({ jobId: "job-1", executionId: "exec-1", sourceArtifactId: "source-1", sourceHash: "0123456789abcdef0123456789abcdef", plugin, automationPlanId: automation.id, automationPlanHash: "abcdef0123456789abcdef0123456789", authorizationReceiptId: "receipt-1", audio: { sampleRate: 48000, channels: 2, blockSize: 128 }, inputPath: "/workspace/input.wav", outputPath: "/workspace/output.wav" });
  const job: AudioSandboxJob = { id: "job-1", sourceArtifactId: "source-1", sourceArtifactHash: binding.sourceHash, pluginId: plugin.id, pluginBinaryHash: plugin.binaryHash, automationPlanId: automation.id, workerImage: "jhadina/native-mock", workerImageDigest: "sha256:" + "a".repeat(64), sampleRate: 48000, channels: 2, resourceLimits: { cpuMillis: 1000, memoryMb: 256, timeoutSeconds: 10 }, network: { mode: "deny" }, inputPath: binding.inputPath, outputPath: binding.outputPath };
  const worker = createNativePluginWorker(binding, makeBackend(log, failProcessing));
  let terminated = false;
  let destroyed = 0;
  const process = { send: (request: Parameters<typeof worker.handle>[0]) => worker.handle(request), terminate: async () => { terminated = true; } };
  const quarantineReasons: string[] = [];
  const supervisor = createNativeWorkerSupervisor({ binding, sandboxJob: job, sandbox: { createJob: async () => ({ id: "sandbox-1" }), execute: async () => ({ exitCode: 0, outputPath: job.outputPath }), collectArtifact: async () => ({ path: job.outputPath, contentHash: "abcdef0123456789abcdef0123456789" }), destroy: async () => { destroyed += 1; } }, processFactory: { spawn: async () => process }, heartbeat: { check: async () => undefined }, quarantine: { quarantine: async ({ reason }) => { quarantineReasons.push(reason); } }, policy: { heartbeatIntervalMs: 10, heartbeatTimeoutMs: 50 } });
  return { supervisor, binding, automation, log, processState: () => ({ terminated, destroyed, quarantineReasons }) };
}

test("MR-037 supervisor executes complete native worker lifecycle and closes cleanly", async () => {
  const f = makeFixture();
  await f.supervisor.start("/workspace/plugins/mock-plugin.vst3");
  assert.equal(f.supervisor.state, "READY");
  await f.supervisor.run(async (host) => {
    await host.load("/workspace/plugins/mock-plugin.vst3");
    await host.configure();
    await host.bindAutomation({ protocol: "jhadina.music.native-plugin-ipc.v1", version: 1, sequence: 3, binding: f.binding, type: "set_automation", state: "CONFIGURED", automation: f.automation });
    await host.processBlock(0, 64);
    await host.flush();
    await host.collectMetadata();
  });
  assert.equal(f.supervisor.state, "TERMINATED");
  assert.deepEqual(f.log, ["discover:/workspace/plugins/mock-plugin.vst3", "load:/workspace/plugins/mock-plugin.vst3", "configure:48000", "automation", "process:0:64", "flush", "metadata"]);
  assert.equal(f.processState().terminated, true);
  assert.equal(f.processState().destroyed, 1);
  assert.deepEqual(f.processState().quarantineReasons, []);
});

test("MR-037 startup path violation is quarantined before readiness", async () => {
  const f = makeFixture();
  await assert.rejects(() => f.supervisor.start("/tmp/escape.vst3"));
  assert.equal(f.supervisor.state, "CLEANED");
  assert.equal(f.processState().destroyed, 1);
  assert.equal(f.processState().quarantineReasons.length, 1);
});

test("MR-037 worker failure during processing quarantines the sandbox", async () => {
  const f = makeFixture(true);
  const adapter = await f.supervisor.start("/workspace/plugins/mock-plugin.vst3");
  await assert.rejects(() => f.supervisor.run(async (host) => {
    await host.load("/workspace/plugins/mock-plugin.vst3");
    await host.configure();
    await host.bindAutomation({ protocol: "jhadina.music.native-plugin-ipc.v1", version: 1, sequence: 3, binding: f.binding, type: "set_automation", state: "CONFIGURED", automation: f.automation });
    await host.processBlock(0, 64);
  }), /mock native crash/);
  assert.equal(f.supervisor.state, "CLEANED");
  assert.equal(f.processState().destroyed, 1);
  assert.equal(f.processState().quarantineReasons.length, 1);
  assert.equal(adapter !== undefined, true);
});

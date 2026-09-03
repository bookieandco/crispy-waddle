import type { AudioExecutionSandbox, AudioSandboxJob } from "./audio-execution-sandbox.js";
import type { NativePluginIpcBinding } from "./native-plugin-ipc.js";
import { createNativePluginProcessAdapter, type NativePluginProcess, type NativePluginProcessAdapter, type NativePluginProcessFactory } from "./native-plugin-process-adapter.js";

export type NativeWorkerSupervisorState = "CREATED" | "SPAWNING" | "HANDSHAKING" | "READY" | "RUNNING" | "STOPPING" | "TERMINATED" | "QUARANTINED" | "CLEANED";

export interface NativeWorkerSupervisorPolicy { heartbeatIntervalMs: number; heartbeatTimeoutMs: number; }
export interface NativeWorkerHeartbeat { check(): Promise<void>; }
export interface NativeWorkerQuarantine { quarantine(input: { jobId: string; executionId: string; outputPath: string; artifact?: { path: string; contentHash: string }; reason: string }): Promise<void>; }
export interface NativeWorkerSupervisor {
  readonly state: NativeWorkerSupervisorState;
  start(pluginPath: string): Promise<NativePluginProcessAdapter>;
  run<T>(operation: (adapter: NativePluginProcessAdapter) => Promise<T>): Promise<T>;
  terminate(reason?: string): Promise<void>;
}
export interface NativeWorkerSupervisorDependencies {
  binding: NativePluginIpcBinding;
  sandbox: AudioExecutionSandbox;
  sandboxJob: AudioSandboxJob;
  processFactory: NativePluginProcessFactory;
  heartbeat: NativeWorkerHeartbeat;
  quarantine: NativeWorkerQuarantine;
  policy?: Partial<NativeWorkerSupervisorPolicy>;
}

const DEFAULT_POLICY: NativeWorkerSupervisorPolicy = { heartbeatIntervalMs: 1000, heartbeatTimeoutMs: 5000 };

function assertPolicy(policy: NativeWorkerSupervisorPolicy): void {
  if (!Number.isInteger(policy.heartbeatIntervalMs) || policy.heartbeatIntervalMs < 10) throw new Error("Invalid native worker heartbeat interval.");
  if (!Number.isInteger(policy.heartbeatTimeoutMs) || policy.heartbeatTimeoutMs < policy.heartbeatIntervalMs) throw new Error("Invalid native worker heartbeat timeout.");
}

function assertBindingMatchesJob(binding: NativePluginIpcBinding, job: AudioSandboxJob): void {
  if (binding.jobId !== job.id) throw new Error("Native worker job binding mismatch.");
  if (binding.sourceArtifactId !== job.sourceArtifactId || binding.sourceHash !== job.sourceArtifactHash) throw new Error("Native worker source binding mismatch.");
  if (binding.plugin.id !== job.pluginId || binding.plugin.binaryHash !== job.pluginBinaryHash) throw new Error("Native worker plugin binding mismatch.");
  if (binding.automationPlanId !== job.automationPlanId) throw new Error("Native worker automation binding mismatch.");
  if (binding.inputPath !== job.inputPath || binding.outputPath !== job.outputPath) throw new Error("Native worker workspace binding mismatch.");
}

export function createNativeWorkerSupervisor(d: NativeWorkerSupervisorDependencies): NativeWorkerSupervisor {
  const policy = { ...DEFAULT_POLICY, ...d.policy };
  assertPolicy(policy);
  assertBindingMatchesJob(d.binding, d.sandboxJob);
  let state: NativeWorkerSupervisorState = "CREATED";
  let handle: { id: string } | undefined;
  let process: NativePluginProcess | undefined;
  let adapter: NativePluginProcessAdapter | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastHeartbeat = 0;
  let failure: string | undefined;

  const stopTimer = () => { if (timer !== undefined) clearInterval(timer); timer = undefined; };
  const cleanup = async (reason: string, quarantine: boolean) => {
    stopTimer();
    state = "STOPPING";
    try { await process?.terminate(); } catch { /* quarantine still proceeds */ }
    if (quarantine) {
      let artifact: { path: string; contentHash: string } | undefined;
      if (handle) { try { artifact = await d.sandbox.collectArtifact(handle, d.binding.outputPath); } catch { /* unavailable artifact */ } }
      await d.quarantine.quarantine({ jobId: d.binding.jobId, executionId: d.binding.executionId, outputPath: d.binding.outputPath, artifact, reason });
      state = "QUARANTINED";
    }
    if (handle) await d.sandbox.destroy(handle);
    handle = undefined; process = undefined; adapter = undefined;
    state = quarantine ? "CLEANED" : "TERMINATED";
  };
  const heartbeat = async () => {
    if (failure) throw new Error(failure);
    if (lastHeartbeat && Date.now() - lastHeartbeat > policy.heartbeatTimeoutMs) throw new Error("Native worker heartbeat timeout.");
    await d.heartbeat.check();
    lastHeartbeat = Date.now();
  };
  const startTimer = () => {
    lastHeartbeat = Date.now();
    timer = setInterval(() => { void d.heartbeat.check().then(() => { lastHeartbeat = Date.now(); }).catch(e => { failure = e instanceof Error ? e.message : "Native worker heartbeat failed."; }); }, policy.heartbeatIntervalMs);
  };

  return {
    get state() { return state; },
    async start(pluginPath) {
      if (state !== "CREATED") throw new Error(`Native worker cannot start from ${state}.`);
      state = "SPAWNING";
      try {
        handle = await d.sandbox.createJob(d.sandboxJob);
        process = await d.processFactory.spawn(d.binding);
        adapter = createNativePluginProcessAdapter(d.binding, { spawn: async () => process! });
        state = "HANDSHAKING";
        await adapter.discover(pluginPath);
        await heartbeat();
        state = "READY";
        return adapter;
      } catch (e) {
        await cleanup(e instanceof Error ? e.message : "Native worker startup failed.", true);
        throw e;
      }
    },
    async run(operation) {
      if (state !== "READY" || !adapter) throw new Error(`Native worker cannot run from ${state}.`);
      state = "RUNNING"; startTimer();
      let timeoutTimer: ReturnType<typeof setInterval> | undefined;
      try {
        const watchdog = new Promise<never>((_, reject) => {
          timeoutTimer = setInterval(() => { if (failure || Date.now() - lastHeartbeat > policy.heartbeatTimeoutMs) reject(new Error(failure ?? "Native worker heartbeat timeout.")); }, policy.heartbeatIntervalMs);
        });
        const result = await Promise.race([operation(adapter), watchdog]);
        await heartbeat();
        return result;
      } catch (e) {
        await cleanup(e instanceof Error ? e.message : "Native worker execution failed.", true);
        throw e;
      } finally {
        if (timeoutTimer !== undefined) clearInterval(timeoutTimer);
        stopTimer();
      }
    },
    async terminate(reason = "Native worker terminated by supervisor.") {
      if (state === "TERMINATED" || state === "CLEANED") return;
      if (!process && !handle) { state = "TERMINATED"; return; }
      failure = reason;
      await cleanup(reason, false);
    },
  };
}

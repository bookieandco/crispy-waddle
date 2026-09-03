import { describe, expect, it, vi } from "vitest";
import { createAudioExecutionBroker, type AudioExecutionSandbox, type AudioSandboxJob } from "./audio-execution-sandbox.js";

const job = (overrides: Partial<AudioSandboxJob> = {}): AudioSandboxJob => ({
  id: "sandbox-job-1",
  sourceArtifactId: "source-1",
  sourceArtifactHash: "source-hash",
  pluginId: "plugin-1",
  pluginBinaryHash: "plugin-hash",
  automationPlanId: "automation-1",
  workerImage: "music-worker:lsp",
  workerImageDigest: "sha256:worker-hash",
  sampleRate: 48000,
  channels: 2,
  resourceLimits: { cpuMillis: 1000, memoryMb: 1024, timeoutSeconds: 60 },
  network: { mode: "deny" },
  inputPath: "/input/source.wav",
  outputPath: "/output/render.wav",
  ...overrides,
});

const sandbox = (): AudioExecutionSandbox => ({
  createJob: vi.fn(async () => ({ id: "handle-1" })),
  execute: vi.fn(async () => ({ exitCode: 0, outputPath: "/output/render.wav", outputHash: "output-hash" })),
  collectArtifact: vi.fn(async () => ({ path: "/output/render.wav", contentHash: "output-hash" })),
  destroy: vi.fn(async () => undefined),
});

describe("audio execution sandbox boundary", () => {
  it("rejects unauthorized execution before creating a sandbox", async () => {
    const provider = sandbox();
    const broker = createAudioExecutionBroker(provider);

    await expect(broker.runAuthorizedJob({ job: job(), authorized: false, command: { argv: ["render"] } }))
      .rejects.toThrow("denied by authorization boundary");
    expect(provider.createJob).not.toHaveBeenCalled();
  });

  it("requires a pinned worker image digest", async () => {
    const provider = sandbox();
    const broker = createAudioExecutionBroker(provider);

    await expect(broker.runAuthorizedJob({
      job: job({ workerImageDigest: "latest" }),
      authorized: true,
      command: { argv: ["render"] },
    })).rejects.toThrow("pinned by digest");
    expect(provider.createJob).not.toHaveBeenCalled();
  });

  it("requires explicit hosts for allowlisted networking", async () => {
    const provider = sandbox();
    const broker = createAudioExecutionBroker(provider);

    await expect(broker.runAuthorizedJob({
      job: job({ network: { mode: "allowlist" } }),
      authorized: true,
      command: { argv: ["render"] },
    })).rejects.toThrow("at least one allowed host");
  });

  it("rejects contradictory network-deny configuration", async () => {
    const provider = sandbox();
    const broker = createAudioExecutionBroker(provider);

    await expect(broker.runAuthorizedJob({
      job: job({ network: { mode: "deny", allowedHosts: ["example.com"] } }),
      authorized: true,
      command: { argv: ["render"] },
    })).rejects.toThrow("cannot declare allowed hosts");
  });

  it("always destroys the sandbox after execution", async () => {
    const provider = sandbox();
    const broker = createAudioExecutionBroker(provider);

    await broker.runAuthorizedJob({ job: job(), authorized: true, command: { argv: ["render"] } });
    expect(provider.createJob).toHaveBeenCalledTimes(1);
    expect(provider.execute).toHaveBeenCalledTimes(1);
    expect(provider.destroy).toHaveBeenCalledWith({ id: "handle-1" });
  });

  it("cleans up when the worker fails", async () => {
    const provider = sandbox();
    provider.execute = vi.fn(async () => { throw new Error("worker failed"); });
    const broker = createAudioExecutionBroker(provider);

    await expect(broker.runAuthorizedJob({ job: job(), authorized: true, command: { argv: ["render"] } }))
      .rejects.toThrow("worker failed");
    expect(provider.destroy).toHaveBeenCalledWith({ id: "handle-1" });
  });
});

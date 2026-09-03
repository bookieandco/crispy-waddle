import { describe, expect, it, vi } from "vitest";
import type { AudioSandboxJob } from "./audio-execution-sandbox.js";
import { runMusicWorker } from "./audio-worker-runtime.js";

const job: AudioSandboxJob = {
  id: "job-1",
  sourceArtifactId: "source-1",
  sourceArtifactHash: "sha256:source",
  pluginId: "plugin-1",
  pluginBinaryHash: "sha256:plugin",
  automationPlanId: "automation-1",
  workerImage: "registry/music-worker",
  workerImageDigest: "sha256:image",
  sampleRate: 48000,
  channels: 2,
  resourceLimits: { cpuMillis: 1000, memoryMb: 1024, timeoutSeconds: 30 },
  network: { mode: "deny" },
  inputPath: "/workspace/input.wav",
  outputPath: "/workspace/output.wav",
};

describe("runMusicWorker", () => {
  it("binds the worker request to the authorized job", async () => {
    const runtime = { run: vi.fn(async (request) => ({
      protocolVersion: request.manifest.protocolVersion,
      jobId: request.manifest.jobId,
      sourceArtifactId: request.manifest.sourceArtifactId,
      exitCode: 0,
      outputPath: request.manifest.outputPath,
      outputHash: "sha256:output",
    })) };

    const result = await runMusicWorker(job, { argv: ["music-worker", "--render"] }, runtime);

    expect(result.outputPath).toBe(job.outputPath);
    expect(runtime.run).toHaveBeenCalledWith(expect.objectContaining({
      manifest: expect.objectContaining({
        jobId: job.id,
        sourceArtifactId: job.sourceArtifactId,
        sourceArtifactHash: job.sourceArtifactHash,
        pluginBinaryHash: job.pluginBinaryHash,
        automationPlanId: job.automationPlanId,
      }),
    }));
  });

  it("rejects a worker result for another job", async () => {
    const runtime = { run: vi.fn(async () => ({
      protocolVersion: "1.0",
      jobId: "other-job",
      sourceArtifactId: job.sourceArtifactId,
      exitCode: 0,
      outputPath: job.outputPath,
    })) };

    await expect(runMusicWorker(job, { argv: ["music-worker"] }, runtime))
      .rejects.toThrow("job does not match");
  });

  it("rejects a worker result with a different output path", async () => {
    const runtime = { run: vi.fn(async () => ({
      protocolVersion: "1.0",
      jobId: job.id,
      sourceArtifactId: job.sourceArtifactId,
      exitCode: 0,
      outputPath: "/workspace/other.wav",
    })) };

    await expect(runMusicWorker(job, { argv: ["music-worker"] }, runtime))
      .rejects.toThrow("output path does not match");
  });

  it("rejects a failed worker", async () => {
    const runtime = { run: vi.fn(async () => ({
      protocolVersion: "1.0",
      jobId: job.id,
      sourceArtifactId: job.sourceArtifactId,
      exitCode: 2,
      outputPath: job.outputPath,
    })) };

    await expect(runMusicWorker(job, { argv: ["music-worker"] }, runtime))
      .rejects.toThrow("exited with code 2");
  });
});

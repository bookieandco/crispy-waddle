import type { AudioSandboxJob } from "./audio-execution-sandbox.js";
import { createMusicWorkerManifest, validateMusicWorkerResult } from "./music-worker.js";

const job: AudioSandboxJob = {
  id: "job-1",
  sourceArtifactId: "source-1",
  sourceArtifactHash: "sha256:source",
  pluginId: "plugin-1",
  pluginBinaryHash: "sha256:plugin",
  automationPlanId: "automation-1",
  workerImage: "music-worker",
  workerImageDigest: "sha256:image",
  sampleRate: 48000,
  channels: 2,
  resourceLimits: { cpuMillis: 2000, memoryMb: 1024, timeoutSeconds: 30 },
  network: { mode: "deny" },
  inputPath: "/input/source.wav",
  outputPath: "/output/render.wav",
};

describe("music worker protocol", () => {
  it("creates a manifest bound to the authorized job", () => {
    expect(createMusicWorkerManifest(job)).toMatchObject({
      protocolVersion: "1.0",
      jobId: "job-1",
      sourceArtifactId: "source-1",
      sourceArtifactHash: "sha256:source",
      pluginBinaryHash: "sha256:plugin",
      automationPlanId: "automation-1",
    });
  });

  it("rejects result identity mismatches", () => {
    expect(() => validateMusicWorkerResult(job, {
      protocolVersion: "1.0",
      jobId: "job-2",
      sourceArtifactId: "source-1",
      outputPath: "/output/render.wav",
      exitCode: 0,
      outputHash: "sha256:output",
    })).toThrow("job does not match");
  });

  it("rejects non-zero worker exits", () => {
    expect(() => validateMusicWorkerResult(job, {
      protocolVersion: "1.0",
      jobId: "job-1",
      sourceArtifactId: "source-1",
      outputPath: "/output/render.wav",
      exitCode: 1,
    })).toThrow("exited with code 1");
  });
});

import { describe, expect, it } from "vitest";
import { createFfmpegDspCommand } from "./dsp-worker.js";
import type { AudioSandboxJob } from "./audio-execution-sandbox.js";

const job: AudioSandboxJob = {
  id: "job-1",
  sourceArtifactId: "artifact-1",
  sourceArtifactHash: "hash-1",
  workerImage: "music-worker",
  workerImageDigest: "sha256:worker",
  sampleRate: 48000,
  channels: 2,
  resourceLimits: { cpuMillis: 1000, memoryMb: 512, timeoutSeconds: 30 },
  network: { mode: "deny" },
  inputPath: "/work/input.wav",
  outputPath: "/work/output.wav",
};

describe("createFfmpegDspCommand", () => {
  it("builds an argv-only FFmpeg command", () => {
    const command = createFfmpegDspCommand(job, {
      operation: "copy",
      inputPath: job.inputPath,
      outputPath: job.outputPath,
      sampleRate: 48000,
      channels: 2,
    });
    expect(command.argv[0]).toBe("ffmpeg");
    expect(command.argv).toContain("-nostdin");
    expect(command.argv).toContain(job.inputPath);
    expect(command.argv).toContain(job.outputPath);
  });

  it("requires the authorized paths", () => {
    expect(() => createFfmpegDspCommand(job, {
      operation: "copy", inputPath: "/tmp/input.wav", outputPath: job.outputPath, sampleRate: 48000, channels: 2,
    })).toThrow("DSP input path");
  });

  it("rejects traversal paths", () => {
    expect(() => createFfmpegDspCommand({ ...job, inputPath: "/work/input.wav" }, {
      operation: "copy", inputPath: "/work/../secret.wav", outputPath: job.outputPath, sampleRate: 48000, channels: 2,
    })).toThrow("absolute sandbox paths");
  });

  it("requires a filter graph for filter operations", () => {
    expect(() => createFfmpegDspCommand(job, {
      operation: "filter", inputPath: job.inputPath, outputPath: job.outputPath, sampleRate: 48000, channels: 2,
    })).toThrow("filter graph");
  });

  it("rejects multiline filter graphs", () => {
    expect(() => createFfmpegDspCommand(job, {
      operation: "filter", inputPath: job.inputPath, outputPath: job.outputPath, sampleRate: 48000, channels: 2, filterGraph: "anull\n-invalid",
    })).toThrow("newlines");
  });
});

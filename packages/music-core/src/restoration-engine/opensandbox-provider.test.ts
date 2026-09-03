import { describe, expect, it, vi } from "vitest";
import { OpenSandboxAudioExecutionProvider, type OpenSandboxClient } from "./opensandbox-provider.js";

const client = (): OpenSandboxClient => ({
  createSandbox: vi.fn(async () => ({ sandboxId: "sandbox-1" })),
  executeCommand: vi.fn(async () => ({ exitCode: 0, outputPath: "/out/render.wav", outputHash: "hash-out" })),
  readArtifact: vi.fn(async () => ({ contentHash: "hash-out" })),
  deleteSandbox: vi.fn(async () => undefined),
});

describe("OpenSandbox audio provider", () => {
  it("maps the canonical sandbox job into an isolated provider request", async () => {
    const c = client();
    const provider = new OpenSandboxAudioExecutionProvider(c);
    const handle = await provider.createJob({
      id: "job-1",
      sourceArtifactId: "source-1",
      sourceArtifactHash: "source-hash",
      pluginId: "plugin-1",
      pluginBinaryHash: "plugin-hash",
      automationPlanId: "automation-1",
      workerImage: "music-worker:lsp",
      workerImageDigest: "sha256:worker",
      sampleRate: 48000,
      channels: 2,
      resourceLimits: { cpuMillis: 2000, memoryMb: 2048, timeoutSeconds: 60 },
      network: { mode: "deny" },
      inputPath: "/in/source.wav",
      outputPath: "/out/render.wav",
    });

    expect(handle.id).toBe("sandbox-1");
    expect(c.createSandbox).toHaveBeenCalledWith(expect.objectContaining({
      image: "music-worker:lsp",
      imageDigest: "sha256:worker",
      networkMode: "deny",
    }));
  });

  it("rejects an unpinned worker image", async () => {
    const provider = new OpenSandboxAudioExecutionProvider(client());
    await expect(provider.createJob({
      id: "job-1",
      sourceArtifactId: "source-1",
      sourceArtifactHash: "source-hash",
      workerImage: "music-worker:lsp",
      workerImageDigest: "latest",
      sampleRate: 48000,
      channels: 2,
      resourceLimits: { cpuMillis: 1000, memoryMb: 512, timeoutSeconds: 30 },
      network: { mode: "deny" },
      inputPath: "/in/source.wav",
      outputPath: "/out/render.wav",
    })).rejects.toThrow("pinned by digest");
  });

  it("maps execution, artifact collection, and destruction", async () => {
    const c = client();
    const provider = new OpenSandboxAudioExecutionProvider(c);
    const handle = { id: "sandbox-1" };
    const result = await provider.execute(handle, { argv: ["render", "/in/source.wav"] });
    const artifact = await provider.collectArtifact(handle, "/out/render.wav");
    await provider.destroy(handle);

    expect(result.outputHash).toBe("hash-out");
    expect(artifact.contentHash).toBe("hash-out");
    expect(c.deleteSandbox).toHaveBeenCalledWith({ sandboxId: "sandbox-1" });
  });
});

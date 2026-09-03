import type {
  AudioCommand,
  AudioExecutionResult,
  AudioExecutionSandbox,
  AudioSandboxHandle,
  AudioSandboxJob,
  SandboxArtifact,
} from "./audio-execution-sandbox.js";

export interface OpenSandboxClient {
  createSandbox(input: {
    image: string;
    imageDigest: string;
    cpuMillis: number;
    memoryMb: number;
    timeoutSeconds: number;
    networkMode: "deny" | "allowlist";
    allowedHosts?: string[];
  }): Promise<{ sandboxId: string }>;
  executeCommand(input: {
    sandboxId: string;
    argv: string[];
    workingDirectory?: string;
  }): Promise<{ exitCode: number; outputPath: string; outputHash?: string }>;
  readArtifact(input: { sandboxId: string; path: string }): Promise<{ contentHash: string }>;
  deleteSandbox(input: { sandboxId: string }): Promise<void>;
}

/**
 * OpenSandbox adapter. The music core depends only on the AudioExecutionSandbox
 * contract; all OpenSandbox protocol/runtime details remain behind this adapter.
 */
export class OpenSandboxAudioExecutionProvider implements AudioExecutionSandbox {
  constructor(private readonly client: OpenSandboxClient) {}

  async createJob(spec: AudioSandboxJob): Promise<AudioSandboxHandle> {
    if (!spec.workerImageDigest.startsWith("sha256:")) {
      throw new Error("OpenSandbox worker image must be pinned by digest.");
    }
    if (spec.network.mode === "allowlist" && !spec.network.allowedHosts?.length) {
      throw new Error("OpenSandbox allowlist requires explicit allowed hosts.");
    }

    const sandbox = await this.client.createSandbox({
      image: spec.workerImage,
      imageDigest: spec.workerImageDigest,
      cpuMillis: spec.resourceLimits.cpuMillis,
      memoryMb: spec.resourceLimits.memoryMb,
      timeoutSeconds: spec.resourceLimits.timeoutSeconds,
      networkMode: spec.network.mode,
      allowedHosts: spec.network.allowedHosts,
    });
    return { id: sandbox.sandboxId };
  }

  async execute(handle: AudioSandboxHandle, command: AudioCommand): Promise<AudioExecutionResult> {
    const result = await this.client.executeCommand({
      sandboxId: handle.id,
      argv: [...command.argv],
      workingDirectory: command.workingDirectory,
    });
    return { ...result };
  }

  async collectArtifact(handle: AudioSandboxHandle, path: string): Promise<SandboxArtifact> {
    const artifact = await this.client.readArtifact({ sandboxId: handle.id, path });
    return { path, contentHash: artifact.contentHash };
  }

  async destroy(handle: AudioSandboxHandle): Promise<void> {
    await this.client.deleteSandbox({ sandboxId: handle.id });
  }
}

export type SandboxNetworkMode = "deny" | "allowlist";

export interface AudioSandboxResourceLimits {
  cpuMillis: number;
  memoryMb: number;
  timeoutSeconds: number;
}

export interface AudioSandboxJob {
  id: string;
  sourceArtifactId: string;
  sourceArtifactHash: string;
  pluginId?: string;
  pluginBinaryHash?: string;
  automationPlanId?: string;
  workerImage: string;
  workerImageDigest: string;
  sampleRate: number;
  channels: number;
  resourceLimits: AudioSandboxResourceLimits;
  network: {
    mode: SandboxNetworkMode;
    allowedHosts?: string[];
  };
  inputPath: string;
  outputPath: string;
}

export interface AudioSandboxHandle {
  id: string;
}

export interface AudioCommand {
  argv: string[];
  workingDirectory?: string;
}

export interface AudioExecutionResult {
  exitCode: number;
  outputPath: string;
  outputHash?: string;
}

export interface SandboxArtifact {
  path: string;
  contentHash: string;
}

export interface AudioExecutionSandbox {
  createJob(spec: AudioSandboxJob): Promise<AudioSandboxHandle>;
  execute(handle: AudioSandboxHandle, command: AudioCommand): Promise<AudioExecutionResult>;
  collectArtifact(handle: AudioSandboxHandle, path: string): Promise<SandboxArtifact>;
  destroy(handle: AudioSandboxHandle): Promise<void>;
}

export interface AudioExecutionBroker {
  runAuthorizedJob(input: {
    job: AudioSandboxJob;
    authorized: boolean;
    command: AudioCommand;
  }): Promise<AudioExecutionResult>;
}

/**
 * Keeps authorization outside the sandbox provider. A provider may isolate
 * execution, but it can never grant itself permission to execute a job.
 */
export function createAudioExecutionBroker(
  sandbox: AudioExecutionSandbox,
): AudioExecutionBroker {
  return {
    async runAuthorizedJob({ job, authorized, command }) {
      if (!authorized) throw new Error("Audio sandbox execution denied by authorization boundary.");
      if (!job.workerImageDigest.startsWith("sha256:")) {
        throw new Error("Sandbox worker image must be pinned by digest.");
      }
      if (job.network.mode === "allowlist" && (!job.network.allowedHosts || job.network.allowedHosts.length === 0)) {
        throw new Error("Allowlisted sandbox networking requires at least one allowed host.");
      }
      if (job.network.mode === "deny" && job.network.allowedHosts?.length) {
        throw new Error("Network-denied sandbox jobs cannot declare allowed hosts.");
      }

      const handle = await sandbox.createJob(job);
      try {
        return await sandbox.execute(handle, command);
      } finally {
        await sandbox.destroy(handle);
      }
    },
  };
}

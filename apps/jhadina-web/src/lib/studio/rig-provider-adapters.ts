export interface RigRequest {
  projectId: string;
  inputIds: string[];
  meshAssetId?: string;
  archetype?: "human" | "cartoon" | "puppet" | "creature";
}

export interface RigResult {
  provider: string;
  skeletonId: string;
  skinWeightsId: string;
  metadata?: Record<string, unknown>;
}

export interface RigProviderAdapter {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  execute(request: RigRequest): Promise<RigResult>;
}

abstract class HttpRigProvider implements RigProviderAdapter {
  abstract readonly name: string;
  protected abstract readonly baseUrlEnv: string;

  async isAvailable(): Promise<boolean> {
    const baseUrl = process.env[this.baseUrlEnv];
    if (!baseUrl) return false;
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`);
      return response.ok;
    } catch { return false; }
  }

  async execute(request: RigRequest): Promise<RigResult> {
    const baseUrl = process.env[this.baseUrlEnv];
    if (!baseUrl) throw new Error(`${this.baseUrlEnv} is not configured`);
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/rig`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`${this.name} returned HTTP ${response.status}`);
    const result = await response.json() as Partial<RigResult>;
    if (!result.skeletonId || !result.skinWeightsId) throw new Error(`${this.name} returned an incomplete rig result`);
    return { provider: this.name, skeletonId: result.skeletonId, skinWeightsId: result.skinWeightsId, metadata: result.metadata };
  }
}

export class RigNetProvider extends HttpRigProvider {
  readonly name = "rignet";
  protected readonly baseUrlEnv = "JHADINA_RIGNET_URL";
}

export class PinocchioProvider extends HttpRigProvider {
  readonly name = "pinocchio";
  protected readonly baseUrlEnv = "JHADINA_PINOCCHIO_URL";
}

export class RigProviderOrchestrator {
  constructor(private readonly providers: RigProviderAdapter[]) {}

  async execute(request: RigRequest, preferred: string[] = ["rignet", "pinocchio"]): Promise<RigResult> {
    const ordered = [...this.providers].sort((a, b) => (preferred.indexOf(a.name) + 1 || 999) - (preferred.indexOf(b.name) + 1 || 999));
    let lastError: unknown;
    for (const provider of ordered) {
      if (!(await provider.isAvailable())) continue;
      try { return await provider.execute(request); } catch (error) { lastError = error; }
    }
    throw new Error(`No rig provider is available${lastError ? `: ${String(lastError)}` : ""}`);
  }
}

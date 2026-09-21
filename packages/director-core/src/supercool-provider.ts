import type { TakeRequest } from './generation-orchestrator.js';
import type { GenerationProvider, GenerationResult } from './provider-bridge.js';

/**
 * SuperCool is treated as an optional production provider, not as DirectorOS's
 * source of truth. DirectorOS keeps ownership of story state, continuity locks,
 * approvals, and timeline governance.
 *
 * The public SuperCool material currently documents the product, connectors,
 * API gateway, and MCP access, but does not publish a stable movie-generation
 * HTTP request/response contract. Therefore this adapter deliberately requires
 * an injected transport instead of inventing a private SuperCool endpoint.
 */
export type SuperCoolGenerationRequest = {
  projectId: string;
  sceneId: string;
  prompt: string;
  targetRuntimeSeconds?: number;
  sceneCount?: number;
  takeCount?: number;
  variation?: string;
  continuity: {
    locks: TakeRequest['locked'];
    characterReferences: string[];
    assetReferences: string[];
  };
  cinematography?: TakeRequest['cinematography'];
  approvalRequired: true;
};

export type SuperCoolTransport = {
  submit(request: SuperCoolGenerationRequest): Promise<GenerationResult>;
};

export function toSuperCoolRequest(
  request: TakeRequest & { variation?: string },
): SuperCoolGenerationRequest {
  return {
    projectId: request.projectId,
    sceneId: request.sceneId,
    prompt: request.prompt,
    targetRuntimeSeconds: request.targetRuntimeSeconds,
    sceneCount: request.sceneCount,
    takeCount: request.takeCount,
    variation: request.variation,
    continuity: {
      locks: request.locked,
      characterReferences: request.referenceCharacterIds ?? [],
      assetReferences: request.referenceAssetIds ?? [],
    },
    cinematography: request.cinematography,
    approvalRequired: true,
  };
}

export function createSuperCoolProvider(
  transport: SuperCoolTransport,
): GenerationProvider {
  return {
    id: 'supercool',
    async generate(request) {
      return transport.submit(toSuperCoolRequest(request));
    },
  };
}

/**
 * Small HTTP transport seam for a future/confirmed SuperCool API gateway.
 * The endpoint and auth are supplied by the host application; no credentials
 * are stored in DirectorOS.
 */
export function createSuperCoolHttpTransport(input: {
  endpoint: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): SuperCoolTransport {
  const fetchImpl = input.fetchImpl ?? fetch;

  return {
    async submit(request) {
      const response = await fetchImpl(input.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(input.apiKey ? { authorization: `Bearer ${input.apiKey}` } : {}),
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`SuperCool provider returned HTTP ${response.status}`);
      }

      return await response.json() as GenerationResult;
    },
  };
}

import type { GenerationModality, GenerationRegistry } from './generation-registry';
import type { GenerationService, GenerationJob } from './generation-service';
import { compileTakePrompt, type TakeRequest } from './generation-orchestrator';
import type { DirectorGenerationGateInput, AuthoritativeDirectorGenerationGateInput } from './creative-gate-adapter';
import { evaluateDirectorGenerationGate } from './creative-gate-adapter';
import type { DirectorStoryboardLineageResolver } from './storyboard-lineage-resolver';
import type { DirectorCastResolver, ResolvedCharacterSceneIdentity } from './cast-bible';
import type { OrderedGenerationReference } from './generation-reference-manifest.js';

export interface DirectorCharacterReferenceAssetResolver {
  resolve(assetId: string, projectId: string): Promise<{ uri: string; sha256?: string; mimeType?: string }>;
}

export type PlannedGeneration = {
  modelId: string;
  modality: GenerationModality;
  negativePrompt?: string;
  parameters?: Record<string, unknown>;
  loras?: Array<{ loraId: string; weight?: number }>;
};

/** Provider submission boundary for Director takes. Canonical storyboard lineage and provenance are resolved here. */
export class GenerationPlanAdapter {
  constructor(
    private readonly generation: GenerationService,
    private readonly registry: GenerationRegistry,
    private readonly lineageResolver: DirectorStoryboardLineageResolver,
    private readonly castResolver?: DirectorCastResolver,
    private readonly characterReferenceAssetResolver?: DirectorCharacterReferenceAssetResolver,
  ) {}

  async submitTake(
    request: TakeRequest,
    plan: PlannedGeneration,
    gateInput: DirectorGenerationGateInput,
  ): Promise<GenerationJob> {
    if (gateInput.run.projectId !== request.projectId) {
      throw new Error('Generation gate project does not match the take request project.');
    }
    if (gateInput.generationStage.projectId !== request.projectId) {
      throw new Error('Generation stage project does not match the take request project.');
    }

    let storyboardLineage;
    try {
      storyboardLineage = await this.lineageResolver.resolve(request.storyboardBoardId, request.projectId);
    } catch (error) {
      throw new Error(`Generation submission blocked: ${error instanceof Error ? error.message : 'Unable to resolve canonical storyboard lineage.'}`);
    }

    if (storyboardLineage.board.id !== request.storyboardBoardId) {
      throw new Error('Generation submission blocked: resolved storyboard lineage does not match the requested canonical board ID.');
    }

    const authoritativeGateInput: AuthoritativeDirectorGenerationGateInput = {
      ...gateInput,
      storyboardLineage,
    };
    const decision = evaluateDirectorGenerationGate(authoritativeGateInput);
    if (!decision.allowed) throw new Error(`Generation submission blocked: ${decision.reason}`);

    const model = this.registry.getModel(plan.modelId);
    if (!model) throw new Error(`Model is not registered: ${plan.modelId}`);

    const loras = plan.loras?.map((selected) => {
      const lora = this.registry.getLoRA(selected.loraId);
      if (!lora) throw new Error(`LoRA is not registered: ${selected.loraId}`);
      return { lora, weight: selected.weight };
    });

    const characterIds = [...new Set(request.referenceCharacterIds ?? [])];
    let characterIdentities: ResolvedCharacterSceneIdentity[] = [];
    if (characterIds.length) {
      if (!this.castResolver) {
        throw new Error('Generation submission blocked: DIRECTOR_CAST_RESOLVER_REQUIRED');
      }
      characterIdentities = await Promise.all(
        characterIds.map(async (characterId) => {
          try {
            return await this.castResolver!.resolve(characterId, request.projectId, request.sceneId);
          } catch (error) {
            throw new Error(`Generation submission blocked: character ${characterId} could not be resolved: ${error instanceof Error ? error.message : 'DIRECTOR_CAST_RESOLUTION_FAILED'}`);
          }
        }),
      );
    }

    const characterReferenceIds = [...new Set(characterIdentities.flatMap((identity) => identity.referenceAssetIds))];
    let resolvedCharacterReferences: Array<{ assetId: string; role: 'character'; uri?: string }> =
      characterReferenceIds.map((assetId) => ({ assetId, role: 'character' as const }));

    if (characterReferenceIds.length) {
      if (!this.characterReferenceAssetResolver) {
        throw new Error('Generation submission blocked: DIRECTOR_CHARACTER_REFERENCE_ASSET_RESOLVER_REQUIRED');
      }
      resolvedCharacterReferences = await Promise.all(characterReferenceIds.map(async (assetId) => {
        const resolved = await this.characterReferenceAssetResolver!.resolve(assetId, request.projectId);
        return { assetId, role: 'character' as const, uri: resolved.uri };
      }));
    }

    const resolvedCharacterByAsset = new Map(
      resolvedCharacterReferences.map((reference) => [reference.assetId, reference]),
    );

    const references = request.referenceManifest
      ? buildManifestReferences(
          request.referenceManifest.references,
          characterReferenceIds,
          request.referenceAssetIds ?? [],
          resolvedCharacterByAsset,
        )
      : [
          ...resolvedCharacterReferences,
          ...(request.referenceAssetIds ?? []).map((assetId) => ({ assetId, role: 'image' as const })),
        ].filter((reference, index, all) =>
          all.findIndex((candidate) => candidate.assetId === reference.assetId && candidate.role === reference.role) === index,
        );

    const requestId = `director:${request.projectId}:take:${request.takeId}`;
    const creativeProvenance = {
      ...decision.creativeProvenance,
      generationJobId: requestId,
    };

    return this.generation.submit({
      requestId,
      projectId: request.projectId,
      modality: plan.modality,
      prompt: compileTakePrompt(request),
      negativePrompt: plan.negativePrompt,
      model,
      loras,
      references,
      parameters: {
        ...(plan.parameters ?? {}),
        targetRuntimeSeconds: request.targetRuntimeSeconds,
        sceneCount: request.sceneCount,
        takeCount: request.takeCount,
        parentTakeId: request.parentTakeId,
        storyboardBoardId: request.storyboardBoardId,
        continuityLocks: request.locked,
        characterContinuity: characterIdentities.map((identity) => ({
          characterId: identity.characterId,
          continuityRef: identity.continuityRef,
          canonicalAppearanceVariantId: identity.canonicalAppearanceVariantId,
          sceneAppearanceVariantId: identity.sceneAppearanceVariantId,
          referenceAssetIds: [...identity.referenceAssetIds],
          referenceSha256s: [...identity.referenceSha256s],
          voiceIdentityId: identity.voiceIdentityId,
          voiceVariantId: identity.voiceVariantId,
          language: identity.language,
          behaviorDnaRef: identity.behaviorDnaRef,
          rigAssetId: identity.rigAssetId,
          lockedTraits: [...identity.lockedTraits],
        })),
        cinematography: request.cinematography,
        cameraPlan: request.cameraPlan,
        performancePlan: request.performancePlan,
        realismPlan: request.realismPlan,
        referenceManifest: request.referenceManifest,
      },
      creativeProvenance,
    });
  }
}


function buildManifestReferences(
  manifestReferences: readonly OrderedGenerationReference[],
  characterReferenceIds: readonly string[],
  requestReferenceAssetIds: readonly string[],
  resolvedCharacterByAsset: ReadonlyMap<string, { assetId: string; role: 'character'; uri?: string }>,
) {
  const ordered = [...manifestReferences].sort((a, b) => a.slot - b.slot);
  const manifestAssetIds = new Set(ordered.map((reference) => reference.assetId));

  for (const assetId of characterReferenceIds) {
    if (!manifestAssetIds.has(assetId)) {
      throw new Error(`Generation submission blocked: DIRECTOR_REFERENCE_MANIFEST_CHARACTER_ASSET_MISSING:${assetId}`);
    }
  }
  for (const assetId of requestReferenceAssetIds) {
    if (!manifestAssetIds.has(assetId)) {
      throw new Error(`Generation submission blocked: DIRECTOR_REFERENCE_MANIFEST_ASSET_MISSING:${assetId}`);
    }
  }

  return ordered.map((reference) => {
    const resolvedCharacter = resolvedCharacterByAsset.get(reference.assetId);
    return {
      assetId: reference.assetId,
      role: providerReferenceRole(reference.role),
      ...(resolvedCharacter?.uri ? { uri: resolvedCharacter.uri } : {}),
    };
  });
}

function providerReferenceRole(
  role: OrderedGenerationReference['role'],
): 'character' | 'location' | 'style' | 'composition' | 'motion' | 'image' {
  switch (role) {
    case 'character-identity':
      return 'character';
    case 'location':
      return 'location';
    case 'style':
      return 'style';
    case 'composition':
    case 'depth':
    case 'normal':
      return 'composition';
    case 'source-video':
    case 'motion':
      return 'motion';
    default:
      return 'image';
  }
}

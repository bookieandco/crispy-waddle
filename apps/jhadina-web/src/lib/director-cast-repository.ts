import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveCharacterSceneIdentity,
  validateCharacterCastRecord,
  validateCharacterSceneBinding,
  validateMovieGradeVoiceIdentity,
  type CharacterAppearanceVariant,
  type CharacterCastRecord,
  type CharacterSceneBinding,
  type CharacterVoiceIdentity,
  type DirectorCastResolver,
  type ResolvedCharacterSceneIdentity,
} from '@jhadina/director-core';

type AnyRow = Record<string, any>;

export class SupabaseDirectorCastResolver implements DirectorCastResolver {
  constructor(private readonly client: SupabaseClient) {}

  async resolve(
    characterId: string,
    projectId: string,
    sceneId?: string,
  ): Promise<ResolvedCharacterSceneIdentity> {
    const cast = await loadDirectorCastRecord(this.client, { projectId, characterId });

    if (!sceneId) return resolveCharacterSceneIdentity(cast);

    const { data: row, error } = await this.client
      .from('director_scene_character_bindings')
      .select('appearance_variant_id,voice_identity_id,voice_variant_id,language')
      .eq('project_id', projectId)
      .eq('scene_id', sceneId)
      .eq('character_id', characterId)
      .maybeSingle();

    if (error) throw new Error(`DIRECTOR_CAST_SCENE_BINDING_READ_FAILED:${error.message}`);
    if (!row) return resolveCharacterSceneIdentity(cast);

    const binding: Omit<CharacterSceneBinding, 'referenceAssetIds'> = {
      projectId,
      characterId,
      continuityRef: cast.continuityRef,
      appearanceVariantId: String((row as AnyRow).appearance_variant_id),
      ...((row as AnyRow).voice_identity_id ? { voiceIdentityId: String((row as AnyRow).voice_identity_id) } : {}),
      ...((row as AnyRow).voice_variant_id ? { voiceVariantId: String((row as AnyRow).voice_variant_id) } : {}),
      ...((row as AnyRow).language ? { language: String((row as AnyRow).language) } : {}),
    };

    return resolveCharacterSceneIdentity(cast, binding);
  }
}

export async function loadDirectorCastRecord(
  client: SupabaseClient,
  input: { projectId: string; characterId: string },
): Promise<CharacterCastRecord> {
  const [{ data: castRow, error: castError }, { data: appearanceRows, error: appearanceError }, { data: voiceRow, error: voiceError }] =
    await Promise.all([
      client
        .from('director_cast_characters')
        .select('id,project_id,character_id,display_name,archetype,continuity_ref,character_description,appearance_description,performance_notes,description_revision,description_updated_at,description_updated_by,behavior_dna_ref,rig_asset_id,canonical_appearance_variant_id,locked_traits,identity_fingerprint_refs,approved_at,approved_by')
        .eq('project_id', input.projectId)
        .eq('character_id', input.characterId)
        .maybeSingle(),
      client
        .from('director_character_appearance_variants')
        .select('id,character_id,kind,label,reference_asset_ids,reference_sha256s,wardrobe_notes,appearance_notes,approved_at,approved_by')
        .eq('project_id', input.projectId)
        .eq('character_id', input.characterId)
        .order('created_at', { ascending: true }),
      client
        .from('director_voice_identities')
        .select('id,primary_language,default_variant_id')
        .eq('project_id', input.projectId)
        .eq('character_id', input.characterId)
        .maybeSingle(),
    ]);

  if (castError) throw new Error(`DIRECTOR_CAST_READ_FAILED:${castError.message}`);
  if (appearanceError) throw new Error(`DIRECTOR_CAST_APPEARANCE_READ_FAILED:${appearanceError.message}`);
  if (voiceError) throw new Error(`DIRECTOR_CAST_VOICE_REF_READ_FAILED:${voiceError.message}`);
  if (!castRow) throw new Error('DIRECTOR_CAST_NOT_FOUND');

  const cast = castRow as AnyRow;
  const variants: CharacterAppearanceVariant[] = (appearanceRows ?? []).map((raw) => {
    const row = raw as AnyRow;
    return {
      id: String(row.id),
      characterId: String(row.character_id),
      kind: row.kind,
      label: String(row.label),
      referenceAssetIds: asStringArray(row.reference_asset_ids),
      referenceSha256s: asStringArray(row.reference_sha256s),
      ...(asStringArray(row.wardrobe_notes).length ? { wardrobeNotes: asStringArray(row.wardrobe_notes) } : {}),
      ...(asStringArray(row.appearance_notes).length ? { appearanceNotes: asStringArray(row.appearance_notes) } : {}),
      approvedAt: String(row.approved_at),
      approvedBy: String(row.approved_by),
    };
  });

  const voice = voiceRow as AnyRow | null;
  const record: CharacterCastRecord = {
    id: String(cast.id),
    projectId: String(cast.project_id),
    characterId: String(cast.character_id),
    displayName: String(cast.display_name),
    archetype: cast.archetype,
    continuityRef: String(cast.continuity_ref),
    ...(cast.character_description ? { characterDescription: String(cast.character_description) } : {}),
    ...(cast.appearance_description ? { appearanceDescription: String(cast.appearance_description) } : {}),
    ...(asStringArray(cast.performance_notes).length ? { performanceNotes: asStringArray(cast.performance_notes) } : {}),
    ...(cast.description_revision ? { descriptionRevision: Number(cast.description_revision) } : {}),
    ...(cast.description_updated_at ? { descriptionUpdatedAt: String(cast.description_updated_at) } : {}),
    ...(cast.description_updated_by ? { descriptionUpdatedBy: String(cast.description_updated_by) } : {}),
    ...(cast.behavior_dna_ref ? { behaviorDnaRef: String(cast.behavior_dna_ref) } : {}),
    ...(cast.rig_asset_id ? { rigAssetId: String(cast.rig_asset_id) } : {}),
    canonicalAppearanceVariantId: String(cast.canonical_appearance_variant_id),
    appearanceVariants: variants,
    ...(voice ? {
      voice: {
        voiceIdentityId: String(voice.id),
        primaryLanguage: String(voice.primary_language),
        defaultVariantId: String(voice.default_variant_id),
      },
    } : {}),
    lockedTraits: asStringArray(cast.locked_traits),
    identityFingerprintRefs: asStringArray(cast.identity_fingerprint_refs),
    approvedAt: String(cast.approved_at),
    approvedBy: String(cast.approved_by),
  };

  const errors = validateCharacterCastRecord(record);
  if (errors.length) throw new Error(`DIRECTOR_CAST_INVALID:${errors.join('; ')}`);
  return record;
}

export async function saveDirectorCastRecord(
  client: SupabaseClient,
  input: { cast: CharacterCastRecord; approvedByUserId: string },
): Promise<void> {
  const errors = validateCharacterCastRecord(input.cast);
  if (errors.length) throw new Error(`DIRECTOR_CAST_INVALID:${errors.join('; ')}`);

  const { error: castError } = await client.from('director_cast_characters').upsert({
    id: input.cast.id,
    project_id: input.cast.projectId,
    character_id: input.cast.characterId,
    display_name: input.cast.displayName,
    archetype: input.cast.archetype,
    continuity_ref: input.cast.continuityRef,
    character_description: input.cast.characterDescription?.trim() || null,
    appearance_description: input.cast.appearanceDescription?.trim() || null,
    performance_notes: [...(input.cast.performanceNotes ?? [])],
    description_revision: input.cast.descriptionRevision ?? 1,
    description_updated_at: input.cast.descriptionUpdatedAt ?? input.cast.approvedAt,
    description_updated_by: input.cast.descriptionUpdatedBy ?? input.approvedByUserId,
    behavior_dna_ref: input.cast.behaviorDnaRef ?? null,
    rig_asset_id: input.cast.rigAssetId ?? null,
    canonical_appearance_variant_id: input.cast.canonicalAppearanceVariantId,
    locked_traits: [...input.cast.lockedTraits],
    identity_fingerprint_refs: [...(input.cast.identityFingerprintRefs ?? [])],
    approved_at: input.cast.approvedAt,
    approved_by: input.approvedByUserId,
  }, { onConflict: 'project_id,character_id' });
  if (castError) throw new Error(`DIRECTOR_CAST_WRITE_FAILED:${castError.message}`);

  for (const variant of input.cast.appearanceVariants) {
    const { error } = await client.from('director_character_appearance_variants').upsert({
      id: variant.id,
      project_id: input.cast.projectId,
      character_id: input.cast.characterId,
      kind: variant.kind,
      label: variant.label,
      reference_asset_ids: [...variant.referenceAssetIds],
      reference_sha256s: [...variant.referenceSha256s],
      wardrobe_notes: [...(variant.wardrobeNotes ?? [])],
      appearance_notes: [...(variant.appearanceNotes ?? [])],
      approved_at: variant.approvedAt,
      approved_by: input.approvedByUserId,
    });
    if (error) throw new Error(`DIRECTOR_CAST_APPEARANCE_WRITE_FAILED:${error.message}`);
  }
}

export async function saveDirectorCharacterSceneBinding(
  client: SupabaseClient,
  input: {
    cast: CharacterCastRecord;
    sceneId: string;
    binding: CharacterSceneBinding;
    updatedByUserId: string;
  },
): Promise<void> {
  const validation = validateCharacterSceneBinding(input.cast, input.binding);
  if (!validation.valid) throw new Error(`DIRECTOR_CAST_SCENE_BINDING_INVALID:${validation.reasons.join('; ')}`);
  if (!input.sceneId.trim()) throw new Error('DIRECTOR_CAST_SCENE_ID_REQUIRED');

  const { error } = await client.from('director_scene_character_bindings').upsert({
    id: `binding:${input.cast.projectId}:${input.sceneId}:${input.cast.characterId}`,
    project_id: input.cast.projectId,
    scene_id: input.sceneId,
    character_id: input.cast.characterId,
    appearance_variant_id: input.binding.appearanceVariantId,
    voice_identity_id: input.binding.voiceIdentityId ?? null,
    voice_variant_id: input.binding.voiceVariantId ?? null,
    language: input.binding.language ?? null,
    approved_at: new Date().toISOString(),
    approved_by: input.updatedByUserId,
  }, { onConflict: 'project_id,scene_id,character_id' });
  if (error) throw new Error(`DIRECTOR_CAST_SCENE_BINDING_WRITE_FAILED:${error.message}`);
}

export async function saveDirectorVoiceIdentity(
  client: SupabaseClient,
  input: { identity: CharacterVoiceIdentity; approvedByUserId: string },
): Promise<void> {
  const errors = validateMovieGradeVoiceIdentity(input.identity);
  if (errors.length) throw new Error(`DIRECTOR_VOICE_IDENTITY_INVALID:${errors.join('; ')}`);

  const { error: identityError } = await client.from('director_voice_identities').upsert({
    id: input.identity.id,
    project_id: input.identity.projectId,
    character_id: input.identity.characterId,
    display_name: input.identity.displayName,
    source: input.identity.source,
    consent_ref: input.identity.consentRef ?? null,
    primary_language: input.identity.primaryLanguage,
    default_variant_id: input.identity.defaultVariantId,
    speaker_fingerprint_refs: [...(input.identity.speakerFingerprintRefs ?? [])],
    minimum_speaker_similarity: input.identity.minimumSpeakerSimilarity,
    approved_at: input.identity.approvedAt,
    approved_by: input.approvedByUserId,
  });
  if (identityError) throw new Error(`DIRECTOR_VOICE_IDENTITY_WRITE_FAILED:${identityError.message}`);

  for (const sample of input.identity.referenceSamples) {
    const { error } = await client.from('director_voice_reference_samples').upsert({
      id: sample.id,
      voice_identity_id: input.identity.id,
      asset_id: sample.assetId,
      sha256: sample.sha256,
      language: sample.language,
      transcript: sample.transcript ?? null,
      duration_seconds: sample.durationSeconds,
      rights_ref: sample.rightsRef,
      quality_evidence_ids: [...sample.qualityEvidenceIds],
    });
    if (error) throw new Error(`DIRECTOR_VOICE_REFERENCE_WRITE_FAILED:${error.message}`);
  }

  for (const binding of input.identity.providerBindings) {
    const extended = binding as typeof binding & { reusablePromptRef?: string; speakerEmbeddingRef?: string };
    const { error } = await client.from('director_voice_provider_bindings').upsert({
      id: binding.id,
      voice_identity_id: input.identity.id,
      provider: binding.provider,
      model_id: binding.modelId,
      provider_voice_ref: binding.providerVoiceRef ?? null,
      reusable_prompt_ref: extended.reusablePromptRef ?? null,
      speaker_embedding_ref: extended.speakerEmbeddingRef ?? null,
      reference_sample_ids: [...binding.referenceSampleIds],
      supported_languages: [...binding.supportedLanguages],
      sample_rate_hz: binding.sampleRateHz ?? null,
      provenance_refs: [...binding.provenanceRefs],
      enabled: true,
    });
    if (error) throw new Error(`DIRECTOR_VOICE_PROVIDER_WRITE_FAILED:${error.message}`);
  }

  for (const variant of input.identity.languageVariants) {
    const { error } = await client.from('director_voice_language_variants').upsert({
      id: variant.id,
      voice_identity_id: input.identity.id,
      language: variant.language,
      locale: variant.locale ?? null,
      pronunciation_lexicon_ref: variant.pronunciationLexiconRef ?? null,
      accent_policy: variant.accentPolicy,
      delivery_style: variant.deliveryStyle ?? null,
      provider_binding_ids: [...variant.providerBindingIds],
    });
    if (error) throw new Error(`DIRECTOR_VOICE_VARIANT_WRITE_FAILED:${error.message}`);
  }
}

export async function getDirectorVoiceIdentity(
  client: SupabaseClient,
  input: { projectId: string; characterId: string; voiceIdentityId: string },
): Promise<CharacterVoiceIdentity | undefined> {
  const [{ data: identityRow, error: identityError }, { data: samples, error: sampleError }, { data: bindings, error: bindingError }, { data: variants, error: variantError }] =
    await Promise.all([
      client.from('director_voice_identities')
        .select('id,project_id,character_id,display_name,source,consent_ref,primary_language,default_variant_id,speaker_fingerprint_refs,minimum_speaker_similarity,approved_at,approved_by')
        .eq('id', input.voiceIdentityId)
        .eq('project_id', input.projectId)
        .eq('character_id', input.characterId)
        .maybeSingle(),
      client.from('director_voice_reference_samples').select('*').eq('voice_identity_id', input.voiceIdentityId),
      client.from('director_voice_provider_bindings').select('*').eq('voice_identity_id', input.voiceIdentityId).eq('enabled', true),
      client.from('director_voice_language_variants').select('*').eq('voice_identity_id', input.voiceIdentityId),
    ]);

  if (identityError) throw new Error(`DIRECTOR_VOICE_IDENTITY_READ_FAILED:${identityError.message}`);
  if (sampleError) throw new Error(`DIRECTOR_VOICE_REFERENCE_READ_FAILED:${sampleError.message}`);
  if (bindingError) throw new Error(`DIRECTOR_VOICE_PROVIDER_READ_FAILED:${bindingError.message}`);
  if (variantError) throw new Error(`DIRECTOR_VOICE_VARIANT_READ_FAILED:${variantError.message}`);
  if (!identityRow) return undefined;

  const row = identityRow as AnyRow;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    characterId: String(row.character_id),
    displayName: String(row.display_name),
    source: row.source,
    ...(row.consent_ref ? { consentRef: String(row.consent_ref) } : {}),
    primaryLanguage: String(row.primary_language),
    referenceSamples: (samples ?? []).map((raw) => {
      const sample = raw as AnyRow;
      return {
        id: String(sample.id),
        assetId: String(sample.asset_id),
        sha256: String(sample.sha256),
        language: String(sample.language),
        ...(sample.transcript ? { transcript: String(sample.transcript) } : {}),
        durationSeconds: Number(sample.duration_seconds),
        rightsRef: String(sample.rights_ref),
        qualityEvidenceIds: asStringArray(sample.quality_evidence_ids),
      };
    }),
    providerBindings: (bindings ?? []).map((raw) => {
      const binding = raw as AnyRow;
      return {
        id: String(binding.id),
        provider: String(binding.provider),
        modelId: String(binding.model_id),
        ...(binding.provider_voice_ref ? { providerVoiceRef: String(binding.provider_voice_ref) } : {}),
        ...(binding.reusable_prompt_ref ? { reusablePromptRef: String(binding.reusable_prompt_ref) } : {}),
        ...(binding.speaker_embedding_ref ? { speakerEmbeddingRef: String(binding.speaker_embedding_ref) } : {}),
        referenceSampleIds: asStringArray(binding.reference_sample_ids),
        supportedLanguages: asStringArray(binding.supported_languages),
        ...(binding.sample_rate_hz ? { sampleRateHz: Number(binding.sample_rate_hz) } : {}),
        provenanceRefs: asStringArray(binding.provenance_refs),
      };
    }),
    languageVariants: (variants ?? []).map((raw) => {
      const variant = raw as AnyRow;
      return {
        id: String(variant.id),
        voiceIdentityId: input.voiceIdentityId,
        language: String(variant.language),
        ...(variant.locale ? { locale: String(variant.locale) } : {}),
        ...(variant.pronunciation_lexicon_ref ? { pronunciationLexiconRef: String(variant.pronunciation_lexicon_ref) } : {}),
        accentPolicy: variant.accent_policy,
        ...(variant.delivery_style ? { deliveryStyle: String(variant.delivery_style) } : {}),
        providerBindingIds: asStringArray(variant.provider_binding_ids),
      };
    }),
    defaultVariantId: String(row.default_variant_id),
    speakerFingerprintRefs: asStringArray(row.speaker_fingerprint_refs),
    minimumSpeakerSimilarity: Number(row.minimum_speaker_similarity),
    approvedAt: String(row.approved_at),
    approvedBy: String(row.approved_by),
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

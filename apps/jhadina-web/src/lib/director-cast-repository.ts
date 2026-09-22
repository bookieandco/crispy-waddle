import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveCharacterSceneIdentity,
  validateCharacterCastRecord,
  validateCharacterSceneBinding,
  type CharacterCastRecord,
  type CharacterSceneBinding,
  type CharacterVoiceIdentity,
  type DirectorCastResolver,
  type ResolvedCharacterSceneIdentity,
} from '@jhadina/director-core';

type CastRow = {
  cast_record: CharacterCastRecord;
};

type BindingRow = {
  binding: CharacterSceneBinding;
};

export class SupabaseDirectorCastResolver implements DirectorCastResolver {
  constructor(private readonly client: SupabaseClient) {}

  async resolve(
    characterId: string,
    projectId: string,
    sceneId?: string,
  ): Promise<ResolvedCharacterSceneIdentity> {
    const { data: castRow, error: castError } = await this.client
      .from('director_cast_records')
      .select('cast_record')
      .eq('project_id', projectId)
      .eq('character_id', characterId)
      .maybeSingle();

    if (castError) throw new Error(`DIRECTOR_CAST_READ_FAILED:${castError.message}`);
    if (!castRow) throw new Error('DIRECTOR_CAST_NOT_FOUND');

    const cast = (castRow as CastRow).cast_record;
    const castErrors = validateCharacterCastRecord(cast);
    if (castErrors.length) throw new Error(`DIRECTOR_CAST_INVALID:${castErrors.join('; ')}`);
    if (cast.projectId !== projectId || cast.characterId !== characterId) {
      throw new Error('DIRECTOR_CAST_ROW_IDENTITY_MISMATCH');
    }

    if (!sceneId) return resolveCharacterSceneIdentity(cast);

    const { data: bindingRow, error: bindingError } = await this.client
      .from('director_character_scene_bindings')
      .select('binding')
      .eq('project_id', projectId)
      .eq('scene_id', sceneId)
      .eq('character_id', characterId)
      .maybeSingle();

    if (bindingError) throw new Error(`DIRECTOR_CAST_SCENE_BINDING_READ_FAILED:${bindingError.message}`);
    if (!bindingRow) return resolveCharacterSceneIdentity(cast);

    const binding = (bindingRow as BindingRow).binding;
    const validation = validateCharacterSceneBinding(cast, binding);
    if (!validation.valid) throw new Error(`DIRECTOR_CAST_SCENE_BINDING_INVALID:${validation.reasons.join('; ')}`);
    return resolveCharacterSceneIdentity(cast, binding);
  }
}

export async function saveDirectorCastRecord(
  client: SupabaseClient,
  input: { cast: CharacterCastRecord; approvedByUserId: string },
): Promise<void> {
  const errors = validateCharacterCastRecord(input.cast);
  if (errors.length) throw new Error(`DIRECTOR_CAST_INVALID:${errors.join('; ')}`);

  const now = new Date().toISOString();
  const { error } = await client.from('director_cast_records').upsert({
    id: input.cast.id,
    project_id: input.cast.projectId,
    character_id: input.cast.characterId,
    continuity_ref: input.cast.continuityRef,
    canonical_appearance_variant_id: input.cast.canonicalAppearanceVariantId,
    cast_record: input.cast,
    approved_by_user_id: input.approvedByUserId,
    created_at: input.cast.approvedAt || now,
    updated_at: now,
  }, { onConflict: 'project_id,character_id' });
  if (error) throw new Error(`DIRECTOR_CAST_WRITE_FAILED:${error.message}`);
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

  const { error } = await client.from('director_character_scene_bindings').upsert({
    project_id: input.cast.projectId,
    scene_id: input.sceneId,
    character_id: input.cast.characterId,
    binding: input.binding,
    updated_by_user_id: input.updatedByUserId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id,scene_id,character_id' });
  if (error) throw new Error(`DIRECTOR_CAST_SCENE_BINDING_WRITE_FAILED:${error.message}`);
}

export async function saveDirectorVoiceIdentity(
  client: SupabaseClient,
  input: { identity: CharacterVoiceIdentity; approvedByUserId: string },
): Promise<void> {
  if (!input.identity.id.trim() || !input.identity.projectId.trim() || !input.identity.characterId.trim()) {
    throw new Error('DIRECTOR_VOICE_IDENTITY_REQUIRED');
  }
  const { error } = await client.from('director_voice_identity_records').upsert({
    id: input.identity.id,
    project_id: input.identity.projectId,
    character_id: input.identity.characterId,
    voice_identity: input.identity,
    approved_by_user_id: input.approvedByUserId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`DIRECTOR_VOICE_IDENTITY_WRITE_FAILED:${error.message}`);
}

export async function getDirectorVoiceIdentity(
  client: SupabaseClient,
  input: { projectId: string; characterId: string; voiceIdentityId: string },
): Promise<CharacterVoiceIdentity | undefined> {
  const { data, error } = await client
    .from('director_voice_identity_records')
    .select('voice_identity')
    .eq('id', input.voiceIdentityId)
    .eq('project_id', input.projectId)
    .eq('character_id', input.characterId)
    .maybeSingle();

  if (error) throw new Error(`DIRECTOR_VOICE_IDENTITY_READ_FAILED:${error.message}`);
  return data?.voice_identity as CharacterVoiceIdentity | undefined;
}

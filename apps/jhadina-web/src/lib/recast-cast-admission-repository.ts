import type {SupabaseClient} from '@supabase/supabase-js'
import {evaluateRecastCastAppearance,type RecastAppearanceRow,type RecastCastRow,
  type RecastCastAdmission} from '@jhadina/director-core'

/**
 * Call ONLY after authenticated Director project membership verification.
 * Never trust appearance/approval rows supplied by the browser or model worker.
 * Existing Cast tables are already service-role-only, with approvals stored
 * on both the identity and its appearance variant.
 */
export async function resolveRecastCastAdmission(
  privileged:SupabaseClient,
  projectId:string,
  imageSha256:string,
):Promise<RecastCastAdmission> {
  if (!projectId.trim() || !/^[a-f0-9]{64}$/i.test(imageSha256)) {
    throw new Error('DIRECTOR_RECAST_CAST_SOURCE_INVALID')
  }
  const [{data:appearanceRows,error:appearanceError},{data:castRows,error:castError}]=await Promise.all([
    privileged.from('director_character_appearance_variants')
      .select('id,project_id,character_id,reference_sha256s,approved_at,approved_by')
      .eq('project_id',projectId).limit(200),
    privileged.from('director_cast_characters')
      .select('project_id,character_id,canonical_appearance_variant_id,approved_at,approved_by')
      .eq('project_id',projectId).limit(200),
  ])
  if(appearanceError||castError)throw new Error('DIRECTOR_RECAST_CAST_REVIEW_STORE_UNAVAILABLE')
  return evaluateRecastCastAppearance(
    projectId,imageSha256, (castRows??[]) as RecastCastRow[], (appearanceRows??[]) as RecastAppearanceRow[],
  )
}
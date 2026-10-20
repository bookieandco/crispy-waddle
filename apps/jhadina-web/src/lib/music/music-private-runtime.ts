/** Music prototype's privileged boundary. Browser never receives a server key.
 *
 * Vercel production uses the existing verified production OIDC service proxy.
 * Previews MAY use a separate explicitly provisioned isolated Supabase project,
 * but MUST NEVER use Jhadina's recovered production Swlc database.
 */
import {createRuntimeServiceRoleClient} from "@/lib/supabase/service-role";
import type {SupabaseClient} from "@supabase/supabase-js";

const SWLC_PROD_REF="kqbkaozfjubkjevdfvic";
const ID=/^[a-z0-9]{20}$/;
export function previewMusicIsolationReady(env:NodeJS.ProcessEnv=process.env):boolean {
  if(env.VERCEL_ENV!=="preview")return false;
  if(env.VERCEL_PROJECT_ID!=="prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco")return false;
  if(!env.VERCEL_GIT_COMMIT_REF?.startsWith("music-prototype-live-"))return false;
  const ref=env.MUSIC_PREVIEW_ISOLATED_PROJECT_REF?.trim()??"";
  if(!ID.test(ref)||ref===SWLC_PROD_REF)return false;
  const publicUrl=env.NEXT_PUBLIC_SUPABASE_URL?.trim()??"";
  const privateUrl=env.SUPABASE_URL?.trim()??publicUrl;
  if(publicUrl!==`https://${ref}.supabase.co`||privateUrl!==publicUrl)return false;
  return Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}
export async function createMusicPrototypePrivilegedClient():Promise<SupabaseClient|null> {
  const stage=process.env.VERCEL_ENV;
  // Local development's privileged client is permitted ONLY with locally
  // configured secrets; credentials are never returned in API responses.
  if(stage==="preview"&&!previewMusicIsolationReady())return null;
  if(stage && !["preview","production"].includes(stage))return null;
  return createRuntimeServiceRoleClient();
}

import {NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {createClient} from '@/lib/supabase/server';
import {createMusicJuggernautRepository} from '@/lib/music/music-juggernaut-repository';
import {createMusicCommissioningRepository} from '@/lib/music/music-commissioning-repository';
import {createSocialRepository} from '@/lib/social/repository';
import {buildMusicJuggernautRecovery} from '@/lib/music/music-juggernaut-recovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ARTIST_KEY = 'atwood-bookie';

type Row = Record<string, unknown>;
/** Data permission failures remain unknown, NEVER interpreted as empty or ready. */
async function optionalProjectRows(table: string, userId: string, projectId: string): Promise<readonly Row[] | null> {
  try {
    const db = await createClient();
    const {data,error} = await db.from(table).select('*')
      .eq('user_id',userId).eq('project_id',projectId).limit(250);
    return error ? null : (data ?? []) as Row[];
  } catch { return null; }
}

export async function GET() {
  try {
    const identity = await (await createRequestIdentityVerifier()).verify({});
    const userId = identity.userId;
    const music = createMusicJuggernautRepository();
    const project = await music.getProject(userId,ARTIST_KEY);
    if (!project) return NextResponse.json({
      success:false,error:'MUSIC_JUGGERNAUT_OWNER_PROJECT_MISSING',
    },{status:404,headers:{'Cache-Control':'no-store'}});
    const projectId = String(project.id);
    const commission = createMusicCommissioningRepository();
    const [songs,experiments,observations,rights,learning,platformAccounts,catalogReleases,royaltySnapshots,socialAccounts,musicSocialLineage] =
      await Promise.all([
        music.listSongs(userId,projectId),
        music.listExperiments(userId,projectId),
        music.listObservations(userId,projectId),
        music.listRights(userId,projectId),
        music.listLearning(userId,projectId),
        commission.listPlatformAccounts(userId,projectId),
        commission.listCatalogReleases(userId,projectId),
        commission.listRoyaltySnapshots(userId,projectId),
        createSocialRepository().listAccounts(userId).then(accounts => accounts.map(a => ({
          id:a.id,platform:a.platform,status:a.status,provider:a.provider,
        }))).catch(() => null),
        optionalProjectRows('jhadina_music_social_lineage',userId,projectId),
      ]);
    // These three require separate evidence-bound provider/device readbacks.
    // Never synthesize their proof by counting generic Director/Social records.
    const assessment = buildMusicJuggernautRecovery({
      project,songs,experiments,observations,rights,learning,platformAccounts,
      catalogReleases,royaltySnapshots,socialAccounts,musicSocialLineage,
      directorApprovedForMusic:null,
      verifiedProviderReadbacks:null,
      independentPhoneAcceptance:null,
    });
    return NextResponse.json({success:true,data:assessment},{
      headers:{'Cache-Control':'private, no-store, max-age=0'},
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MUSIC_JUGGERNAUT_RECOVERY_READ_FAILED';
    const unauthorized = /auth|session|identity|unauthorized/i.test(message);
    return NextResponse.json({success:false,error: unauthorized ? 'Authentication required' : 'Music recovery evidence unavailable'}, {
      status: unauthorized ? 401 : 503, headers:{'Cache-Control':'no-store'},
    });
  }
}

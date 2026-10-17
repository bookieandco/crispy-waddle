import {getGithubOidcToken} from './github-oidc-token'

// A single exact SWLC Edge origin; never send an OIDC bearer to a dynamically
// supplied URL. This endpoint has no DB mutation method or SAM search route.
const SHADOW_GATEWAY='https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-sam-shadow-gateway'

export async function probeSamShadowDatabase():Promise<{
  ok:true;ready:true;mode:'read_only_shadow';database:'queryable';
  authority:'none';canMutate:false
}>{
  const token=await getGithubOidcToken('jhadina-sam-shadow','SAM_SHADOW_OIDC_TOKEN')
  const response=await fetch(SHADOW_GATEWAY,{
    method:'POST',
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({action:'probe_db'}),
    redirect:'error',
    cache:'no-store',
    signal:AbortSignal.timeout(25_000),
  })
  const payload=await response.json().catch(()=>null) as Record<string,unknown>|null
  if(!response.ok||payload?.ok!==true||payload.ready!==true||
    payload.mode!=='read_only_shadow'||payload.database!=='queryable'||
    payload.authority!=='none'||payload.canMutate!==false){
    throw new Error('SAM_SHADOW_DATABASE_NOT_READY')
  }
  return payload as Awaited<ReturnType<typeof probeSamShadowDatabase>>
}

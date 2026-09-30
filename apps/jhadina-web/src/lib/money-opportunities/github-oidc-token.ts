type CachedOidcToken={token:string;expiresAtMs:number|null}
const cache=new Map<string,CachedOidcToken>()

function decodeJwtPayload(token:string):Record<string,unknown>|null{
  const parts=token.split('.')
  if(parts.length<2)return null
  try{
    const normalized=parts[1]!.replace(/-/g,'+').replace(/_/g,'/')
    const padded=normalized.padEnd(Math.ceil(normalized.length/4)*4,'=')
    return JSON.parse(Buffer.from(padded,'base64').toString('utf8')) as Record<string,unknown>
  }catch{return null}
}
function expiryMs(token:string):number|null{
  const exp=decodeJwtPayload(token)?.exp
  return typeof exp==='number'&&Number.isFinite(exp)?exp*1000:null
}
function stillFresh(entry:CachedOidcToken,marginMs=90_000){
  return entry.expiresAtMs===null||entry.expiresAtMs-Date.now()>marginMs
}
function actionsOidcConfigured(){
  return Boolean(process.env.ACTIONS_ID_TOKEN_REQUEST_URL?.trim()&&process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN?.trim())
}
export function githubOidcAvailable(staticEnvName:string){
  return Boolean(process.env[staticEnvName]?.trim()||actionsOidcConfigured())
}
async function mintGithubOidcToken(audience:string){
  const requestUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL?.trim()
  const requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN?.trim()
  if(!requestUrl||!requestToken)throw new Error('GitHub Actions OIDC request credentials are unavailable')
  const url=new URL(requestUrl)
  url.searchParams.set('audience',audience)
  const response=await fetch(url,{
    method:'GET',
    headers:{authorization:`Bearer ${requestToken}`,accept:'application/json'},
    cache:'no-store',
    signal:AbortSignal.timeout(20_000),
  })
  const payload=await response.json().catch(()=>({})) as Record<string,unknown>
  const value=typeof payload.value==='string'?payload.value.trim():''
  if(!response.ok||!value)throw new Error(`GitHub OIDC mint failed: ${response.status}`)
  const minted={token:value,expiresAtMs:expiryMs(value)}
  if(!stillFresh(minted,30_000))throw new Error('GitHub OIDC mint returned an already-expired token')
  cache.set(audience,minted)
  return value
}
export async function getGithubOidcToken(audience:string,staticEnvName:string){
  const cached=cache.get(audience)
  if(cached&&stillFresh(cached))return cached.token

  const staticToken=process.env[staticEnvName]?.trim()
  if(staticToken){
    const seeded={token:staticToken,expiresAtMs:expiryMs(staticToken)}
    if(stillFresh(seeded)){
      cache.set(audience,seeded)
      return staticToken
    }
  }

  if(actionsOidcConfigured())return mintGithubOidcToken(audience)
  if(staticToken)return staticToken
  throw new Error(`${staticEnvName} is not configured`)
}

export function __resetGithubOidcCacheForTests(){
  cache.clear()
}

import { timingSafeEqual } from 'node:crypto'

const GITHUB_OIDC_ISSUER='https://token.actions.githubusercontent.com'
const GITHUB_OIDC_JWKS='https://token.actions.githubusercontent.com/.well-known/jwks'
const GITHUB_REPOSITORY='bookieandco/crispy-waddle'
const GITHUB_REPOSITORY_ID='1320251374'
const GITHUB_REPOSITORY_OWNER='bookieandco'
const GITHUB_REPOSITORY_OWNER_ID='289295074'
const GITHUB_MAIN_REF='refs/heads/main'
const GITHUB_WORKFLOW_REF='bookieandco/crispy-waddle/.github/workflows/shark-shadow-swlc-recovery-sync.yml@refs/heads/main'
const GITHUB_AUDIENCE='jhadina-shadow-sync'
const GITHUB_SUBJECT='repo:bookieandco@289295074/crispy-waddle@1320251374:ref:refs/heads/main'

type Header={alg?:string;kid?:string}
type Claims={
  iss?:string;aud?:string|string[];sub?:string;exp?:number;nbf?:number;
  repository?:string;repository_id?:string;repository_owner?:string;repository_owner_id?:string;
  ref?:string;workflow_ref?:string;event_name?:string
}
type Jwk=JsonWebKey&{kid?:string}
let cache:{expiresAt:number;keys:Jwk[]}|undefined

export function bearerToken(value:string|string[]|undefined):string{
  const raw=Array.isArray(value)?value[0]:value
  if(!raw?.startsWith('Bearer '))throw new Error('SHADOW_GITHUB_OIDC_BEARER_REQUIRED')
  const token=raw.slice(7).trim()
  if(!token)throw new Error('SHADOW_GITHUB_OIDC_BEARER_REQUIRED')
  return token
}

const decode=<T>(value:string):T=>JSON.parse(Buffer.from(value,'base64url').toString('utf8')) as T
const aud=(value:string|string[]|undefined)=>typeof value==='string'?value===GITHUB_AUDIENCE:Array.isArray(value)&&value.includes(GITHUB_AUDIENCE)

function trusted(c:Claims,now:number):boolean{
  return c.iss===GITHUB_OIDC_ISSUER
    && aud(c.aud)
    && c.sub===GITHUB_SUBJECT
    && c.repository===GITHUB_REPOSITORY
    && c.repository_id===GITHUB_REPOSITORY_ID
    && c.repository_owner===GITHUB_REPOSITORY_OWNER
    && c.repository_owner_id===GITHUB_REPOSITORY_OWNER_ID
    && c.ref===GITHUB_MAIN_REF
    && c.workflow_ref===GITHUB_WORKFLOW_REF
    && ['schedule','workflow_dispatch'].includes(c.event_name??'')
    && typeof c.exp==='number'&&c.exp>now
    && !(typeof c.nbf==='number'&&c.nbf>now+30)
}

async function keys(fetchImpl:typeof fetch,force=false):Promise<Jwk[]>{
  const now=Date.now()
  if(!force&&cache&&cache.expiresAt>now)return cache.keys
  const response=await fetchImpl(GITHUB_OIDC_JWKS,{headers:{accept:'application/json'},cache:'no-store'})
  if(!response.ok)throw new Error('SHADOW_GITHUB_OIDC_JWKS_HTTP_'+response.status)
  const body=await response.json() as {keys?:Jwk[]}
  if(!Array.isArray(body.keys)||!body.keys.length)throw new Error('SHADOW_GITHUB_OIDC_JWKS_EMPTY')
  cache={expiresAt:now+5*60_000,keys:body.keys}
  return body.keys
}

export async function verifyGithubShadowOidc(
  token:string,
  options:{fetchImpl?:typeof fetch;nowSeconds?:number}={},
):Promise<void>{
  const parts=token.split('.')
  if(parts.length!==3)throw new Error('SHADOW_GITHUB_OIDC_INVALID')
  let header:Header,claims:Claims
  try{header=decode<Header>(parts[0]!);claims=decode<Claims>(parts[1]!)}
  catch{throw new Error('SHADOW_GITHUB_OIDC_INVALID')}
  const now=options.nowSeconds??Math.floor(Date.now()/1000)
  if(header.alg!=='RS256'||!header.kid||!trusted(claims,now))throw new Error('SHADOW_GITHUB_OIDC_IDENTITY_REJECTED')
  const fetchImpl=options.fetchImpl??fetch
  let jwk=(await keys(fetchImpl)).find(x=>x.kid===header.kid)
  if(!jwk)jwk=(await keys(fetchImpl,true)).find(x=>x.kid===header.kid)
  if(!jwk)throw new Error('SHADOW_GITHUB_OIDC_SIGNING_KEY_MISSING')
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify'])
  const ok=await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',key,Buffer.from(parts[2]!,'base64url'),Buffer.from(parts[0]+'.'+parts[1]),
  )
  if(!ok)throw new Error('SHADOW_GITHUB_OIDC_SIGNATURE_INVALID')
}

export function shadowGithubOidcIdentity(){
  return Object.freeze({
    issuer:GITHUB_OIDC_ISSUER,audience:GITHUB_AUDIENCE,repository:GITHUB_REPOSITORY,
    repositoryId:GITHUB_REPOSITORY_ID,repositoryOwner:GITHUB_REPOSITORY_OWNER,
    repositoryOwnerId:GITHUB_REPOSITORY_OWNER_ID,ref:GITHUB_MAIN_REF,workflowRef:GITHUB_WORKFLOW_REF,
    subject:GITHUB_SUBJECT,authority:'SYNC_AUTH_ONLY' as const,
  })
}

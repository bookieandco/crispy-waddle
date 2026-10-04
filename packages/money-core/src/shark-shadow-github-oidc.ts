import {createPublicKey,verify} from 'node:crypto'

const ISSUER='https://token.actions.githubusercontent.com'
const JWKS_URL='https://token.actions.githubusercontent.com/.well-known/jwks'
const EXPECTED_REPOSITORY='bookieandco/crispy-waddle'
const EXPECTED_REPOSITORY_ID='1320251374'
const EXPECTED_AUDIENCE='jhadina-shadow-sync'

type GithubOidcHeader=Readonly<{alg?:string;kid?:string;typ?:string}>
export type GithubShadowOidcClaims=Readonly<{
  iss?:string
  aud?:string|string[]
  exp?:number
  nbf?:number
  iat?:number
  repository?:string
  repository_id?:string
  workflow_ref?:string
  event_name?:string
  ref?:string
}>

let cached:Readonly<{expiresAt:number;keys:readonly any[]}>|undefined
const decode=(v:string)=>Buffer.from(v.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(v.length/4)*4,'='),'base64')
const json=<T>(v:string):T=>JSON.parse(decode(v).toString('utf8')) as T

export function validateGithubShadowClaims(claims:GithubShadowOidcClaims,nowSeconds=Math.floor(Date.now()/1000)):void{
  if(claims.iss!==ISSUER)throw new Error('SHADOW_SYNC_OIDC_ISSUER_INVALID')
  const audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud].filter(Boolean)
  if(!audiences.includes(EXPECTED_AUDIENCE))throw new Error('SHADOW_SYNC_OIDC_AUDIENCE_INVALID')
  if(!claims.exp||claims.exp<nowSeconds-30)throw new Error('SHADOW_SYNC_OIDC_EXPIRED')
  if(claims.nbf&&claims.nbf>nowSeconds+30)throw new Error('SHADOW_SYNC_OIDC_NOT_YET_VALID')
  const repoMatch=claims.repository===EXPECTED_REPOSITORY
  const immutableMatch=String(claims.repository_id??'')===EXPECTED_REPOSITORY_ID
  if(!repoMatch&&!immutableMatch)throw new Error('SHADOW_SYNC_OIDC_REPOSITORY_INVALID')
  if(claims.workflow_ref&&!claims.workflow_ref.startsWith(EXPECTED_REPOSITORY+'/.github/workflows/')){
    throw new Error('SHADOW_SYNC_OIDC_WORKFLOW_INVALID')
  }
}

async function jwks():Promise<readonly any[]>{
  const now=Date.now()
  if(cached&&cached.expiresAt>now)return cached.keys
  const response=await fetch(JWKS_URL,{headers:{accept:'application/json'},cache:'no-store'})
  if(!response.ok)throw new Error('SHADOW_SYNC_OIDC_JWKS_HTTP_'+response.status)
  const body:any=await response.json()
  if(!Array.isArray(body?.keys)||!body.keys.length)throw new Error('SHADOW_SYNC_OIDC_JWKS_EMPTY')
  cached=Object.freeze({expiresAt:now+15*60_000,keys:Object.freeze(body.keys)})
  return cached.keys
}

export async function verifyGithubShadowOidc(token:string):Promise<GithubShadowOidcClaims>{
  const parts=token.split('.')
  if(parts.length!==3)throw new Error('SHADOW_SYNC_OIDC_MALFORMED')
  const header=json<GithubOidcHeader>(parts[0]!)
  if(header.alg!=='RS256'||!header.kid)throw new Error('SHADOW_SYNC_OIDC_HEADER_INVALID')
  const keys=await jwks()
  const jwk=keys.find((x:any)=>x?.kid===header.kid&&x?.kty==='RSA')
  if(!jwk)throw new Error('SHADOW_SYNC_OIDC_KEY_NOT_FOUND')
  const key=createPublicKey({key:jwk,format:'jwk'})
  const ok=verify('RSA-SHA256',Buffer.from(parts[0]+'-'+parts[1]),key,decode(parts[2]!))
  if(!ok)throw new Error('SHADOW_SYNC_OIDC_SIGNATURE_INVALID')
  const claims=json<GithubShadowOidcClaims>(parts[1]!)
  validateGithubShadowClaims(claims)
  return Object.freeze({...claims})
}

export function bearerToken(value:string|undefined):string{
  const match=/^Bearer\s+(.+)$/i.exec(value??'')
  if(!match?.[1])throw new Error('SHADOW_SYNC_BEARER_REQUIRED')
  return match[1]
}

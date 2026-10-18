import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { encryptSecret, decryptSecret } from '@/lib/youtube-oauth'

export const GSC_READONLY_SCOPE='https://www.googleapis.com/auth/webmasters.readonly'
export const GSC_COOKIE='jhadina_personal_gsc_grant'
export const GSC_PENDING_COOKIE='jhadina_personal_gsc_pending'
export type PendingGscConsent={
  stateHash:string;codeVerifier:string;ownerUserId:string;ventureId:string;issuedAt:number
}
export type BrowserGscGrant={
  refreshToken:string;ownerUserId:string;ventureId:string;createdAt:number
}
function config(name:string,fallback?:string):string{
  const v=process.env[name]?.trim() || (fallback?process.env[fallback]?.trim():undefined)
  if(!v)throw new Error('PERSONAL_SEO_GOOGLE_CONFIG_MISSING')
  return v
}
export function gscRedirectUri():string{
  const value=config('JHADINA_GSC_OAUTH_REDIRECT_URI')
  const u=new URL(value)
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port||
    u.pathname!=='/api/growth/seo/oauth/callback')
    throw new Error('PERSONAL_SEO_OAUTH_REDIRECT_INVALID')
  return u.toString()
}
export function gscGoogleClientId():string{
  return config('JHADINA_GSC_OAUTH_CLIENT_ID','GOOGLE_CLIENT_ID')
}
export function gscGoogleClientSecret():string{
  return config('JHADINA_GSC_OAUTH_CLIENT_SECRET','GOOGLE_CLIENT_SECRET')
}
function digest(value:string){return createHash('sha256').update(value).digest('base64url')}
function equal(left:string,right:string):boolean{
  const a=Buffer.from(left),b=Buffer.from(right)
  return a.length===b.length&&timingSafeEqual(a,b)
}
export function createPersonalGscConsent(input:{
  ownerUserId:string;ventureId:string;now?:number
}):{authorizationUrl:string;pendingCookie:string}{
  const state=randomBytes(32).toString('base64url')
  const verifier=randomBytes(40).toString('base64url')
  const issuedAt=input.now??Date.now()
  const pending:PendingGscConsent={
    stateHash:digest(state),codeVerifier:verifier,
    ownerUserId:input.ownerUserId,ventureId:input.ventureId,issuedAt,
  }
  const params=new URLSearchParams({
    client_id:gscGoogleClientId(),redirect_uri:gscRedirectUri(),
    response_type:'code',scope:GSC_READONLY_SCOPE,
    access_type:'offline',prompt:'consent',
    include_granted_scopes:'false',state,
    code_challenge_method:'S256',code_challenge:digest(verifier),
  })
  return {
    authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth?'+params.toString(),
    pendingCookie:encryptSecret(JSON.stringify(pending)),
  }
}
export function checkPersonalGscConsent(input:{
  pendingCookie:string|undefined;state:string|undefined;
  ownerUserId:string;now?:number
}):PendingGscConsent{
  if(!input.pendingCookie||!input.state)throw new Error('PERSONAL_SEO_OAUTH_STATE_MISSING')
  let pending:PendingGscConsent
  try{pending=JSON.parse(decryptSecret(input.pendingCookie)) as PendingGscConsent}
  catch{throw new Error('PERSONAL_SEO_OAUTH_STATE_INVALID')}
  const now=input.now??Date.now()
  if(!pending||!pending.ventureId||pending.ownerUserId!==input.ownerUserId||
    !Number.isFinite(pending.issuedAt)||pending.issuedAt>now||
    now-pending.issuedAt>10*60_000 || !pending.codeVerifier||
    !equal(digest(input.state),pending.stateHash))
    throw new Error('PERSONAL_SEO_OAUTH_STATE_INVALID')
  return pending
}
export async function exchangePersonalGscCode(input:{
  code:string;codeVerifier:string;fetchImpl?:typeof fetch
}):Promise<{accessToken:string;refreshToken:string}>{
  if(!input.code||input.code.length>2048)throw new Error('PERSONAL_SEO_OAUTH_CODE_INVALID')
  const response=await (input.fetchImpl??fetch)('https://oauth2.googleapis.com/token',{
    method:'POST',redirect:'error',cache:'no-store',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      client_id:gscGoogleClientId(),client_secret:gscGoogleClientSecret(),
      redirect_uri:gscRedirectUri(),code:input.code,
      code_verifier:input.codeVerifier,grant_type:'authorization_code',
    }),
  })
  if(!response.ok)throw new Error('PERSONAL_SEO_OAUTH_EXCHANGE_FAILED')
  const token=await response.json() as Record<string,unknown>
  if(typeof token.access_token!=='string'||typeof token.refresh_token!=='string'||
    typeof token.scope!=='string'||!token.scope.split(/\s+/).includes(GSC_READONLY_SCOPE))
    throw new Error('PERSONAL_SEO_OAUTH_READONLY_GRANT_MISSING')
  return {accessToken:token.access_token,refreshToken:token.refresh_token}
}
export function encodePersonalGscGrant(grant:BrowserGscGrant):string{
  return encryptSecret(JSON.stringify(grant))
}
export function readPersonalGscGrant(input:{
  cookie:string|undefined;ownerUserId:string;ventureId:string;now?:number
}):BrowserGscGrant|null{
  if(!input.cookie)return null
  try{
    const data=JSON.parse(decryptSecret(input.cookie)) as BrowserGscGrant
    const now=input.now??Date.now()
    if(!data?.refreshToken||data.ownerUserId!==input.ownerUserId||
      data.ventureId!==input.ventureId||!Number.isFinite(data.createdAt)||
      now<data.createdAt||now-data.createdAt>30*86400_000)return null
    return data
  }catch{return null}
}

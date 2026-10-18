import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import {
  GSC_READONLY_SCOPE,createPersonalGscConsent,checkPersonalGscConsent,
  exchangePersonalGscCode,encodePersonalGscGrant,readPersonalGscGrant,
} from './personal-seo-google-oauth'

const owner='auth:owner-1',venture='venture:pupsonstuff'
beforeEach(()=>{
  vi.stubEnv('JHADINA_OAUTH_ENCRYPTION_KEY','not-a-real-key-used-only-for-unit-tests')
  vi.stubEnv('JHADINA_GSC_OAUTH_CLIENT_ID','test-id.apps.googleusercontent.com')
  vi.stubEnv('JHADINA_GSC_OAUTH_CLIENT_SECRET','fake-secret')
  vi.stubEnv('JHADINA_GSC_OAUTH_REDIRECT_URI','https://my-jhadina.example/api/growth/seo/oauth/callback')
})
afterEach(()=>vi.unstubAllEnvs())

describe('JH-PERSONAL-SEO.LIVE.04 — Google Search Console owner consent',()=>{
  it('requests only Google Search Console read access and strong PKCE state',()=>{
    const result=createPersonalGscConsent({ownerUserId:owner,ventureId:venture,now:1000000})
    const auth=new URL(result.authorizationUrl)
    expect(auth.origin).toBe('https://accounts.google.com')
    expect(auth.pathname).toBe('/o/oauth2/v2/auth')
    expect(auth.searchParams.get('scope')).toBe(GSC_READONLY_SCOPE)
    expect(auth.searchParams.get('code_challenge_method')).toBe('S256')
    expect(auth.searchParams.get('code_challenge')?.length).toBeGreaterThan(20)
    expect(auth.searchParams.get('access_type')).toBe('offline')
    expect(result.pendingCookie).not.toContain('venture:pupsonstuff')
    const approved=checkPersonalGscConsent({ownerUserId:owner,
      pendingCookie:result.pendingCookie,state:auth.searchParams.get('state')??undefined,now:1000500})
    expect(approved.ventureId).toBe(venture)
    expect(approved.codeVerifier.length).toBeGreaterThan(40)
    expect(result.pendingCookie).not.toContain(approved.codeVerifier)
  })
  it('blocks cross-owner consent replay, expiry and bad state',()=>{
    const result=createPersonalGscConsent({ownerUserId:owner,ventureId:venture,now:1000000})
    const state=new URL(result.authorizationUrl).searchParams.get('state')!
    const attempt={ownerUserId:owner,pendingCookie:result.pendingCookie,state,now:1000001}
    expect(()=>checkPersonalGscConsent({...attempt,ownerUserId:'other'})).toThrow('STATE_INVALID')
    expect(()=>checkPersonalGscConsent({...attempt,state:'attacker'})).toThrow('STATE_INVALID')
    expect(()=>checkPersonalGscConsent({...attempt,now:2000000})).toThrow('STATE_INVALID')
  })
  it('requires a returned refresh token and the exact readonly scope',async()=>{
    const server=(scope:string,refresh?:string)=>async (url:string, init:RequestInit)=>{
      expect(url).toBe('https://oauth2.googleapis.com/token')
      const body=new URLSearchParams(String(init.body))
      expect(body.get('code_verifier')).toBe('verifier')
      expect(body.get('grant_type')).toBe('authorization_code')
      return new Response(JSON.stringify({
        access_token:'not-secret-access',scope,refresh_token:refresh,
      }),{status:200})
    }
    const token=await exchangePersonalGscCode({
      code:'fake-code',codeVerifier:'verifier',
      fetchImpl:server(GSC_READONLY_SCOPE,'not-secret-refresh') as typeof fetch,
    })
    expect(token.refreshToken).toBe('not-secret-refresh')
    await expect(exchangePersonalGscCode({code:'fake-code',codeVerifier:'verifier',
      fetchImpl:server('https://www.googleapis.com/auth/webmasters','bad') as typeof fetch,
    })).rejects.toThrow('READONLY_GRANT_MISSING')
    await expect(exchangePersonalGscCode({code:'fake-code',codeVerifier:'verifier',
      fetchImpl:server(GSC_READONLY_SCOPE) as typeof fetch,
    })).rejects.toThrow('READONLY_GRANT_MISSING')
  })
  it('binds encrypted refresh-cookie grant to owner, venture and 30-day lease',()=>{
    const grant={refreshToken:'fake-refresh-token',ownerUserId:owner,ventureId:venture,createdAt:1000000}
    const cookie=encodePersonalGscGrant(grant)
    expect(cookie).not.toContain(grant.refreshToken)
    expect(readPersonalGscGrant({cookie,ownerUserId:owner,ventureId:venture,now:1000500}))
      .toEqual(grant)
    expect(readPersonalGscGrant({cookie,ownerUserId:'other',ventureId:venture,now:1000500}))
      .toBeNull()
    expect(readPersonalGscGrant({cookie,ownerUserId:owner,ventureId:'other',now:1000500}))
      .toBeNull()
    expect(readPersonalGscGrant({cookie,ownerUserId:owner,ventureId:venture,
      now:1000000+31*86400_000})).toBeNull()
  })
  it('rejects invalid or mismatched OAuth callback URLs',()=>{
    vi.stubEnv('JHADINA_GSC_OAUTH_REDIRECT_URI','http://localhost:3000/api/growth/seo/oauth/callback')
    expect(()=>createPersonalGscConsent({ownerUserId:owner,ventureId:venture}))
      .toThrow('OAUTH_REDIRECT_INVALID')
  })
})

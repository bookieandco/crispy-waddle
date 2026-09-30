import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetGithubOidcCacheForTests,
  getGithubOidcToken,
  githubOidcAvailable,
} from './github-oidc-token'

const originalEnv = {
  SAM_RUNTIME_OIDC_TOKEN: process.env.SAM_RUNTIME_OIDC_TOKEN,
  ACTIONS_ID_TOKEN_REQUEST_URL: process.env.ACTIONS_ID_TOKEN_REQUEST_URL,
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
}

function jwt(expSeconds:number){
  const encoded=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encoded({alg:'none',typ:'JWT'})}.${encoded({exp:expSeconds})}.signature`
}

afterEach(()=>{
  __resetGithubOidcCacheForTests()
  vi.unstubAllGlobals()
  for(const [key,value] of Object.entries(originalEnv)){
    if(value===undefined)delete process.env[key]
    else process.env[key]=value
  }
})

describe('GitHub OIDC refresh',()=>{
  it('reuses a still-fresh injected token',async()=>{
    const token=jwt(Math.floor(Date.now()/1000)+300)
    process.env.SAM_RUNTIME_OIDC_TOKEN=token
    delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL
    delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
    await expect(getGithubOidcToken('jhadina-sam-runtime','SAM_RUNTIME_OIDC_TOKEN')).resolves.toBe(token)
  })

  it('mints a replacement when the injected token is near expiry',async()=>{
    process.env.SAM_RUNTIME_OIDC_TOKEN=jwt(Math.floor(Date.now()/1000)+30)
    process.env.ACTIONS_ID_TOKEN_REQUEST_URL='https://oidc.actions.test/token?job=1'
    process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN='runner-request-token'
    const fresh=jwt(Math.floor(Date.now()/1000)+600)
    const fetchMock=vi.fn(async(input:URL|string|Request,init?:RequestInit)=>{
      const url=new URL(String(input))
      expect(url.searchParams.get('audience')).toBe('jhadina-sam-runtime')
      expect((init?.headers as Record<string,string>)?.authorization).toBe('Bearer runner-request-token')
      return new Response(JSON.stringify({value:fresh}),{
        status:200,
        headers:{'content-type':'application/json'},
      })
    })
    vi.stubGlobal('fetch',fetchMock)

    await expect(getGithubOidcToken('jhadina-sam-runtime','SAM_RUNTIME_OIDC_TOKEN')).resolves.toBe(fresh)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports OIDC availability from the Actions mint credentials',()=>{
    delete process.env.SAM_RUNTIME_OIDC_TOKEN
    process.env.ACTIONS_ID_TOKEN_REQUEST_URL='https://oidc.actions.test/token'
    process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN='runner-request-token'
    expect(githubOidcAvailable('SAM_RUNTIME_OIDC_TOKEN')).toBe(true)
  })
})

import {afterEach,describe,expect,it,vi} from 'vitest'
import {
 getPhantomSolanaProvider,connectPhantomSolana,trustedPhantomSolanaAddress,
 signPhantomOwnershipMessage,phantomBrowseUrl,disconnectPhantomSolana,
} from './phantom-wallet'

const addr='11111111111111111111111111111111'
afterEach(()=>{vi.unstubAllGlobals()})
function setup(){
 const provider={
  isPhantom:true,publicKey:{toString:()=>addr},
  connect:vi.fn(async(opts?:{onlyIfTrusted?:boolean})=>({publicKey:{toString:()=>addr}})),
  disconnect:vi.fn(async()=>{}),
  signMessage:vi.fn(async()=>({signature:new Uint8Array(64).fill(3),publicKey:{toString:()=>addr}})),
 }
 vi.stubGlobal('window',{phantom:{solana:provider},location:{href:'https://jhadina.example/money/command-center'}})
 return provider
}
describe('Phantom .08 iPhone session flow',()=>{
 it('detects injected Phantom, restores trusted address silently and never moves funds',async()=>{
  const provider=setup()
  expect(getPhantomSolanaProvider()).toBe(provider)
  expect(await trustedPhantomSolanaAddress()).toBe(addr)
  expect(provider.connect).toHaveBeenCalledWith({onlyIfTrusted:true})
  const result=await connectPhantomSolana()
  expect(result.address).toBe(addr)
  expect(result.canMoveFunds).toBe(false)
  await disconnectPhantomSolana()
  expect(provider.disconnect).toHaveBeenCalledOnce()
 })
 it('requests message signing without transaction signing, rejects account mismatch',async()=>{
  const provider=setup()
  const signed=await signPhantomOwnershipMessage('Jhadina test challenge',addr)
  expect(Buffer.from(signed,'base64')).toHaveLength(64)
  expect(provider.signMessage).toHaveBeenCalledWith(new TextEncoder().encode('Jhadina test challenge'),'utf8')
  await expect(signPhantomOwnershipMessage('message','WrongAccount')).rejects.toThrow('MONEY_PHANTOM_ACCOUNT_CHANGED')
 })
 it('does not create a fake wallet connection when Phantom is unavailable or untrusted',async()=>{
  vi.stubGlobal('window',{location:{href:'https://jhadina.example/wallet'}})
  expect(getPhantomSolanaProvider()).toBeUndefined()
  expect(await trustedPhantomSolanaAddress()).toBeUndefined()
  await expect(connectPhantomSolana()).rejects.toThrow('MONEY_PHANTOM_NOT_INSTALLED')
 })
 it('uses HTTPS Phantom in-app browser deep link and rejects localhost/private credentials',()=>{
  const deep=phantomBrowseUrl('https://jhadina.example/money/command-center')
  expect(deep).toContain('phantom.app/ul/browse/')
  expect(decodeURIComponent(deep)).toContain('https://jhadina.example/money/command-center')
  expect(()=>phantomBrowseUrl('http://localhost:3000/wallet')).toThrow('MONEY_PHANTOM_PUBLIC_HTTPS_REQUIRED')
  expect(()=>phantomBrowseUrl('https://alice:password@jhadina.example/')).toThrow('MONEY_PHANTOM_PUBLIC_HTTPS_REQUIRED')
 })
})

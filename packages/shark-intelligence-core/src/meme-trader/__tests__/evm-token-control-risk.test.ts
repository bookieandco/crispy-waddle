import {describe,expect,it} from 'vitest'
import {assessEvmTokenControl} from '../evm-token-control-risk'
describe('EVM token control risk',()=>{
 it('flags owner-controlled mint authority as evidence, not execution authority',()=>{
  const r=assessEvmTokenControl({evidenceId:'e1',chainId:'4663',tokenAddress:'0x1111111111111111111111111111111111111111',ownerAddress:'0x2222222222222222222222222222222222222222',totalSupplyRaw:'1000000',decimals:18,mintFunctionPresent:'YES',mintAuthorityModel:'OWNER_ONLY',source:'rpc+verified-abi',observedAt:'2026-09-21T20:00:00Z',availableAt:'2026-09-21T20:00:01Z'})
  expect(r.ownerControlledMint).toBe('YES');expect(r.riskFlags).toContain('OWNER_CONTROLLED_MINT');expect(r.canAuthorizeTrade).toBe(false)
 })
 it('recognizes renounced owner without inventing mint risk',()=>{
  const r=assessEvmTokenControl({evidenceId:'e2',chainId:'eip155:4663',tokenAddress:'0x1111111111111111111111111111111111111111',ownerAddress:'0x0000000000000000000000000000000000000000',mintFunctionPresent:'NO',mintAuthorityModel:'NONE',source:'rpc',observedAt:'2026-09-21T20:00:00Z',availableAt:'2026-09-21T20:00:00Z'})
  expect(r.ownerRenounced).toBe('YES');expect(r.ownerControlledMint).toBe('NO')
 })
})
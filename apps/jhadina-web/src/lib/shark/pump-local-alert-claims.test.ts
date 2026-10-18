import {describe,expect,it} from 'vitest'
import {mkdtemp,chmod,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createPumpLocalAlertClaims} from './pump-local-alert-claims'
const key='shark-graduation:3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump:IMMINENT_CURVE'
describe('owner-private durable research alert claims',()=>{
 it('claims atomically and suppresses duplicate attempts across instances',async()=>{
  const d=await mkdtemp(join(tmpdir(),'shark-alpha-claims-'))
  await chmod(d,0o700)
  try{
    const a=createPumpLocalAlertClaims(d),b=createPumpLocalAlertClaims(d)
    expect(await a(key)).toBe('CLAIMED')
    expect(await b(key)).toBe('ALREADY_CLAIMED')
    expect(await a('untrusted key')).toBe('UNAVAILABLE')
  }finally{await rm(d,{recursive:true,force:true})}
 })
 it('rejects a directory with group/world access or a relative path',async()=>{
  expect(()=>createPumpLocalAlertClaims('relative')).toThrow('absolute_required')
  const d=await mkdtemp(join(tmpdir(),'shark-alpha-claims-'))
  await chmod(d,0o755)
  try{expect(await createPumpLocalAlertClaims(d)(key)).toBe('UNAVAILABLE')}
  finally{await rm(d,{recursive:true,force:true})}
 })
})

import { describe, expect, it, vi } from 'vitest'
import { ActionExecutor, InMemoryActionLedger, type ActionPolicy } from '@jhadina/action-core'
import { createDirectorStudioAction, createDirectorStudioHandler, executeGovernedDirectorStudioAction } from './studio-governed-action'

describe('governed Director Studio bridge', () => {
  const request=()=>createDirectorStudioAction({id:'a1',userId:'u1',requestedAt:'2026-09-18T00:00:00Z',projectId:'p1',capability:'tracking',inputAssetIds:['video']})

  it('does not reach a provider when policy denies the action', async () => {
    const execute=vi.fn()
    const policy: ActionPolicy= { evaluate: async ()=>'deny' }
    const executor=new ActionExecutor(policy,new InMemoryActionLedger(),[createDirectorStudioHandler([{supports:()=>true,execute}])])
    await expect(executeGovernedDirectorStudioAction(executor as any,request())).rejects.toThrow('Action denied')
    expect(execute).not.toHaveBeenCalled()
  })

  it('does not reach a provider when approval is required but absent', async () => {
    const execute=vi.fn()
    const policy: ActionPolicy= { evaluate: async ()=>'approval_required' }
    const executor=new ActionExecutor(policy,new InMemoryActionLedger(),[createDirectorStudioHandler([{supports:()=>true,execute}])])
    await expect(executeGovernedDirectorStudioAction(executor as any,request())).rejects.toThrow('Approval required')
    expect(execute).not.toHaveBeenCalled()
  })

  it('marks every generated Studio result as requiring asset approval', async () => {
    const policy: ActionPolicy= { evaluate: async ()=>'allow' }
    const provider={supports:(c:string)=>c==='tracking',execute:vi.fn(async()=>({capability:'tracking' as const,projectId:'p1',outputAssetIds:['track'],evidenceIds:['ev1']}))}
    const executor=new ActionExecutor(policy,new InMemoryActionLedger(),[createDirectorStudioHandler([provider])])
    const result=await executeGovernedDirectorStudioAction(executor as any,request())
    expect(result.requiresAssetApproval).toBe(true)
    expect(provider.execute).toHaveBeenCalledOnce()
  })

  it('fails closed when request type does not match the capability', async () => {
    const handler=createDirectorStudioHandler([{supports:()=>true,execute:vi.fn()}])
    const bad={...request(),type:'director.studio.render'}
    await expect(handler.execute(bad.action,bad)).rejects.toThrow('mismatch')
  })
})

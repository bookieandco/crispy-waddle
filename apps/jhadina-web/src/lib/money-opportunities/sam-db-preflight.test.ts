import {describe,expect,it} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {assertSamPrewriteDbReady} from './sam-db-preflight'

function fake(response:unknown,fail=false){
  const operations:string[]=[]
  const client={
    from(table:string){
      operations.push('from:'+table)
      return {
        select(columns:string,options:Record<string,unknown>){
          operations.push('select:'+columns+':head='+String(options.head))
          return {
            limit(n:number){
              operations.push('limit:'+n)
              return fail?Promise.reject(new Error('57P03')):Promise.resolve(response)
            },
          }
        },
      }
    },
  } as unknown as SupabaseClient
  return {client,operations}
}

describe('SWLC/SAM pre-write Postgres admission',()=>{
  it('allows only a valid successful read-only SQL response',async()=>{
    const {client,operations}=fake({data:null,error:null,status:200})
    await expect(assertSamPrewriteDbReady(client)).resolves.toBeUndefined()
    expect(operations).toEqual([
      'from:jhadina_sam_scan_runs',
      'select:id:head=true',
      'limit:1',
    ])
  })
  it.each([
    {data:null,error:{code:'57P03',message:'Postgres unavailable'},status:503},
    {data:null,error:{message:'schema unavailable'},status:200},
    {data:null,error:null,status:503},
    {data:null,error:null,status:401},
    {data:null,error:null},
    null,
    undefined,
  ])('rejects errors, missing transport proof and unavailable DB',async(response)=>{
    const {client,operations}=fake(response)
    await expect(assertSamPrewriteDbReady(client)).rejects.toThrow('SAM_PREWRITE_DB_NOT_READY')
    expect(operations).toContain('select:id:head=true')
  })
  it('rejects thrown connection errors before any reconciliation',async()=>{
    const {client}=fake(null,true)
    await expect(assertSamPrewriteDbReady(client)).rejects.toThrow('SAM_PREWRITE_DB_NOT_READY')
  })
})

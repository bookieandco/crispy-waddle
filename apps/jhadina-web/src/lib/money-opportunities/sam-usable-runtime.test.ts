import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAllSamCertRows } from './sam-usable-runtime'

type Row=Record<string,unknown>
function mockClient(source:Row[], options:{failed?:boolean}={}):SupabaseClient{
  return {
    from:()=>({
      select:()=>{
        let column='id',limit=1000,cursor:string|number|undefined
        const query={
          order(key:string){column=key;return query},
          limit(n:number){limit=n;return query},
          gt(_key:string,value:string|number){cursor=value;return query},
          then(resolve:(result:unknown)=>unknown,reject?:(reason:unknown)=>unknown){
            const batch=source.filter(row=>cursor===undefined||Number(row[column])>Number(cursor))
              .sort((a,b)=>Number(a[column])-Number(b[column]))
              .slice(0,limit)
            return Promise.resolve(options.failed
              ?{data:null,error:{message:'connection unavailable'}}
              :{data:batch,error:null}).then(resolve,reject)
          },
        }
        return query
      },
    }),
  } as unknown as SupabaseClient
}

describe('SAM-CERT-HARDEN.02 complete keyset audit',()=>{
  it('reads every page without quietly truncating the first 250 rows',async()=>{
    const data=Array.from({length:555},(_,i)=>({id:i+1,notice_id:`notice-${i+1}`}))
    const rows=await loadAllSamCertRows(mockClient(data),'jhadina_sam_documents','id,notice_id','id')
    expect(rows).toHaveLength(555)
    expect(rows.at(-1)?.id).toBe(555)
  })
  it('rejects invalid keys and read failures',async()=>{
    await expect(loadAllSamCertRows(mockClient([{id:null}]),'table','id','id')).rejects.toThrow('SAM_CERT_INVALID_CURSOR')
    await expect(loadAllSamCertRows(mockClient([],{failed:true}),'table','id','id')).rejects.toThrow('SAM_CERT_READ_FAILED')
  })
  it('refuses certification when more than the bounded full scan is needed',async()=>{
    const data=Array.from({length:10_001},(_,i)=>({id:i+1}))
    await expect(loadAllSamCertRows(mockClient(data),'table','id','id')).rejects.toThrow('SAM_CERT_AUDIT_TOO_LARGE')
  })
})

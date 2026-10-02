import { describe,expect,it } from 'vitest'
import { matchUsacBuyer,USAC_PUBLIC_DATASETS } from './public-usac-vertical-runtime'

const school=(id:string,name:string,state='KS')=>({
  id,
  level:'school_district' as const,
  state_code:state as any,
  name,
  normalized_name:name,
  source_payload:null,
})

const hospital=(id:string,name:string,state='AL')=>({
  id,
  level:'public_hospital' as const,
  state_code:state as any,
  name,
  normalized_name:name,
  source_payload:null,
})

describe('USAC public vertical matching',()=>{
  it('keeps canonical USAC dataset IDs stable',()=>{
    expect(USAC_PUBLIC_DATASETS.erate470Basic).toBe('jp7a-89nd')
    expect(USAC_PUBLIC_DATASETS.erate470Services).toBe('39tn-hjzv')
    expect(USAC_PUBLIC_DATASETS.rhcPostedServices).toBe('96rf-xd57')
    expect(USAC_PUBLIC_DATASETS.rhcCommitments).toBe('2kme-evqq')
  })

  it('matches school district naming variants without losing district numbers',()=>{
    const result=matchUsacBuyer({
      name:'Galena Unified Schools #499',
      state:'KS',
      level:'school_district',
    },[
      school('district:499','Galena Unified School District 499'),
      school('district:500','Other Unified School District 500'),
    ])
    expect(result?.jurisdiction.id).toBe('district:499')
    expect(result?.score).toBeGreaterThanOrEqual(0.9)
  })

  it('matches government hospital case and generic suffix variants',()=>{
    const result=matchUsacBuyer({
      name:'Southeast Health Medical Center',
      state:'AL',
      level:'public_hospital',
    },[
      hospital('hospital:1','SOUTHEAST HEALTH MEDICAL CENTER'),
      hospital('hospital:2','DALE MEDICAL CENTER'),
    ])
    expect(result?.jurisdiction.id).toBe('hospital:1')
    expect(result?.method).toBe('exact')
  })

  it('refuses ambiguous school-name matches in the same state',()=>{
    const result=matchUsacBuyer({
      name:'Springfield Public Schools',
      state:'MO',
      level:'school_district',
    },[
      school('district:a','Springfield School District','MO'),
      school('district:b','Springfield Public School District','MO'),
    ])
    expect(result).toBeUndefined()
  })
})

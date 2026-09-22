import { afterEach,describe,expect,it,vi } from 'vitest'
import {
  fmcsaCargoIntent,
  parseFmcsaProviders,
  parseFsisProviders,
  searchFmcsaProviders,
  shouldSearchFsis,
} from './us-food-logistics-provider-sources'

afterEach(()=>{
  vi.unstubAllGlobals()
  delete process.env.FMCSA_APP_TOKEN
})

describe('U.S. food/logistics provider sources',()=>{
  it('normalizes active U.S. refrigerated carriers from FMCSA census evidence',()=>{
    const intent=fmcsaCargoIntent(['refrigerated food delivery'])
    const providers=parseFmcsaProviders([{
      dot_number:'1234567',status_code:'A',legal_name:'COLD FREIGHT LLC',dba_name:'Cold Freight',
      phy_country:'US',phy_state:'CA',phy_city:'Riverside',phone:'9515550100',email_address:'dispatch@example.com',
      power_units:'22',truck_units:'18',total_drivers:'30',fleetsize:'C',carrier_operation:'A',carship:'C',
      crgo_coldfood:'X',crgo_meat:'X',crgo_genfreight:'X',
    }],intent,10)
    expect(providers).toHaveLength(1)
    expect(providers[0].country).toBe('US')
    expect(providers[0].legalName).toBe('COLD FREIGHT LLC')
    expect(providers[0].evidence[0].source).toBe('fmcsa_carrier')
    expect(providers[0].evidence[0].details?.usdot).toBe('1234567')
    expect(providers[0].evidence[0].details?.safetyInterpretation).toBe('informational_only')
  })

  it('queries the official FMCSA dataset with capability flags and optional app token',async()=>{
    process.env.FMCSA_APP_TOKEN='token'
    let requested=''
    let header=''
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      requested=String(input)
      header=String((init?.headers as Record<string,string>)?.['X-App-Token']??'')
      return new Response(JSON.stringify([{dot_number:'1',status_code:'A',legal_name:'Carrier',phy_country:'US',crgo_coldfood:'X'}]),{status:200})
    }))
    const providers=await searchFmcsaProviders({keywords:['cold chain logistics'],limit:5})
    expect(requested).toContain('az4n-8mr2')
    expect(decodeURIComponent(requested)).toContain("status_code='A'")
    expect(decodeURIComponent(requested)).toContain("crgo_coldfood='X'")
    expect(header).toBe('token')
    expect(providers).toHaveLength(1)
  })

  it('normalizes federally inspected FSIS food establishments with demographic evidence',()=>{
    const directory=[
      'EstNumber,Company,Street,City,State,Zip,Phone',
      'M100 + P100,Valley Meat Foods,1 Main St,Riverside,CA,92501,9515550199',
      'P200,Poultry Plant,2 Main St,Fresno,CA,93701,5595550199',
    ].join('\n')
    const demographic=[
      'EstNumber,HACCP Size,RTE Beef,Raw Intact Beef,Chicken Processing',
      'M100 + P100,Small,Yes,Yes,No',
      'P200,Large,No,No,Yes',
    ].join('\n')
    const providers=parseFsisProviders({directoryCsv:directory,demographicCsv:demographic,keywords:['beef ready to eat'],limit:10})
    expect(providers).toHaveLength(1)
    expect(providers[0].legalName).toBe('Valley Meat Foods')
    expect(providers[0].evidence[0].source).toBe('fsis_establishment')
    expect(providers[0].evidence[0].details?.haccpSize).toBe('Small')
    expect(providers[0].evidence[0].details?.productSpecificCapability).toBe('review_required')
  })

  it('does not use FSIS for unrelated office/service requirements',()=>{
    expect(shouldSearchFsis(['office furniture installation'])).toBe(false)
    const providers=parseFsisProviders({directoryCsv:['EstNumber,Company','M1,Food Co'].join('\n'),keywords:['office furniture']})
    expect(providers).toEqual([])
  })
})

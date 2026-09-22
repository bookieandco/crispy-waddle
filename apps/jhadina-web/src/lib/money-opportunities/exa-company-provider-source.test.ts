import { afterEach,describe,expect,it,vi } from 'vitest'
import { parseExaCompanyProviders,searchExaCompanyProviders } from './exa-company-provider-source'

afterEach(()=>{
  vi.unstubAllGlobals()
  delete process.env.EXA_API_KEY
})

describe('Exa company provider discovery',()=>{
  it('normalizes web results without inventing U.S. domicile or NAICS verification',()=>{
    const providers=parseExaCompanyProviders({
      results:[{
        id:'r1',
        url:'https://acme-industrial.example/',
        title:'Acme Industrial LLC | Material Handling Systems',
        highlights:['Acme supplies conveyor and warehouse automation systems throughout North America.'],
      }],
    },'US material handling supplier',10)
    expect(providers).toHaveLength(1)
    expect(providers[0].legalName).toBe('Acme Industrial LLC')
    expect(providers[0].country).toBeUndefined()
    expect(providers[0].naicsCodes).toEqual([])
    expect(providers[0].evidence[0].source).toBe('web_search')
    expect(providers[0].evidence[0].details?.countryVerified).toBe(false)
    expect(providers[0].evidence[0].details?.identityVerified).toBe(false)
  })

  it('returns no discovery rows when EXA_API_KEY is not configured',async()=>{
    const fetchMock=vi.fn()
    vi.stubGlobal('fetch',fetchMock)
    expect(await searchExaCompanyProviders({keywords:['industrial pumps']})).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the current Exa search request shape when configured for the U.S.',async()=>{
    process.env.EXA_API_KEY='secret'
    let requested=''
    let requestBody:Record<string,unknown>={}
    let apiKey=''
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      requested=String(input)
      requestBody=JSON.parse(String(init?.body??'{}')) as Record<string,unknown>
      apiKey=String((init?.headers as Record<string,string>)?.['x-api-key']??'')
      return new Response(JSON.stringify({
        results:[{
          id:'r2',url:'https://pumpco.example',title:'PumpCo',
          highlights:['Industrial pump repair and distribution.'],
        }],
      }),{status:200,headers:{'content-type':'application/json'}})
    }))
    const providers=await searchExaCompanyProviders({
      keywords:['industrial pump repair'],
      naicsCodes:['811310'],
      geography:'California',
      limit:5,
    })
    expect(requested).toBe('https://api.exa.ai/search')
    expect(apiKey).toBe('secret')
    expect(requestBody.type).toBe('auto')
    expect(requestBody.numResults).toBe(5)
    expect(String(requestBody.query)).toContain('California')
    expect(String(requestBody.query)).toContain('811310')
    expect(requestBody.contents).toEqual({highlights:true})
    expect(providers[0].evidence[0].source).toBe('web_search')
    expect(providers[0].evidence[0].details?.targetCountry).toBe('US')
  })

  it('targets Mexico without pretending U.S. NAICS verifies a Mexican company',async()=>{
    process.env.EXA_API_KEY='secret'
    let requestBody:Record<string,unknown>={}
    vi.stubGlobal('fetch',vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
      requestBody=JSON.parse(String(init?.body??'{}')) as Record<string,unknown>
      return new Response(JSON.stringify({
        results:[{
          id:'mx1',url:'https://frio.example.mx',title:'Frio Logistica SA de CV',
          highlights:['Almacenamiento refrigerado y distribución de alimentos en México.'],
        }],
      }),{status:200,headers:{'content-type':'application/json'}})
    }))
    const providers=await searchExaCompanyProviders({
      keywords:['cold storage food'],
      naicsCodes:['493120'],
      targetCountry:'MEX',
      limit:5,
    })
    expect(String(requestBody.query)).toContain('Mexico')
    expect(String(requestBody.query)).not.toContain('NAICS 493120')
    expect(providers[0].country).toBeUndefined()
    expect(providers[0].evidence[0].details?.targetCountry).toBe('MEX')
    expect(providers[0].evidence[0].details?.countryVerified).toBe(false)
  })

  it('targets Canada and may use NAICS search language without asserting domicile',async()=>{
    process.env.EXA_API_KEY='secret'
    let requestBody:Record<string,unknown>={}
    vi.stubGlobal('fetch',vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
      requestBody=JSON.parse(String(init?.body??'{}')) as Record<string,unknown>
      return new Response(JSON.stringify({
        results:[{
          id:'ca1',url:'https://maple.example.ca',title:'Maple Cold Storage Ltd',
          highlights:['Canadian cold-storage and food distribution provider.'],
        }],
      }),{status:200,headers:{'content-type':'application/json'}})
    }))
    const providers=await searchExaCompanyProviders({
      keywords:['cold storage food'],
      naicsCodes:['493120'],
      targetCountry:'CAN',
      limit:5,
    })
    expect(String(requestBody.query)).toContain('Canada')
    expect(String(requestBody.query)).toContain('NAICS 493120')
    expect(providers[0].country).toBeUndefined()
    expect(providers[0].evidence[0].details?.targetCountry).toBe('CAN')
  })
})

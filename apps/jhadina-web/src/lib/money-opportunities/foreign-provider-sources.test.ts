import { afterEach,describe,expect,it,vi } from 'vitest'
import {
  matchCanadaHs6Descriptions,
  parseCanadaImporterProductReport,
  parseCanadaImporterProviders,
  parseDenueProviders,
  searchCanadaImporterProviders,
  searchCanadaOdbusCsv,
  searchDenueProviders,
} from './foreign-provider-sources'

afterEach(()=>{
  vi.unstubAllGlobals()
  delete process.env.INEGI_DENUE_TOKEN
  delete process.env.CANADA_CID_HS6_DESCRIPTION_URL
  delete process.env.CANADA_CID_IMPORTERS_HS6_URL
  delete process.env.CANADA_CID_LIVE_HS6_LIMIT
})

describe('foreign provider source adapters',()=>{
  it('normalizes DENUE businesses as Mexico review evidence',()=>{
    const providers=parseDenueProviders([{
      Id:'123',CLEE:'CLEE-1',Nombre:'FRIO LOGISTICA',
      Razon_social:'FRIO LOGISTICA SA DE CV',
      Clase_actividad:'Servicios de almacenamiento con refrigeración',
      Estrato:'31 a 50 personas',
      Ubicacion:'MONTERREY, NUEVO LEON',
      Telefono:'5551234',Correo_e:'ventas@example.mx',Sitio_internet:'https://example.mx',
      Latitud:'25.68',Longitud:'-100.31',
    }],['cold storage','food'])
    expect(providers).toHaveLength(1)
    expect(providers[0].country).toBe('MEX')
    expect(providers[0].legalName).toContain('FRIO LOGISTICA')
    expect(providers[0].naicsCodes).toEqual([])
    expect(providers[0].evidence[0].source).toBe('denue')
    expect(providers[0].evidence[0].details?.naicsCompatibility).toBe('review_required')
  })

  it('uses nationwide DENUE BuscarEntidad and never exposes the token in evidence',async()=>{
    process.env.INEGI_DENUE_TOKEN='secret-token'
    let requested=''
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      requested=String(input)
      return new Response(JSON.stringify([{Id:'1',Nombre:'ALIMENTOS MX',Clase_actividad:'Comercio de alimentos'}]),{status:200})
    }))
    const providers=await searchDenueProviders({keywords:['food supplier'],limit:10})
    expect(requested).toContain('/BuscarEntidad/')
    expect(requested).toContain('/00/1/10/')
    expect(requested).toContain('secret-token')
    expect(providers[0].evidence[0].url).not.toContain('secret-token')
  })

  it('matches Canadian HS6 descriptions then produces importer evidence',()=>{
    const descriptions=`HS6,Description
040610,Fresh cheese and curd
870421,Motor vehicles for transport of goods
`
    const importers=`HS6,Importer Name,City,Province
040610,Maple Foods Inc,Toronto,Ontario
870421,Truck Co,Windsor,Ontario
`
    const matches=matchCanadaHs6Descriptions(descriptions,['fresh cheese food'],5)
    expect(matches[0].hs6).toBe('040610')
    const providers=parseCanadaImporterProviders(importers,matches,10)
    expect(providers).toHaveLength(1)
    expect(providers[0].country).toBe('CAN')
    expect(providers[0].legalName).toBe('Maple Foods Inc')
    expect(providers[0].evidence[0].source).toBe('canada_importer')
    expect(providers[0].evidence[0].details?.datasetYear).toBe(2022)
  })


  it('parses current ISED product reports with the published importer year',()=>{
    const html=`
      <h2>Market concentration & Major Canadian importers</h2>
      <div>Major Canadian importers in 2024</div>
      <table>
        <tr><th>Company name</th><th>City</th><th>Province</th><th>Postal code</th></tr>
        <tr><td>MAPLE FOODS INC</td><td>Toronto</td><td>Ontario</td><td>M1A 1A1</td></tr>
      </table>
    `
    const providers=parseCanadaImporterProductReport(html,{hs6:'040610',description:'Fresh cheese and curd'},10)
    expect(providers).toHaveLength(1)
    expect(providers[0].legalName).toBe('MAPLE FOODS INC')
    expect(providers[0].country).toBe('CAN')
    expect(providers[0].evidence[0].details?.datasetYear).toBe(2024)
    expect(providers[0].evidence[0].details?.evidenceRole).toBe('current_product_importer_report')
  })

  it('prefers the current ISED product report before the historical bulk fallback',async()=>{
    process.env.CANADA_CID_HS6_DESCRIPTION_URL='https://example.test/descriptions.csv'
    process.env.CANADA_CID_IMPORTERS_HS6_URL='https://example.test/fallback.csv'
    process.env.CANADA_CID_LIVE_HS6_LIMIT='1'
    const requested:string[]=[]
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);requested.push(url)
      if(url.includes('descriptions.csv')){
        return new Response('HS6,Description\n040610,Fresh cheese and curd\n',{status:200})
      }
      if(url.includes('productReport.html')){
        return new Response(`
          <div>Major Canadian importers in 2024</div>
          <table><tr><th>Company</th><th>City</th><th>Province</th><th>Postal code</th></tr>
          <tr><td>LIVE MAPLE FOODS</td><td>Toronto</td><td>Ontario</td><td>M1A 1A1</td></tr></table>
        `,{status:200})
      }
      throw new Error('historical fallback should not be requested when live data exists')
    }))
    const providers=await searchCanadaImporterProviders({keywords:['fresh cheese food'],limit:10})
    expect(providers[0].legalName).toBe('LIVE MAPLE FOODS')
    expect(providers[0].evidence[0].details?.datasetYear).toBe(2024)
    expect(requested.some(url=>url.includes('fallback.csv'))).toBe(false)
  })

  it('searches a cached Statistics Canada ODBus CSV without claiming complete coverage',()=>{
    const csv=`Name,Business Sector,NAICS Code,Status,Province,Municipality
Polar Cold Storage,Warehousing and storage,493120,Active,Ontario,Toronto
Design Shop,Graphic design,541430,Active,Quebec,Montreal
`
    const providers=searchCanadaOdbusCsv({csv,keywords:['cold storage'],naicsCodes:['493120'],limit:10})
    expect(providers).toHaveLength(1)
    expect(providers[0].country).toBe('CAN')
    expect(providers[0].naicsCodes).toEqual(['493120'])
    expect(providers[0].evidence[0].source).toBe('canada_odbusiness')
    expect(String(providers[0].evidence[0].details?.coverageNote)).toContain('not the complete')
  })
})

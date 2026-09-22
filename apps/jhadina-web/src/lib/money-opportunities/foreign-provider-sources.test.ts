import { afterEach,describe,expect,it,vi } from 'vitest'
import {
  matchCanadaHs6Descriptions,
  parseCanadaImporterProviders,
  parseDenueProviders,
  searchCanadaOdbusCsv,
  searchDenueProviders,
} from './foreign-provider-sources'

afterEach(()=>{
  vi.unstubAllGlobals()
  delete process.env.INEGI_DENUE_TOKEN
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
    const descriptions='HS6,Description\\n040610,Fresh cheese and curd\\n870421,Motor vehicles for transport of goods\\n'
    const importers='HS6,Importer Name,City,Province\\n040610,Maple Foods Inc,Toronto,Ontario\\n870421,Truck Co,Windsor,Ontario\\n'
    const matches=matchCanadaHs6Descriptions(descriptions,['fresh cheese food'],5)
    expect(matches[0].hs6).toBe('040610')
    const providers=parseCanadaImporterProviders(importers,matches,10)
    expect(providers).toHaveLength(1)
    expect(providers[0].country).toBe('CAN')
    expect(providers[0].legalName).toBe('Maple Foods Inc')
    expect(providers[0].evidence[0].source).toBe('canada_importer')
    expect(providers[0].evidence[0].details?.datasetYear).toBe(2022)
  })

  it('searches a cached Statistics Canada ODBus CSV without claiming complete coverage',()=>{
    const csv='Name,Business Sector,NAICS Code,Status,Province,Municipality\\nPolar Cold Storage,Warehousing and storage,493120,Active,Ontario,Toronto\\nDesign Shop,Graphic design,541430,Active,Quebec,Montreal\\n'
    const providers=searchCanadaOdbusCsv({csv,keywords:['cold storage'],naicsCodes:['493120'],limit:10})
    expect(providers).toHaveLength(1)
    expect(providers[0].country).toBe('CAN')
    expect(providers[0].naicsCodes).toEqual(['493120'])
    expect(providers[0].evidence[0].source).toBe('canada_odbusiness')
    expect(String(providers[0].evidence[0].details?.coverageNote)).toContain('not the complete')
  })
})

import { describe,expect,it } from 'vitest'
import { parseExaCompanyProviders } from './exa-company-provider-source'
import { parseDenueProviders } from './foreign-provider-sources'
import { mergeProviderPools } from './sam-provider-runtime'

describe('cross-border provider corroboration',()=>{
  it('merges a DENUE legal entity with a web result only when the company website domain matches',()=>{
    const denue=parseDenueProviders([{
      Id:'123',
      Nombre:'FRIO LOGISTICA',
      Razon_social:'FRIO LOGISTICA SA DE CV',
      Clase_actividad:'Servicios de almacenamiento con refrigeración',
      Sitio_internet:'www.frio-logistica.mx',
      Ubicacion:'MONTERREY, NUEVO LEON',
    }],['cold storage'])
    const web=parseExaCompanyProviders({
      results:[{
        id:'web1',
        url:'https://frio-logistica.mx/capabilities',
        title:'Frío Logistics | Cold Chain Mexico',
        highlights:['Cold-chain warehousing and food distribution in Mexico.'],
      }],
    },'Mexico cold storage supplier',10,'MEX')

    const merged=mergeProviderPools(denue as any,web as any)
    expect(merged).toHaveLength(1)
    expect(merged[0].country).toBe('MEX')
    expect(new Set(merged[0].evidence.map(item=>item.source))).toEqual(new Set(['denue','web_search']))
  })

  it('does not merge unrelated businesses merely because both were targeted at Mexico',()=>{
    const denue=parseDenueProviders([{
      Id:'1',Nombre:'ALIMENTOS UNO',Razon_social:'ALIMENTOS UNO SA DE CV',
      Clase_actividad:'Comercio de alimentos',Sitio_internet:'alimentos-uno.mx',
    }],['food'])
    const web=parseExaCompanyProviders({
      results:[{
        id:'web2',url:'https://otro-proveedor.mx',title:'Otro Proveedor SA de CV',
        highlights:['Food distribution in Mexico.'],
      }],
    },'Mexico food supplier',10,'MEX')

    expect(mergeProviderPools(denue as any,web as any)).toHaveLength(2)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifySamDocumentLink, readBoundedSamDocument } from './sam-document-resource'
import { harvestSamDocuments } from './sam-wide-runtime'
import type { SupabaseClient } from '@supabase/supabase-js'

const file='https://sam.gov/api/prod/opps/v3/opportunities/resources/files/fixture/download'
const lookup='https://api.sam.gov/prod/opportunities/v2/search?noticeid=fixture&limit=1'
function catalog(rows:Record<string,unknown>[],onWrite?:(row:Record<string,unknown>)=>string|undefined){
  const writes:Record<string,unknown>[]=[]
  const client={
    from:(table:string)=>({
      select:()=>({in:async()=>({data:rows,error:null})}),
      upsert:async(row:Record<string,unknown>)=>{
        expect(table).toBe('jhadina_sam_documents')
        const error=onWrite?.(row)
        if(error)return {error:{message:error}}
        writes.push(row)
        return {error:null}
      },
    }),
  } as unknown as SupabaseClient
  return {client,writes}
}
afterEach(()=>{vi.unstubAllGlobals()})

describe('SAM governed solicitation resources',()=>{
  it('distinguishes actual SAM file download from API search metadata',()=>{
    expect(classifySamDocumentLink(file)).toBe('file')
    expect(classifySamDocumentLink(lookup)).toBe('reference')
    expect(classifySamDocumentLink('https://sam.gov/opp/fixture/view')).toBe('reference')
    expect(classifySamDocumentLink('https://army.mil/contracts/statement.pdf')).toBe('file')
    expect(classifySamDocumentLink('http://sam.gov/download.pdf')).toBe('blocked')
    expect(classifySamDocumentLink('https://sam.gov.evil.example/doc.pdf')).toBe('blocked')
  })
  it('rejects declared files larger than 10MB before buffering',async()=>{
    const response=new Response('tiny',{headers:{'content-length':'10000001'}})
    await expect(readBoundedSamDocument(response,{url:file}))
      .rejects.toThrow('RESOURCE_TOO_LARGE')
  })
  it('enforces byte size even when Content-Length is missing or understated',async()=>{
    const res=new Response(new Uint8Array(110),{headers:{'content-length':'1'}})
    await expect(readBoundedSamDocument(res,{url:file,maxBytes:100}))
      .rejects.toThrow('RESOURCE_TOO_LARGE')
  })
  it('rejects HTML access/login pages masquerading as binary attachments',async()=>{
    const response=new Response('<!DOCTYPE html><html><body>Sign in</body></html>',{
      headers:{'content-type':'application/octet-stream'},
    })
    await expect(readBoundedSamDocument(response,{url:file}))
      .rejects.toThrow('RESOURCE_UNEXPECTED_HTML')
  })
  it('skips API reference URLs rather than calling them attachment errors',async()=>{
    const {client,writes}=catalog([{
      notice_id:'N1',description:lookup,source_url:'https://sam.gov/opp/N1/view',
      resource_links:[lookup],
    }])
    const fetchMock=vi.fn()
    vi.stubGlobal('fetch',fetchMock)
    const result=await harvestSamDocuments(client,['N1'])
    expect(result.attempted).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.referencesSkipped).toBe(2)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(writes).toHaveLength(0)
  })
  it('extracts extensionless octet-stream PDF with preserved checksum and source',async()=>{
    const pdf=['%PDF-1.7','BT',
      '(Statement of Work requires delivery of tested supplies, quality records, monthly reporting, and contract-period support.) Tj',
      'ET','%%EOF'].join('\n')
    const {client,writes}=catalog([{notice_id:'N1',description:'',source_url:'https://sam.gov/opp/N1/view',resource_links:[file]}])
    const fetchMock=vi.fn(async(_url:unknown,opts:RequestInit)=>{
      expect(opts.redirect).toBe('manual')
      return new Response(pdf,{headers:{'content-type':'application/octet-stream'}})
    })
    vi.stubGlobal('fetch',fetchMock)
    const result=await harvestSamDocuments(client,['N1'])
    expect(result.textCaptured).toBe(1)
    expect(result.failed).toBe(0)
    expect(writes).toHaveLength(1)
    expect(writes[0].source_kind).toBe('attachment')
    expect(writes[0].fetch_status).toBe('text_captured')
    expect(writes[0].checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(String(writes[0].extracted_text)).toContain('Statement of Work')
  })
  it('does not follow a redirect that might expose credentials',async()=>{
    const {client,writes}=catalog([{notice_id:'N1',description:'',source_url:'https://sam.gov/opp/N1/view',resource_links:[file]}])
    const fetchMock=vi.fn(async()=>new Response(null,{status:302,headers:{location:'https://example.org/steal'}}))
    vi.stubGlobal('fetch',fetchMock)
    const result=await harvestSamDocuments(client,['N1'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.failed).toBe(1)
    expect(writes[0].fetch_status).toBe('fetch_failed')
    expect((writes[0].evidence as Record<string,unknown>).error).toBe('RESOURCE_REDIRECT_NOT_ALLOWED')
  })
  it('flags unrecognized binary rather than fabricating parsed requirements',async()=>{
    const {client,writes}=catalog([{notice_id:'N1',description:'',source_url:'https://sam.gov/opp/N1/view',resource_links:[file]}])
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Uint8Array([0,1,2,3]),{
      headers:{'content-type':'application/octet-stream'},
    })))
    const result=await harvestSamDocuments(client,['N1'])
    expect(result.binaryCaptured).toBe(1)
    expect(result.unsupported).toBe(1)
    expect(writes[0].fetch_status).toBe('binary_captured')
    expect(writes[0].extracted_text).toBeNull()
  })
  it('propagates document persistence errors without reporting a capture',async()=>{
    const {client}=catalog([{notice_id:'N1',description:'valid notice content',source_url:'https://sam.gov/opp/N1/view',resource_links:[]}],()=> 'PostgREST unavailable')
    await expect(harvestSamDocuments(client,['N1']))
      .rejects.toThrow('SAM_DOCUMENT_PERSIST_FAILED:PostgREST unavailable')
  })
  it('deduplicates repeated file references per notice',async()=>{
    const {client,writes}=catalog([{notice_id:'N1',description:'',source_url:'https://sam.gov/opp/N1/view',resource_links:[file,file]}])
    const f=vi.fn(async()=>new Response(new Uint8Array([0,1,2,3])))
    vi.stubGlobal('fetch',f)
    const result=await harvestSamDocuments(client,['N1'])
    expect(result.attempted).toBe(1)
    expect(writes).toHaveLength(1)
    expect(f).toHaveBeenCalledTimes(1)
  })
})

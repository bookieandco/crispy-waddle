import { describe, expect, it } from 'vitest'
import { certifySamBulkCoverageRange, samBulkNdjsonLine, samBulkPostedDay, samBulkRowToApiNotice, streamSamBulkRows } from './sam-bulk-client'

function responseFromChunks(chunks:string[]){
  const encoder=new TextEncoder()
  return new Response(new ReadableStream<Uint8Array>({
    start(controller){
      for(const chunk of chunks)controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  }),{status:200,headers:{'content-type':'text/csv'}})
}

describe('SAM public bulk snapshot',()=>{
  it('streams quoted multiline CSV and preserves official opportunity fields',async()=>{
    const rows:Record<string,string>[]=[]
    const csv=[
      'NoticeId,Title,PostedDate,Sol#,Description,Link,NaicsCode,ClassificationCode,SetASide,Department/Ind.Agency,Office,ResponseDeadLine,Active\r\n',
      'N-1,"Cloud, migration",2026-09-26,SOL-1,"Line one\n',
      'Line two",https://sam.gov/opp/N-1/view,541512,D302,Total Small Business,GSA,Cloud Office,2026-10-15,Yes\r\n',
    ]
    const receipt=await streamSamBulkRows({
      fetchImpl:async()=>responseFromChunks(csv),
      sourceUrl:'https://example.test/sam.csv',
      onRow:row=>{rows.push(row)},
    })
    expect(receipt.sourceRows).toBe(1)
    expect(receipt.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(rows[0]?.Title).toBe('Cloud, migration')
    expect(rows[0]?.Description).toBe('Line one\nLine two')
    expect(samBulkPostedDay(rows[0]!)).toBe('2026-09-26')
    const notice=samBulkRowToApiNotice(rows[0]!)
    expect(notice.noticeId).toBe('N-1')
    expect(notice.solicitationNumber).toBe('SOL-1')
    expect(notice.naicsCode).toBe('541512')
    expect(notice.classificationCode).toBe('D302')
  })

  it('writes a true NDJSON record terminator for spool persistence',()=>{
    const line=samBulkNdjsonLine({noticeId:'N-1'})
    expect(line).toBe('{"noticeId":"N-1"}\n')
    expect(line.split('\n').filter(Boolean).map((value:string)=>JSON.parse(value))).toEqual([{noticeId:'N-1'}])
  })

  it('rejects a source that never exposes the required SAM headers',async()=>{
    await expect(streamSamBulkRows({
      fetchImpl:async()=>new Response('foo,bar\n1,2\n',{status:200}),
      sourceUrl:'https://example.test/bad.csv',
      onRow:()=>undefined,
    })).rejects.toThrow('SAM_BULK_SCHEMA_MISSING_REQUIRED_HEADERS')
  })

  it('rejects an otherwise valid but empty snapshot',async()=>{
    await expect(streamSamBulkRows({
      fetchImpl:async()=>new Response('NoticeId,Title,PostedDate\n',{status:200}),
      sourceUrl:'https://example.test/empty.csv',
      onRow:()=>undefined,
    })).rejects.toThrow('SAM_BULK_EMPTY_SNAPSHOT')
  })

  it('never certifies dates outside the observed full-snapshot range',()=>{
    expect(certifySamBulkCoverageRange({
      targetFrom:'2025-09-28',
      targetTo:'2026-09-27',
      sourceMinDay:'2022-01-01',
      sourceMaxDay:'2026-09-26',
      lastModified:'Sat, 26 Sep 2026 08:00:00 GMT',
    })).toEqual({from:'2025-09-28',to:'2026-09-26',snapshotDay:'2026-09-26'})

    expect(certifySamBulkCoverageRange({
      targetFrom:'2025-09-28',
      targetTo:'2026-09-27',
      sourceMinDay:'2026-01-01',
      sourceMaxDay:'2026-09-27',
    })).toEqual({from:'2026-01-01',to:'2026-09-27',snapshotDay:null})
  })
})

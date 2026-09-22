import { describe,expect,it } from 'vitest'
import { selectSamNoticeText } from './sam-analysis-runtime'

describe('SAM notice description selection',()=>{
  it('uses fetched notice text when SAM description is a URL',()=>{
    const resolved=selectSamNoticeText(
      'https://api.sam.gov/opportunities/v2/search?noticeid=N1',
      [{
        source_kind:'notice',
        extracted_text:'Weekly refrigerated food delivery to three installations. FAR 52.219-14 applies.',
        source_url:'https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=N1',
        fetched_at:'2026-09-21T23:00:00.000Z',
      }],
    )
    expect(resolved.text).toContain('refrigerated food delivery')
    expect(resolved.text).not.toContain('https://api.sam.gov')
    expect(resolved.sourceRef).toContain('noticedesc')
  })

  it('keeps an inline SAM description when one is provided',()=>{
    const resolved=selectSamNoticeText('Direct inline solicitation description',[])
    expect(resolved.text).toBe('Direct inline solicitation description')
  })

  it('fails closed to empty text when URL-backed description was not fetched',()=>{
    const resolved=selectSamNoticeText('https://api.sam.gov/noticedesc',[])
    expect(resolved.text).toBe('')
  })
})

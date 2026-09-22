import { afterEach,describe,expect,it,vi } from 'vitest'
import { parseSubnetListingPage,scanSubnetListings } from './subnet-client'

const fixture='<table><tr><td><a href="/opportunity/example-water-project">Example Water Project</a></td><td>summary row</td></tr></table>'+
'<div class="views-row"><h2><a href="/opportunity/example-water-project">Example Water Project</a></h2>'+
'<div>Prime Build Co.</div><p>Prime is requesting qualified subcontractor pricing for pipe and site work.</p>'+
'<div>Closing Date</div><div>10/28/2026</div><div>Performance Start Date</div><div>1/30/2027</div>'+
'<div>Place of Performance</div><div>California</div><div>NAICS code</div>'+
'<div>237110: Water and Sewer Line and Related Structures Construction</div>'+
'<div>Point of Contact</div><div>Jane Estimator</div><div>bids@example.com</div><div>760-555-0123</div></div>'+
'<div class="pager">Pagination</div>'

afterEach(()=>vi.unstubAllGlobals())

describe('SBA SUBNet listing parser',()=>{
  it('parses the detailed record and ignores the duplicate summary anchor',()=>{
    const rows=parseSubnetListingPage(fixture,0)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      externalId:'example-water-project',
      title:'Example Water Project',
      primeName:'Prime Build Co.',
      closingDate:'2026-10-28',
      performanceStartDate:'2027-01-30',
      placeOfPerformance:'California',
      naicsCode:'237110',
      contactName:'Jane Estimator',
      contactEmail:'bids@example.com',
      contactPhone:'760-555-0123',
      sourcePage:0,
    })
    expect(rows[0].description).toContain('qualified subcontractor pricing')
  })

  it('paginates and stops when a page has no records',async()=>{
    const fetchMock=vi.fn()
      .mockResolvedValueOnce(new Response(fixture,{status:200,headers:{'content-type':'text/html'}}))
      .mockResolvedValueOnce(new Response('<html><body>No listings</body></html>',{status:200}))
    vi.stubGlobal('fetch',fetchMock)
    const result=await scanSubnetListings({maxPages:5})
    expect(result.pages).toBe(2)
    expect(result.records).toHaveLength(1)
    expect(result.truncated).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

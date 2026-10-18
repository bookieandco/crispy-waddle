import { describe,expect,it } from 'vitest'
import { crawlRegisteredOwnedSite } from './personal-seo-crawler'

const root='https://pupsonstuff.example/'
const now='2026-10-18T18:00:00Z'
const map:Record<string,{status:number;body:string}>={
  [root+'robots.txt']:{status:200,body:'User-agent: *\nAllow: /\nDisallow: /private'},
  [root+'sitemap.xml']:{status:200,body:'<urlset><url><loc>https://pupsonstuff.example/products/portrait</loc></url><url><loc>https://attacker.example/</loc></url></urlset>'},
  [root]:{status:200,body:'<html><head><title>Pet portraits</title><meta name="description" content="Custom portraits"><link rel="canonical" href="https://pupsonstuff.example/"></head><body><a href="/products/portrait">Shop</a></body></html>'},
  [root+'products/portrait']:{status:404,body:'not found'},
}
const read=async(url:string,_limit:number)=>{
  const result=map[url]??{status:404,body:'not found'}
  return {url,status:result.status,body:result.body}
}
describe('JH-PERSONAL-SEO.03/.05 bounded owner crawl',()=>{
  it('uses robots and sitemap, never crawls outside domain, and reports observed 404',async()=>{
    const report=await crawlRegisteredOwnedSite({
      registeredWebsite:root,now,read,maxPages:4,
    })
    expect(report.pages.map(p=>p.url)).toEqual([root,root+'products/portrait'])
    expect(report.diagnostics.scannedPageCount).toBe(2)
    expect(report.links.findings.some(f=>f.issue==='LINK_TO_OBSERVED_HTTP_ERROR')).toBe(true)
    expect(report.completeSiteCoverage).toBe(false)
    expect(report.externalActionAuthorized).toBe(false)
  })
  it('does not silently crawl when robots cannot be verified',async()=>{
    await expect(crawlRegisteredOwnedSite({
      registeredWebsite:root,now,read:async(url)=>({url,status:503,body:''}),
    })).rejects.toThrow('PERSONAL_SEO_ROBOTS_UNAVAILABLE')
  })
  it('never treats an unobserved URL as proven broken',async()=>{
    const report=await crawlRegisteredOwnedSite({
      registeredWebsite:root,now,maxPages:1,
      read:async(url)=>url.endsWith('robots.txt')
        ?{url,status:200,body:'User-agent: *\nAllow: /'}
        :url.endsWith('sitemap.xml')?{url,status:404,body:''}
        :{url,status:200,body:'<a href="/unknown">More</a>'},
    })
    expect(report.links.findings.some(f=>f.issue==='LINK_TO_OBSERVED_HTTP_ERROR')).toBe(false)
    expect(report.links.findings.some(f=>f.issue==='UNOBSERVED_INTERNAL_TARGET')).toBe(true)
  })
  it('rejects non-public-site roots and page count abuse',async()=>{
    await expect(crawlRegisteredOwnedSite({registeredWebsite:'https://127.0.0.1/',read,now}))
      .rejects.toThrow('PERSONAL_SEO_PUBLIC_HTTPS_DOMAIN_REQUIRED')
    await expect(crawlRegisteredOwnedSite({registeredWebsite:root,read,now,maxPages:999}))
      .rejects.toThrow('PERSONAL_SEO_PAGE_BUDGET_INVALID')
  })
})

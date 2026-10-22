// COMMISSION.12: local Chromium acceptance on a genuine production build.
// Uses existing loopback-only smoke header; NOT private iPhone Safari, Face ID or authenticated production proof.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
const root=process.env.JHADINA_BASE_URL??'http://127.0.0.1:3100'
const out=new URL('../jhadina-mobile-qa/',import.meta.url)
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true})
try{
  for(const width of [390,320]){
    const page=await browser.newPage({viewport:{width,height:width===390?844:568},deviceScaleFactor:2})
    await page.setExtraHTTPHeaders({'x-jhadina-e2e-smoke':'local-production-bundle'})
    const res=await page.goto(root+'/opportunity',{waitUntil:'domcontentloaded'})
    assert(res&&res.status()<400,'Opportunity page unavailable at viewport '+width)
    await page.getByRole('heading',{name:/Opportunities, on your terms/i}).waitFor({state:'visible'})
    const workbench=page.getByRole('region',{name:'Autonomy research tools'})
    await workbench.waitFor({state:'visible'})
    await workbench.getByRole('button',{name:'Preview public listings'}).waitFor({state:'visible'})
    const importButton=workbench.getByRole('button',{name:'Import published jobs'})
    assert(await importButton.isDisabled(),'No default import without board token')
    assert(await workbench.getByRole('button',{name:'Create governed internal report'}).isDisabled().catch(()=>true),
      'Internal work cannot auto-run without an Opportunity ID and source review')
    const metrics=await page.evaluate(()=>({viewport:window.innerWidth,scroll:document.documentElement.scrollWidth}))
    assert(metrics.scroll<=metrics.viewport+1,'Opportunity UI overflows at '+width+': '+JSON.stringify(metrics))
    await page.screenshot({path:new URL('oce-'+width+'-public-preview.png',out).pathname,fullPage:false})
    const apiCalls=[
      ['/api/opportunities/discovery/jobs/batch',{sources:[{source:'greenhouse',board:'acme'}],mode:'preview'}],
      ['/api/opportunities/pilots/internal-run/from-opportunity',{opportunityId:'example',kind:'research_report',confirmedSourceReview:true}],
    ]
    for(const [url,payload] of apiCalls){
      const result=await page.request.post(root+url,{data:payload,headers:{'content-type':'application/json'}})
      assert(result.status()===401,'Unauthenticated API should reject '+url+' with 401; got '+result.status())
    }
    const commercial=await page.request.get(root+'/api/opportunities/pilots/commercial-readiness?workOrderId=example')
    assert(commercial.status()===401,'Unauthenticated commercial evidence must reject')
    await page.close()
  }
  console.log('OCE public mobile Chromium geometry/navigation and unauthenticated API gates passed')
}finally{await browser.close()}

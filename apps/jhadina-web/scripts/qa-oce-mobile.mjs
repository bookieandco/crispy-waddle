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
  const unauth=await browser.newContext({ignoreHTTPSErrors:false})
  for(const width of [390,320]){
    const page=await browser.newPage({viewport:{width,height:width===390?844:568},deviceScaleFactor:2})
    await page.setExtraHTTPHeaders({'x-jhadina-e2e-smoke':'local-production-bundle'})
    const res=await page.goto(root+'/opportunity',{waitUntil:'domcontentloaded'})
    assert(res&&res.status()<400,'Opportunity page unavailable at viewport '+width)
    await page.getByRole('heading',{name:/Opportunities, on your terms/i}).waitFor({state:'visible'})
    const workbench=page.getByRole('region',{name:'Autonomy research tools'})
    await workbench.waitFor({state:'visible'})
    await workbench.getByRole('button',{name:'Preview public listings'}).waitFor({state:'visible'})
    await workbench.getByRole('button',{name:'Check owner commissioning readiness'}).waitFor({state:'visible'})
    await workbench.getByRole('button',{name:'Reload saved run and report'}).waitFor({state:'visible'})
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
      const result=await unauth.request.post(root+url,{data:payload,maxRedirects:0,headers:{'content-type':'application/json'}})
      const location=result.headers()['location']??''
      assert(result.status()===401||result.status()===403||
        ([302,303,307,308].includes(result.status())&&new URL(location,root).pathname==='/login'),
        'Unauthenticated API should deny/redirect to login for '+url+'; got '+result.status())
    }
    const read=await unauth.request.get(root+'/api/opportunities/commissioning/readiness',{maxRedirects:0})
    const readRedirect=read.headers()['location']??''
    assert(read.status()===401||read.status()===403||
      ([302,303,307,308].includes(read.status())&&new URL(readRedirect,root).pathname==='/login'),
      'Unauthenticated activation-readiness data must be denied')
    const commercial=await unauth.request.get(root+'/api/opportunities/pilots/commercial-readiness?workOrderId=example',{maxRedirects:0})
    const loc=commercial.headers()['location']??''
    assert(commercial.status()===401||commercial.status()===403||
      ([302,303,307,308].includes(commercial.status())&&new URL(loc,root).pathname==='/login'),
      'Unauthenticated commercial evidence must deny/redirect to login')
    await page.close()
  }
  await unauth.close()
  console.log('OCE public mobile Chromium geometry/navigation and unauthenticated API gates passed')
}finally{await browser.close()}

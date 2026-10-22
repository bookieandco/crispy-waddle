// DIRECTOR-LIVE.22: bounded WebKit emulation, not physical iPhone or enrolled Face ID.
// Never substitute local middleware smoke access for a real owner Supabase session.
import assert from "node:assert/strict"
import { webkit } from "playwright"

const origin=process.env.JHADINA_BASE_URL??"http://127.0.0.1:3100"
const browser=await webkit.launch({headless:true})
try{
  for(const viewport of [{width:390,height:844},{width:320,height:568}]){
    const page=await browser.newPage({viewport,deviceScaleFactor:2,isMobile:true,hasTouch:true})
    await page.setExtraHTTPHeaders({"x-jhadina-e2e-smoke":"local-production-bundle"})
    const errors=[]
    page.on("pageerror",err=>errors.push(String(err)))
    const resp=await page.goto(origin+"/workstation?projectId=unowned-webkit-test",{waitUntil:"domcontentloaded",timeout:30000})
    assert(resp&&resp.status()>=200&&resp.status()<400,"Workstation failed to load")
    await page.getByRole("heading",{name:"Preparing project"}).waitFor({state:"visible",timeout:15000})
    const status=await page.evaluate(async()=>{
      const response=await fetch("/api/workstation/timeline?projectId=unowned-webkit-test",{cache:"no-store"})
      return response.status
    })
    assert.equal(status,401,"Unauthenticated timeline unexpectedly readable")
    const exposed=page.getByRole("navigation",{name:"Director production stages"})
    assert.equal(await exposed.count(),0,"Unverified project showed editing stages")
    assert.equal(await page.getByText("Approved editing assets").count(),0,"Owner asset shelf leaked")
    const geometry=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}))
    assert(geometry.scroll<=geometry.inner+1,"Workstation overflow "+JSON.stringify(geometry))
    await page.reload({waitUntil:"domcontentloaded"})
    await page.getByRole("heading",{name:"Preparing project"}).waitFor({state:"visible",timeout:15000})
    assert.equal(await exposed.count(),0,"Reload unlocked unverified project")
    assert.deepEqual(errors,[],"WebKit errors: "+errors.join("; "))
    console.log("DIRECTOR_LIVE_22_WEBKIT_UNOWNED_LOCK_PASS",viewport.width,status)
    await page.close()
  }
}finally{await browser.close()}
console.log("DIRECTOR_LIVE_22_WEBKIT_EMULATION_PASS; real signed-in iPhone Safari still requires separately approved private deployment")

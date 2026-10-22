#!/usr/bin/env node
/** PILOT.10-.11: private loopback iPhone/WebKit GLB candidate-vs-baseline proof.

The route and CPU prototype are generated ONLY in CI from fictitious
measurements. This test doesn't certify vendor dimensions, print-zone artwork,
real iOS Safari or a physical sample, and it cannot deploy or place an order.
*/
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { webkit } from 'playwright';

const origin=process.env.PUPSON_LOCAL_QA_ORIGIN || 'http://127.0.0.1:3100';
if(new URL(origin).origin!=='http://127.0.0.1:3100' ||
   process.env.CI!=='true' ||
   process.env.PUPSON_CLOUDFLARE_PREVIEW_ONLY!=='true' ||
   process.env.PUPSON_3D_QA_FIXTURE!=='yes'){
  throw Error('TOTE_PILOT_QA_REQUIRES_ISOLATED_SYNTHETIC_LOOPBACK_CI');
}
const output=process.env.PUPSON_QA_DIR || 'pupson-mobile-qa';
await mkdir(output,{recursive:true});
const browser=await webkit.launch({headless:true});
const hash=buf=>createHash('sha256').update(buf).digest('hex');
try {
  const page=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:2,
    isMobile:true,hasTouch:true,
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message.slice(0,500)));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    // All page/video data must remain local. Blocking external fonts is fine.
    if(url.origin!==origin && !['data:','blob:'].includes(url.protocol))
      return route.abort();
    return route.continue();
  });
  const res=await page.goto(origin+'/qa-tote-pilot/',{
    waitUntil:'domcontentloaded',timeout:45000,
  });
  assert.equal(res?.status(),200,'CPU tote pilot path is missing');
  await page.getByRole('heading',{name:'Private QA: tote candidate'}).waitFor();
  await page.getByText(/SYNTHETIC CI-ONLY GEOMETRY/).waitFor();
  const candidate=page.getByRole('region',{name:'Pilot candidate model'});
  const baseline=page.getByRole('region',{name:'Approved baseline model'});
  await candidate.getByRole('button',{name:'Reset 3D camera'}).waitFor({timeout:40000});
  await baseline.getByRole('button',{name:'Reset 3D camera'}).waitFor({timeout:40000});
  assert.ok(await candidate.locator('canvas').isVisible(),'candidate WebGL canvas missing');
  assert.ok(await baseline.locator('canvas').isVisible(),'baseline WebGL canvas missing');
  const cbox=await candidate.locator('canvas').boundingBox();
  assert.ok(cbox && cbox.width>=280 && cbox.width<=390,'portrait WebGL width overflow');
  // No checkout, upload, paid AI or external provider interactions on this page.
  assert.equal(await page.getByRole('button',{name:/checkout|pay now|place order/i}).count(),0);
  const views=['front','side','back'];
  const screenshotHashes={};
  for(const view of views){
    const control=candidate.getByRole('button',{name:'View '+view+' of product'});
    await control.tap();
    assert.equal(await control.getAttribute('aria-pressed'),'true');
    // Canvas screenshot captures the REAL GLB loaded through the canonical
    // Product3DEngine; don't interpret screenshot capture as quality approval.
    const image=await candidate.screenshot({
      path:output+'/pilot-tote-'+view+'-iphone-webkit.png',
    });
    screenshotHashes[view]=hash(image);
    assert.ok(image.length>2000,'candidate render unexpectedly empty');
  }
  assert.ok(new Set(Object.values(screenshotHashes)).size>=2,
    'front/side/back candidate screenshots are identical');
  // Confirm old approved tote has NOT been replaced by our preview GLB.
  const original=await page.request.get(origin+'/models/tote.glb');
  const synthetic=await page.request.get(origin+'/qa-pilot-tote.glb');
  assert.equal(original.status(),200);
  assert.equal(synthetic.status(),200);
  assert.notEqual(hash(await original.body()),hash(await synthetic.body()));
  const absent=await page.request.get(origin+'/api/checkout/session');
  assert.equal(absent.status(),503,'read-only preview must block payment session APIs');
  assert.deepEqual(errors,[],'Uncaught browser rendering errors');
  console.log(JSON.stringify({
    status:'SYNTHETIC_WEBKIT_IPHONE_VIEWPORT_PROVEN',
    syntheticOnly:true,physicalIphoneProven:false,
    supplierCertified:false,printZoneCertified:false,
    separateApprovedGlbPreserved:true,screenshots:screenshotHashes,
  },null,2));
} finally {
  await browser.close();
}

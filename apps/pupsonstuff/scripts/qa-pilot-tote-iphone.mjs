#!/usr/bin/env node
/** PILOT.10-.11: private loopback iPhone/WebKit GLB candidate-vs-baseline proof.

The route and CPU prototype are generated ONLY in CI from fictitious
measurements. This test doesn't certify vendor dimensions, print-zone artwork,
real iOS Safari or a physical sample, and it cannot deploy or place an order.
*/
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
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
  // SIX browser captures: 3 candidate + 3 unchanged original, same
  // mobile viewport. Visuals are synthetic functional QA and do not stand
  // in for the Blender/supplier/physical certification matrix.
  const views=['front','side','back'];
  const screenshotHashes={};
  for(const [name,region] of [['candidate',candidate],['approved',baseline]]){
    for(const view of views){
      const control=region.getByRole('button',{name:'View '+view+' of product'});
      await control.tap();
      assert.equal(await control.getAttribute('aria-pressed'),'true');
      const image=await region.screenshot({
        path:output+'/pilot-tote-'+name+'-'+view+'-iphone-webkit.png',
      });
      screenshotHashes[name+'-'+view]=hash(image);
      assert.ok(image.length>2000,name+' '+view+' render unexpectedly empty');
    }
    assert.ok(new Set(views.map(view=>screenshotHashes[name+'-'+view])).size>=2,
      name+' front/side/back screenshots are identical');
  }
  assert.equal(Object.keys(screenshotHashes).length,6);
  // Confirm old approved tote has NOT been replaced by our preview GLB.
  const original=await page.request.get(origin+'/models/tote.glb');
  const synthetic=await page.request.get(origin+'/qa-pilot-tote.glb');
  assert.equal(original.status(),200);
  assert.equal(synthetic.status(),200);
  assert.notEqual(hash(await original.body()),hash(await synthetic.body()));
  const absent=await page.request.get(origin+'/api/checkout/session');
  assert.equal(absent.status(),503,'read-only preview must block payment session APIs');
  assert.deepEqual(errors,[],'Uncaught browser rendering errors');
  const receipt={
    status:'SIX_VIEW_SYNTHETIC_WEBKIT_FUNCTIONAL_QA_ONLY',
    syntheticOnly:true,
    screenshotCount:6,
    physicalIphoneProven:false,
    supplierCertified:false,
    licensedProductPhotosVerified:false,
    printZoneCertified:false,
    physicalSampleCertified:false,
    mayPromoteAutomatically:false,
    separateApprovedGlbPreserved:true,
    candidateSha256:hash(await synthetic.body()),
    baselineSha256:hash(await original.body()),
    screenshots:screenshotHashes,
  };
  await writeFile(output+'/pilot-tote-six-view-UNCERTIFIED.receipt.json',
    JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(receipt,null,2));
} finally {
  await browser.close();
}

#!/usr/bin/env node
/**
 * Linux Playwright WebKit/iPhone-viewport smoke test. This is a Safari
 * ENGINE approximation, not evidence from a physical iPhone or iOS Safari.
 * Local-only; no customer data, paid API, order, or upload is attempted.
 */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {webkit} from 'playwright';

const origin=process.env.PUPSON_LOCAL_QA_ORIGIN || 'http://127.0.0.1:3100';
if (new URL(origin).origin !== 'http://127.0.0.1:3100') {
  throw Error('Private WebKit preview QA can only run against local loopback.');
}
const output=process.env.PUPSON_QA_DIR || 'pupson-mobile-qa';
await mkdir(output,{recursive:true});
const browser=await webkit.launch({headless:true});
try {
  const page=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:3,
    isMobile:true,hasTouch:true
  });
  page.on('dialog',dialog=>dialog.dismiss());
  const uncaught=[];
  page.on('pageerror',err=>uncaught.push(err.message.slice(0,250)));
  await page.emulateMedia({reducedMotion:'reduce'});
  const response=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response?.status(),200,'WebKit storefront did not load');
  await page.locator('img[alt^="PupsonStuff boutique"]').waitFor({state:'visible'});
  assert.ok(await page.getByRole('button',{name:'Show entire boutique'}).isVisible(),
    'Mobile immersive navigation missing in WebKit');
  await page.screenshot({path:`${output}/webkit-iphone-portrait-landing.png`});
  await page.getByRole('button',{name:'Show entire boutique'}).tap();
  const room=page.locator('.pupson-boutique-stage');
  await page.waitForFunction(() => Math.abs(
    document.querySelector('.pupson-boutique-stage').getBoundingClientRect().width-innerWidth
  )<4,{timeout:4500});
  const roomBox=await room.boundingBox();
  assert.ok(roomBox?.width && Math.abs(roomBox.width-390)<5,'Whole-room map does not fit');
  await page.screenshot({path:`${output}/webkit-iphone-whole-room.png`});
  await page.getByRole('button',{name:'White Hoodie',exact:true}).tap();
  const dialog=page.getByRole('dialog',{name:'White Hoodie'});
  await dialog.waitFor({state:'visible',timeout:12000});
  const bounds=await dialog.boundingBox();
  assert.ok(bounds?.width && bounds.width<=392 && bounds.height<=846,
    'Product details overflow mobile safe-area viewport');
  await dialog.getByRole('button',{name:'Artwork',exact:true}).tap();
  assert.equal(await dialog.locator('canvas').count(),0,
    'Artwork fallback must not leave WebGL on screen');
  await page.getByText('This private preview has not activated pet portrait generation.').waitFor({
    timeout:8000
  }).catch(async ()=>{
    // Middleware in the safe CI Worker preview intentionally returns 503
    // for /api/creative/capabilities; the availability check must still
    // fail closed even if the exact explanatory text changes.
    const button=page.getByRole('button',{name:/Generate.*preview/i});
    if(await button.count()) assert.ok(await button.isDisabled());
  });
  await page.screenshot({path:`${output}/webkit-iphone-product-artwork.png`});
  await dialog.getByRole('button',{name:'Close'}).tap();
  await dialog.waitFor({state:'hidden',timeout:9000});
  assert.deepEqual(uncaught,[],'WebKit had unexpected uncaught script errors');
  console.log('PASS: WebKit iPhone-sized browser touch navigation and no-spend artwork fallback; physical Safari not certified.');
} finally {await browser.close();}

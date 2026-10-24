#!/usr/bin/env node
/** Headless Chromium geometry + screenshot proof, not an iPhone Safari certification.
 * No mutating API calls, pet uploads, AI, Stripe, or Printify.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.PUPSON_LOCAL_QA_ORIGIN || 'http://127.0.0.1:3100';
const output = process.env.PUPSON_QA_DIR || 'pupson-mobile-qa';
if (new URL(origin).origin !== 'http://127.0.0.1:3100') {
  throw Error('Only the local PupsonStuff acceptance host is supported.');
}
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true});
const cases=[
  {name:'iphone-390-portrait',width:390,height:844,portrait:true},
  {name:'iphone-430-portrait',width:430,height:932,portrait:true},
  {name:'iphone-844-landscape',width:844,height:390,portrait:false},
  {name:'desktop-1440',width:1440,height:900,portrait:false},
];
let complete=0;
try {
  for (const item of cases) {
    const page = await browser.newPage({
      viewport:{width:item.width,height:item.height},deviceScaleFactor:2,
      isMobile:item.portrait,hasTouch:item.portrait
    });
    await page.emulateMedia({reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message.slice(0,300)));
    const response=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:40000});
    assert.equal(response?.status(),200,`${item.name}: homepage status`);
    // The local Next build must actually SERVE all six approved GLBs, not
    // just contain their filenames in Git. The deployed Worker has its own
    // equivalent binary canary.
    if (complete === 0) {
      for (const model of ['shirt_baked','hoodie','mug','pillow','bottle','tote']) {
        const res = await page.request.get(origin + '/models/' + model + '.glb');
        assert.equal(res.status(),200,`3D model ${model}: missing asset`);
        const bytes = await res.body();
        assert.equal(bytes.subarray(0,4).toString('ascii'),'glTF',`3D model ${model}: not a GLB binary`);
        assert.equal(bytes.readUInt32LE(4),2,`3D model ${model}: wrong glTF version`);
        assert.equal(bytes.readUInt32LE(8),bytes.length,`3D model ${model}: invalid byte count`);
      }
    }
    const image=page.locator('img[alt^="PupsonStuff boutique"]');
    await image.waitFor({state:'visible',timeout:15000});
    await image.evaluate(async img=>{
      if (img.complete && img.naturalWidth) return;
      await new Promise((resolve,reject)=>{
        img.addEventListener('load',resolve,{once:true});
        img.addEventListener('error',()=>reject(Error('Boutique photo unavailable')),{once:true});
      });
    });

    const measured=await page.evaluate(()=>{
      const stage=document.querySelector('.pupson-boutique-stage');
      const photo=document.querySelector('img[alt^="PupsonStuff boutique"]');
      const scroller=document.querySelector('.pupson-boutique-viewport');
      const products=[...document.querySelectorAll('.pupson-boutique-stage button[aria-label]')];
      const b=stage.getBoundingClientRect(),p=photo.getBoundingClientRect();
      const invalid=products.filter(el=>{
        const r=el.getBoundingClientRect();
        return r.left < b.left-1 || r.top < b.top-1 ||
          r.right > b.right+1 || r.bottom > b.bottom+1;
      }).map(el=>el.getAttribute('aria-label'));
      return {width:b.width,height:b.height,imageWidth:p.width,imageHeight:p.height,
        photoNaturalWidth:photo.naturalWidth,photoNaturalHeight:photo.naturalHeight,
        scrollerWidth:scroller.clientWidth,scrollWidth:scroller.scrollWidth,
        hasRings:!!document.querySelector('.life-ping-ring'),
        hotspots:products.length,invalid,
        pageOverflow:document.documentElement.scrollWidth > innerWidth + 2};
    });
    assert.ok(measured.hotspots>10,`${item.name}: product tap targets missing`);
    assert.deepEqual(measured.invalid,[],`${item.name}: hotspots detached from photo`);
    assert.ok(!measured.hasRings,`${item.name}: scattered glow rings returned`);
    // Decorative masks must not revert to angular silhouette polygons.
    const glowProof = await page.evaluate(() => ({
      productGlowCount: document.querySelectorAll('.pupson-product-glow').length,
      serviceGlowCount: document.querySelectorAll('[data-hotspot-product="checkout"] .pupson-product-glow, [data-hotspot-product="upload"] .pupson-product-glow').length,
      polygonGlowCount: [...document.querySelectorAll('.pupson-product-glow')].filter((el) =>
        getComputedStyle(el).clipPath.includes('polygon')).length,
    }));
    assert.equal(glowProof.serviceGlowCount,0,`${item.name}: checkout or studio wrongly glows`);
    assert.equal(glowProof.polygonGlowCount,0,`${item.name}: polygon sticker outline returned`);
    assert.ok(glowProof.productGlowCount>=10,`${item.name}: all product glows missing`);
    assert.ok(!measured.pageOverflow,`${item.name}: body spills off screen`);
    assert.ok(Math.abs(measured.width/measured.height-1568/1003)<0.003,
      `${item.name}: image-space aspect ratio changed`);
    assert.ok(Math.abs(measured.imageWidth-measured.width)<2 &&
      Math.abs(measured.imageHeight-measured.height)<2,
      `${item.name}: photo layer no longer matches hotspots`);
    // next/image serves device-sized derivatives. Intrinsic source pixels vary
    // across viewport widths; identity and aspect ratio must not vary.
    assert.ok(measured.photoNaturalWidth>0 && measured.photoNaturalHeight>0 &&
      Math.abs(measured.photoNaturalWidth/measured.photoNaturalHeight-1568/1003)<0.015,
      `${item.name}: valid canonical photo derivative not loaded`);
    await page.screenshot({path:`${output}/${item.name}-landing.png`,fullPage:false});

    if(item.portrait) {
      const wholeRoom=page.getByRole('button',{name:'Show entire boutique'});
      assert.ok(await wholeRoom.isVisible(),`${item.name}: immersive portrait entry missing`);
      assert.ok(measured.width>item.width*2,`${item.name}: portrait must start full height`);
      const pan=await page.evaluate(()=>{
        const scroller=document.querySelector('.pupson-boutique-viewport');
        const b=document.querySelector('.pupson-boutique-stage').getBoundingClientRect();
        const start=scroller.scrollLeft;
        scroller.scrollLeft=Math.min(scroller.scrollWidth,start+120);
        return {start,end:scroller.scrollLeft,stageWidth:b.width,viewport:scroller.clientWidth};
      });
      assert.ok(pan.stageWidth>pan.viewport*2,`${item.name}: cannot explore room at full height`);
      assert.ok(pan.end>pan.start+80,`${item.name}: horizontal swiping disabled`);
      await page.getByRole('button',{name:'Drinkware',exact:true}).click();
      await page.waitForTimeout(600);
      const nav=await page.evaluate(()=>{
        const s=document.querySelector('.pupson-boutique-viewport');
        return {left:s.scrollLeft,required:document.querySelector('.pupson-boutique-stage').getBoundingClientRect().width*.34-s.clientWidth/2};
      });
      assert.ok(Math.abs(nav.left-nav.required)<12,`${item.name}: department focus drifts`);
      await page.screenshot({path:`${output}/${item.name}-drinkware.png`,fullPage:false});

      // The map can be opened without erasing where the visitor was shopping.
      const saved=nav.left;
      await wholeRoom.click();
      await page.getByRole('button',{name:'Explore boutique up close'}).waitFor();
      const overview=await page.locator('.pupson-boutique-stage').boundingBox();
      assert.ok(overview && Math.abs(overview.width-item.width)<3,
        `${item.name}: the whole-room map must fit in portrait`);
      await page.screenshot({path:`${output}/${item.name}-whole-room-map.png`,fullPage:false});
      await page.getByRole('button',{name:'Explore boutique up close'}).click();
      // React applies the new stage width, then schedules one animation frame
      // to pan to the saved item. Check the settled position, not the
      // immediate click-event snapshot before that frame can run.
      await page.waitForFunction((target)=>{
        const scroller=document.querySelector('.pupson-boutique-viewport');
        return scroller && Math.abs(scroller.scrollLeft-target)<12;
      },saved,{timeout:2500});
      const restored=await page.evaluate(()=>document.querySelector('.pupson-boutique-viewport').scrollLeft);
      assert.ok(Math.abs(restored-saved)<12,`${item.name}: map lost shopper position`);
    } else {
      const control=page.getByRole('button',{name:'Explore boutique up close'});
      assert.ok(!(await control.isVisible()),`${item.name}: portrait-only toggle shown in landscape`);
      assert.ok(measured.width<=item.width+2,`${item.name}: default landscape should fit`);
    }
    if(item.name === 'desktop-1440') {
      // The user must be able to escape a broken or slow WebGL preview and
      // see their artwork without generating new content or paying anyone.
      await page.getByRole('button',{name:'White Hoodie',exact:true}).click();
      const previewModes=page.getByRole('group',{name:'Product preview mode'});
      await previewModes.waitFor({state:'visible',timeout:10000});
      const artworkTab=previewModes.getByRole('button',{name:'Artwork',exact:true});
      const modelTab=previewModes.getByRole('button',{name:'3D product',exact:true});
      assert.ok(await artworkTab.isVisible() && await modelTab.isVisible(),
        '3D and flat artwork must both be reachable');
      await artworkTab.click();
      assert.equal(await artworkTab.getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('canvas').count(),0,'Artwork tab must actually unmount the WebGL canvas');
      assert.ok(await page.getByText('Upload a photo and generate a preview to see it here').isVisible(),
        'Flat preview should show an honest empty state before generation');
      await page.screenshot({path:`${output}/desktop-artwork-fallback.png`,fullPage:false});
      await modelTab.click();
      assert.equal(await modelTab.getAttribute('aria-pressed'),'true');
      await page.locator('canvas').first().waitFor({state:'visible',timeout:15000});
      await page.getByRole('button',{name:'Reset 3D camera'}).waitFor({timeout:15000});
      await page.screenshot({path:`${output}/desktop-3d-preview.png`,fullPage:false});
      const dialog=page.getByRole('dialog',{name:'White Hoodie'});
      assert.ok(await dialog.isVisible(),'Product dialog semantics missing');
      await page.keyboard.press('Escape');
      await dialog.waitFor({state:'hidden',timeout:5000});
      assert.ok(await page.getByRole('button',{name:'White Hoodie',exact:true}).evaluate(el=>document.activeElement===el),
        'Closing with Escape should restore focus to the selected garment');
      await page.route('**/models/bottle.glb',route => route.fulfill({
        status:404,contentType:'text/plain',body:'missing model fixture',
      }));
      await page.getByRole('button',{name:'Insulated Bottle',exact:true}).click();
      const bottleDialog=page.getByRole('dialog',{name:'Insulated Bottle'});
      await bottleDialog.getByRole('button',{name:'Try 3D again'}).waitFor({timeout:15000});
      await bottleDialog.getByRole('button',{name:'Artwork',exact:true}).click();
      assert.equal(await bottleDialog.locator('canvas').count(),0,
        'Missing GLB must not trap visitor inside WebGL');
      await page.screenshot({path:`${output}/desktop-missing-glb-fallback.png`,fullPage:false});
      await page.unroute('**/models/bottle.glb');
      // The injected 404 can surface as a browser pageerror even though the
      // viewer's error boundary recovered correctly. Accept ONLY this
      // deliberate request failure, never mask unrelated JS exceptions.
      const expectedMissingAsset = errors.filter(message =>
        message.includes('/models/bottle.glb') && message.includes('404'));
      assert.equal(expectedMissingAsset.length,1,
        'Missing GLB fixture must report exactly one expected load failure');
      errors.splice(errors.indexOf(expectedMissingAsset[0]),1);
    }
    assert.deepEqual(errors,[],`${item.name}: browser console JS exceptions`);
    console.log(JSON.stringify({viewport:item.name,pass:true,geometry:measured}));
    complete++;
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('Pupson responsive browser acceptance passed: '+complete+'/'+cases.length);

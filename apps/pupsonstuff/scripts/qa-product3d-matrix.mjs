#!/usr/bin/env node
/** Read-only synthetic material/decal screenshot matrix of every approved GLB.
 * Generated /__qa3d__ route exists ONLY in temporary CI Next build.
 * Screenshots do not imply a verified Printify profile or production print.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const origin = process.env.PUPSON_LOCAL_QA_ORIGIN || 'http://127.0.0.1:3100';
if (new URL(origin).origin !== 'http://127.0.0.1:3100')
  throw Error('QA model screenshots require the isolated loopback server.');
const output = process.env.PUPSON_QA_DIR || 'pupson-mobile-qa';
await mkdir(output, {recursive:true});
const cases = [
  {name:'shirt',model:'shirt'}, {name:'hoodie-white',model:'hoodie'},
  {name:'hoodie-black',model:'hoodie',color:'black'},
  {name:'mug',model:'mug'}, {name:'pillow',model:'pillow'},
  {name:'bottle',model:'bottle'}, {name:'tote',model:'tote'},
  {name:'canvas',model:'canvas'},
];
const browser=await chromium.launch({headless:true});
try {
  for (const item of cases) {
    const page=await browser.newPage({viewport:{width:900,height:900},deviceScaleFactor:1});
    await page.emulateMedia({reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror', error=>errors.push(error.message.slice(0,450)));
    const uri=origin+'/qa-proof-model/?model='+item.model+(item.color?'&color='+item.color:'');
    const response=await page.goto(uri,{waitUntil:'domcontentloaded',timeout:40000});
    assert.equal(response?.status(),200,item.name+' QA page missing');
    await page.getByRole('heading',{name:'QA 3D model: '+item.model}).waitFor({timeout:18000});
    await page.getByRole('button',{name:'Reset 3D camera'}).waitFor({timeout:20000});
    const canvas=page.locator('canvas').first();
    const box=await canvas.boundingBox();
    assert.ok(box && box.width>250 && box.height>250,item.name+' WebGL canvas not visible');
    const frontBuffer = await page.screenshot({path:`${output}/qa3d-${item.name}-front.png`});
    const {data:pixels, info:image} = await sharp(frontBuffer).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let coloredMarkerPixels=0;
    for (let y=120;y<Math.min(720,image.height);y++) for (let x=160;x<Math.min(740,image.width);x++) {
      const p=(y*image.width+x)*image.channels;
      const red=pixels[p], green=pixels[p+1], blue=pixels[p+2];
      if (red>145 && red>green*1.45 && green>35 && green<155 && blue<105) coloredMarkerPixels++;
    }
    assert.ok(coloredMarkerPixels>20,`${item.name}: colored synthetic artwork invisible on front (${coloredMarkerPixels} red pixels)`);
    if (item.model === 'bottle') {
      // This exercises a prior texture lifecycle bug: rotating the front
      // cylinder decal disposed its THREE.Texture clone during the update.
      const rotate=page.getByRole('button',{name:'QA rotate artwork'});
      await rotate.click();
      await rotate.click();
      await page.waitForTimeout(300);
      const rotated=await page.screenshot({
        path:`${output}/qa3d-${item.name}-rotated-artwork.png`,
      });
      const {data:rotatedPixels,info:ri}=await sharp(rotated).removeAlpha().raw()
        .toBuffer({resolveWithObject:true});
      let rotatedMarkerPixels=0;
      for(let y=120;y<Math.min(720,ri.height);y++) for(let x=160;x<Math.min(740,ri.width);x++) {
        const p=(y*ri.width+x)*ri.channels;
        if(rotatedPixels[p]>145 && rotatedPixels[p]>rotatedPixels[p+1]*1.45 &&
            rotatedPixels[p+1]>35 && rotatedPixels[p+1]<155 && rotatedPixels[p+2]<105)
          rotatedMarkerPixels++;
      }
      assert.ok(rotatedMarkerPixels>20,`${item.name}: curved decal vanished after rotation (${rotatedMarkerPixels} pixels)`);
    }
    // Use exact named camera directions. The older freehand-mouse drag
    // overshot 180°: its misleading 'back' screenshot often showed a side.
    // This is a reliable inspection receipt, NOT print-back approval.
    let backFrame=null;
    for (const view of ['side', 'back']) {
      const button=page.getByRole('button',{name:`View ${view} of product`});
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'),'true',
        item.name+' '+view+' inspection direction not activated');
      await page.waitForTimeout(280);
      const viewImage=await page.screenshot({path:`${output}/qa3d-${item.name}-${view}.png`});
      if(view==='back') backFrame=viewImage;
    }
    // Reject a mislabeled 'back' shot that still shows front-only artwork.
    // This checks visibility, not dimensional or Printify placement accuracy.
    assert.ok(backFrame,item.name+' back screenshot missing');
    const {data:rearPixels,info:rear}=await sharp(backFrame).removeAlpha().raw()
      .toBuffer({resolveWithObject:true});
    let rearMarkerPixels=0;
    for(let y=120;y<Math.min(720,rear.height);y++) for(let x=160;x<Math.min(740,rear.width);x++) {
      const p=(y*rear.width+x)*rear.channels;
      if(rearPixels[p]>145 && rearPixels[p]>rearPixels[p+1]*1.45 &&
          rearPixels[p+1]>35 && rearPixels[p+1]<155 && rearPixels[p+2]<105)
        rearMarkerPixels++;
    }
    assert.ok(rearMarkerPixels<Math.max(20,coloredMarkerPixels*0.6),
      `${item.name}: front-only artwork appears on supposed rear view (${rearMarkerPixels}/${coloredMarkerPixels})`);
    // Verify orbit still accepts a real drag after selecting named angles.
    const x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y); await page.mouse.down();
    await page.mouse.move(x+box.width*0.12,y,{steps:8}); await page.mouse.up();
    await page.waitForTimeout(120);
    await page.getByRole('button',{name:'View front of product'}).click();
    assert.equal(await page.getByRole('button',{name:'View front of product'}).getAttribute('aria-pressed'),'true');
    assert.deepEqual(errors,[],item.name+' browser errors');
    console.log(JSON.stringify({model:item.name,pass:true,views:['front','side','back'],syntheticDecal:true,markerPixels:coloredMarkerPixels}));
    await page.close();
  }
} finally { await browser.close(); }
console.log('Pupson synthetic 3D matrix: '+cases.length+'/'+cases.length+' models rendered.');

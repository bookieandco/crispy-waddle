#!/usr/bin/env node
/** Read-only synthetic material/decal screenshot matrix of every approved GLB.
 * Generated /__qa3d__ route exists ONLY in temporary CI Next build.
 * Screenshots do not imply a verified Printify profile or production print.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

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
    const uri=origin+'/__qa3d__/?model='+item.model+(item.color?'&color='+item.color:'');
    const response=await page.goto(uri,{waitUntil:'domcontentloaded',timeout:40000});
    assert.equal(response?.status(),200,item.name+' QA page missing');
    await page.getByRole('heading',{name:'QA 3D model: '+item.model}).waitFor({timeout:18000});
    await page.getByRole('button',{name:'Reset 3D camera'}).waitFor({timeout:20000});
    const canvas=page.locator('canvas').first();
    const box=await canvas.boundingBox();
    assert.ok(box && box.width>250 && box.height>250,item.name+' WebGL canvas not visible');
    await page.screenshot({path:`${output}/qa3d-${item.name}-front.png`});
    // OrbitControls rotates the real WebGL model. These are view receipts,
    // not angle-calibrated manufacturing diagrams.
    const x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x+box.width*0.28,y,{steps:12});await page.mouse.up();
    await page.waitForTimeout(150);
    await page.screenshot({path:`${output}/qa3d-${item.name}-side.png`});
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x+box.width*0.56,y,{steps:14});await page.mouse.up();
    await page.waitForTimeout(150);
    await page.screenshot({path:`${output}/qa3d-${item.name}-back.png`});
    assert.deepEqual(errors,[],item.name+' browser errors');
    console.log(JSON.stringify({model:item.name,pass:true,views:['front','side','back'],syntheticDecal:true}));
    await page.close();
  }
} finally { await browser.close(); }
console.log('Pupson synthetic 3D matrix: '+cases.length+'/'+cases.length+' models rendered.');

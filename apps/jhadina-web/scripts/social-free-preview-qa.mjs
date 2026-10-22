// Actual component in a disposable browser fixture, not a live account or RLS test.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {createServer} from 'node:http'
import {mkdir, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const driver = createRequire(path.join(process.env.SOCIAL_FREE_QA_TOOLS, 'package.json'))
const {build} = driver('esbuild')
const {chromium} = driver('playwright')
const out = path.join(app, 'social-free-preview-qa')
await mkdir(out, {recursive: true})
const bundle = await build({
  absWorkingDir: app, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  define: {'process.env.NODE_ENV': '"production"'},
  stdin: {resolveDir: app, loader: 'tsx', contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import Page from './src/app/social/collaborations/page';
    createRoot(document.getElementById('root')).render(<Page />);
  `},
})
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script>'
  + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script></body></html>'
const server = createServer((req, res) => {
  if (req.url !== '/') {res.writeHead(404); res.end(); return}
  res.setHeader('content-type', 'text/html'); res.end(html)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({headless: true})
const receipts = []
try {
  for (const width of [390, 375]) {
    const context = await browser.newContext({viewport: {width, height: 844}, isMobile: true, hasTouch: true})
    const page = await context.newPage()
    const writes = [], external = [], errors = []
    page.on('pageerror', error => errors.push(error.message))
    await context.route('**/*', async route => {
      const req = route.request()
      if (!['GET', 'HEAD'].includes(req.method())) {writes.push(req.url()); await route.abort(); return}
      if (new URL(req.url()).origin !== origin) {external.push(req.url()); await route.abort(); return}
      // No account/backend is connected. Do not fabricate a persistence success.
      if (new URL(req.url()).pathname.startsWith('/api/')) {
        await route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({error: 'SOCIAL_FREE_STORAGE_UNAVAILABLE'})})
        return
      }
      await route.continue()
    })
    await page.goto(origin)
    await page.getByRole('heading', {name: 'Creator Collaboration Lab', exact: true}).waitFor()
    await page.getByLabel('Creator identifier').fill('fixture_dog')
    await page.getByLabel('Observed niches').fill('dogs, pets')
    await page.getByLabel('Observed product affinity').fill('dog owner')
    await page.getByLabel('I have a permitted contact route and no opt-out.').check()
    await page.getByRole('button', {name: 'Evaluate preview', exact: true}).click()
    await page.getByRole('heading', {name: 'Creator assessment', exact: true}).waitFor()
    assert.match(await page.locator('main').innerText(), /Missing quote/)
    assert.equal(await page.getByRole('alert').count(), 0)
    await page.locator('textarea').fill('instagram,fixture_dog,dogs,dog owner,unknown')
    await page.getByLabel('External order evidence reference').fill('fixture:unverified')
    for (const label of ['Attributed revenue (USD)', 'Fulfillment cost (USD)', 'Marketing cost (USD)']) {
      await page.getByLabel(label, {exact: true}).fill('1')
    }
    const saveButtons = page.getByRole('button', {name: /^Save /})
    assert.equal(await saveButtons.count(), 8)
    for (const button of await saveButtons.all()) {
      assert.equal(await button.isDisabled(), true)
      // Native disabled buttons must not dispatch their React click handlers.
      await button.evaluate(element => element.click())
    }
    await page.getByRole('button', {name: 'Reload saved records', exact: true}).click()
    await page.getByRole('status').filter({hasText: 'SOCIAL_FREE_STORAGE_UNAVAILABLE'}).waitFor()
    assert.equal(await page.getByRole('button', {name: /^Record /}).count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({path: path.join(out, `portrait-${width}.png`), fullPage: true})
    await page.reload()
    await page.getByLabel('Creator identifier').waitFor()
    assert.equal(await page.getByLabel('Creator identifier').inputValue(), '')
    assert.equal(await page.getByRole('heading', {name: 'Creator assessment', exact: true}).count(), 0)
    assert.deepEqual(writes, []); assert.deepEqual(external, []); assert.deepEqual(errors, [])
    receipts.push({width, engine: 'chromium', actualComponent: true, evaluation: 'PASS',
      disabledSaveControls: 8, persistenceRequests: writes.length, externalRequests: external.length,
      horizontalOverflow: false, reloadClearsPreview: true, realIphoneVerified: false, liveRlsVerified: false})
    await context.close()
  }
  await writeFile(path.join(out, 'receipt.json'), JSON.stringify({status: 'PASS', receipts}, null, 2) + '\n')
  console.log(JSON.stringify({status: 'PASS', receipts}))
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}

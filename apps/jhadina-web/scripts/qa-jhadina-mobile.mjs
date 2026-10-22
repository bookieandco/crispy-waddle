// Local production-bundle Chromium acceptance of real App and Pages Router chrome.
// Browser emulation is NOT enrolled-iPhone Face ID / Safari certification.
// Uses the repository's existing loopback-only smoke header; never a remote auth bypass.
import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { chromium } from "playwright"

const base = process.env.JHADINA_BASE_URL ?? "http://127.0.0.1:3100"
const out = new URL("../jhadina-mobile-qa/", import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const screens = [
  { width: 390, height: 844, name: "iphone-390" },
  { width: 320, height: 568, name: "narrow-320" },
]

async function visit(page, url) {
  const response = await page.goto(base + url, { waitUntil: "domcontentloaded", timeout: 30000 })
  assert(response && response.status() >= 200 && response.status() < 400, url + " did not render")
}

async function noHorizontalOverflow(page, where) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  assert(metrics.scrollWidth <= metrics.innerWidth + 1,
    where + " horizontal overflow: " + JSON.stringify(metrics))
}

try {
  for (const size of screens) {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 })
    page.setDefaultTimeout(12000)
    await page.setExtraHTTPHeaders({ "x-jhadina-e2e-smoke": "local-production-bundle" })
    await visit(page, "/work")
    const primary = page.getByRole("navigation", { name: "Primary navigation" })
    await primary.waitFor({ state: "visible" })
    for (const name of ["Home", "Ask", "Work", "Activity"]) {
      assert(await primary.getByRole("link", { name, exact: true }).count() === 1,
        "Missing primary " + name)
    }
    await noHorizontalOverflow(page, size.name + " work")
    const toolbar = await page.evaluate(() => {
      const worlds = document.querySelector('[aria-label="Open Jhadina worlds"]')
      const vpn = document.querySelector('[aria-label="Open VPN settings"]') ??
        document.querySelector('[aria-pressed][class*="vpnToggle"]')
      if (!(worlds instanceof HTMLElement) || !(vpn instanceof HTMLElement)) return null
      const a = worlds.getBoundingClientRect()
      const b = vpn.getBoundingClientRect()
      return { worlds: { left: a.left, right: a.right, height: a.height, width: a.width },
        vpn: { left: b.left, right: b.right, height: b.height } }
    })
    assert(toolbar, "Top toolbar controls missing")
    assert(toolbar.worlds.right + 4 <= toolbar.vpn.left,
      "Top toolbar overlaps at " + size.name + ": " + JSON.stringify(toolbar))
    assert(toolbar.worlds.height >= 44 && toolbar.worlds.width >= 44 &&
      toolbar.vpn.height >= 44, "Top toolbar touch targets too small")

    await page.screenshot({ path: new URL(size.name + "-work.png", out).pathname })

    const more = primary.getByRole("button", { name: "More Jhadina worlds" })
    await more.click()
    const menu = page.getByRole("navigation", { name: "Jhadina worlds" })
    await menu.waitFor({ state: "visible" })
    assert.equal(await more.getAttribute("aria-expanded"), "true")
    assert(await menu.locator("a").count() > 15, "Directory unexpectedly incomplete")
    let bounds = await menu.boundingBox()
    assert(bounds && bounds.x >= 0 && bounds.y >= 0 &&
      bounds.x + bounds.width <= size.width + 1 &&
      bounds.y + bounds.height <= size.height - 48,
      "Worlds menu clips the viewport: " + JSON.stringify(bounds))
    await page.screenshot({ path: new URL(size.name + "-menu.png", out).pathname })
    await menu.evaluate(el => { el.scrollTop = el.scrollHeight })
    const scroll = await menu.evaluate(el => ({ top: el.scrollTop, range: el.scrollHeight - el.clientHeight }))
    assert(scroll.range > 0 && scroll.top > 0, "Full worlds directory did not scroll")
    assert(await menu.getByRole("link", { name: "Face ID & security" }).count() === 1)

    await page.keyboard.press("Escape")
    await menu.waitFor({ state: "hidden" })
    assert.equal(await more.getAttribute("aria-expanded"), "false")
    await more.click()
    await menu.waitFor({ state: "visible" })
    await menu.getByRole("link", { name: /Sports Intelligence/ }).click()
    await page.waitForURL(url => url.pathname === "/sports-lab")
    assert.equal(await more.getAttribute("aria-expanded"), "false",
      "More did not close after navigation")

    // Follow every visible shell destination, not merely its static file mapping.
    // Running this at one mobile size bounds CI time while both sizes retain geometry checks.
    if (size.width === 390) {
      await visit(page, "/work")
      await page.getByRole("button", { name: "More Jhadina worlds" }).click()
      const directory = page.getByRole("navigation", { name: "Jhadina worlds" })
      const destinations = await directory.locator('a[href]').evaluateAll(links =>
        [...new Set(links.map(link => {
          const target = link.getAttribute("href") ?? ""
          return target.startsWith("/") && !target.startsWith("//") ? target : null
        }).filter(Boolean))]
      )
      assert(destinations.length > 20, "Worlds destination coverage unexpectedly small")
      for (const destination of destinations) {
        await visit(page, "/work")
        await page.getByRole("button", { name: "More Jhadina worlds" }).click()
        // The href is CSS escaped using JSON quoting, and only local hrefs are accepted.
        const selected = page.getByRole("navigation", { name: "Jhadina worlds" })
          .locator('a[href=' + JSON.stringify(destination) + ']').first()
        await selected.click()
        // Security settings require a verified Supabase owner even though the
        // local production-bundle browser harness bypasses only middleware.
        // Do not treat a proper owner-auth redirect as a broken link.
        if (destination === "/settings/security") {
          await page.waitForURL(url => url.pathname === "/login" &&
            url.searchParams.get("next") === destination, { timeout: 15000 })
          assert.equal(await page.getByRole("navigation", { name: "Primary navigation" }).count(), 0,
            "The owner-login page must hide the shell")
          console.log("PASS owner-gated destination", destination)
          continue
        }
        await page.waitForURL(url => url.pathname + url.search === destination, { timeout: 15000 })
        await page.getByRole("navigation", { name: "Primary navigation" }).waitFor({ state: "visible" })
        assert(!(await page.locator("body").innerText()).includes("This page could not be found"),
          "Destination returned Next.js not found: " + destination)
        console.log("PASS shell destination", destination)
      }
      console.log("PASS shell destination traversal", destinations.length)
    }

    // Ask must remain interactive after its child effects and an unrelated
    // parent state update, then allow navigation out without a full reload.
    // This catches the artifact-reference callback render loop (#185).
    const askErrors = []
    const onAskError = error => askErrors.push(String(error))
    const onAskConsole = message => {
      if (message.type() === "error" && /maximum update depth|Minified React error #185/i.test(message.text()))
        askErrors.push(message.text())
    }
    page.on("pageerror", onAskError)
    page.on("console", onAskConsole)
    await visit(page, "/")
    await page.getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Ask", exact: true }).click()
    await page.waitForURL(url => url.pathname === "/ask-jhadina")
    const command = page.locator("#jhadina-command")
    await command.fill("Navigation responsiveness check")
    assert.equal(await command.inputValue(), "Navigation responsiveness check")
    await page.getByRole("button", { name: "Which social accounts should I work on right now?", exact: true }).click()
    assert.equal(await command.inputValue(), "Which social accounts should I work on right now?")
    await page.getByRole("button", { name: "More Jhadina worlds" }).click()
    await page.getByRole("navigation", { name: "Jhadina worlds" }).waitFor({ state: "visible" })
    await page.keyboard.press("Escape")
    await page.getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Home", exact: true }).click()
    await page.waitForURL(url => url.pathname === "/")
    assert.deepEqual(askErrors, [], "Ask runtime errors: " + askErrors.join("; "))
    page.off("pageerror", onAskError)
    page.off("console", onAskConsole)
    console.log("PASS", size.name, "Home -> Ask typing/example/menu -> Home; no runtime loop")

    // Real Pages Router destination, which mounts the shell separately from App Router.
    await visit(page, "/jhadinatv")
    await page.getByRole("navigation", { name: "Primary navigation" }).waitFor({ state: "visible" })
    await noHorizontalOverflow(page, size.name + " Pages Router")

    // Demo selection is local-only, even for unfinished subsystems.
    await visit(page, "/worlds/homebase")
    const demo = page.getByRole("region", { name: "Homebase demo" })
    await demo.waitFor({ state: "visible" })
    const preview = demo.getByRole("button", { name: "offline", exact: true })
    await preview.click()
    assert.equal(await preview.getAttribute("aria-pressed"), "true")
    assert((await demo.innerText()).includes("Demo · sample only"))

    await visit(page, "/login")
    assert.equal(await page.getByRole("navigation", { name: "Primary navigation" }).count(), 0,
      "Private login must not show OS navigation")
    assert(await page.getByRole("button", { name: /Unlock with Face ID \/ passkey/ }).count() === 1)
    await noHorizontalOverflow(page, size.name + " login")
    await page.screenshot({ path: new URL(size.name + "-login.png", out).pathname })
    console.log("PASS", size.name, "App/Pages nav, menu bounds/scroll, keyboard, demo, login")
    await page.close()
  }
} finally {
  await browser.close()
}
console.log("JH-UI Chromium viewport checks completed; physical iPhone/Face ID pending.")

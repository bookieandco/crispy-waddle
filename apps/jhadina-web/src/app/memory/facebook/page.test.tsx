import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import FacebookPersonalityImportPage from "./page"

describe("Facebook owner local export picker on iPhone", () => {
  it("shows a large active native Files input without MIME filtering or server-upload form", () => {
    const html = renderToStaticMarkup(createElement(FacebookPersonalityImportPage))
    expect(html).toContain("Choose Facebook ZIP or JSON from Files")
    expect(html).toContain('type="file"')
    expect(html).toContain('multiple=""')
    expect(html).not.toMatch(/<input[^>]+type="file"[^>]*accept=/)
    expect(html).not.toMatch(/<input[^>]+type="file"[^>]*disabled/)
    expect(html).toContain("Google Drive or On My iPhone in Files")
    expect(html).not.toContain('enctype="multipart/form-data"')
    expect(html).not.toContain('action="/api/personality/facebook/propose"')
  })
})

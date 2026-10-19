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
    // Drive is navigation only: native Files selection remains local, never server-uploaded.
    expect(html).toContain('href="https://drive.google.com/drive/my-drive"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain("The link only opens Google Drive")
    expect(html).not.toContain('enctype="multipart/form-data"')
    expect(html).not.toContain('action="/api/personality/facebook/propose"')
    expect(html).toContain("Local ZIP reading, sample coverage and writing-cue review need no Jhadina account login")
    expect(html).toContain("Saving a pending Memory note is separate")
    // The numeric review receipt control is gated by a successfully read archive.
    // Empty initial-state SSR must not render review controls or any private samples.
    expect(html).not.toContain("Copy numeric review receipt")
    expect(html).not.toContain('aria-label="Numeric-only review receipt"')
  })
})

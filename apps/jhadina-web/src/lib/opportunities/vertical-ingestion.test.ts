import { describe, expect, it } from "vitest"
import { assertProviderVertical } from "./vertical-ingestion"

describe("vertical ingestion provider gate", () => {
  it("accepts the registered normalization owner", () => {
    expect(() => assertProviderVertical("provider:overageos", "recovery")).not.toThrow()
    expect(() => assertProviderVertical("provider:placement-jobs", "employment")).not.toThrow()
  })

  it("rejects cross-vertical provider reuse", () => {
    expect(() => assertProviderVertical("provider:commerce-dropshipping", "employment")).toThrow(/registered for dropshipping/)
  })

  it("rejects unknown providers rather than inventing a source", () => {
    expect(() => assertProviderVertical("provider:not-real", "affiliate")).toThrow(/Unknown opportunity provider/)
  })
})

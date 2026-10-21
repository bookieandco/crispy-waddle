import { expect, it } from "vitest"
import { EMPTY_NOTEBOOK, exportResearchNotebook } from "./research-notebook"

it("exports complete notes with explicit provenance and no adoption or action authority", () => {
  const note = { ...EMPTY_NOTEBOOK, problem: "A question", evidence: "An unverified claim", counterevidence: "Contradictory finding" }
  const exported = JSON.parse(exportResearchNotebook(note, "2026-10-17T23:00:00Z"))
  expect(exported).toMatchObject({ ...note, schemaVersion: 1, status: "UNVERIFIED_WORKING_DRAFT", authority: "No external action authorized." })
  expect(exported.provenance).toContain("no independent source verification")
  expect(exported.adoption).toContain("Not an adopted")
  expect(EMPTY_NOTEBOOK.problem).toBe("")
})

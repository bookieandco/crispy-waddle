import { describe, it, expect } from "vitest"
import { createJhadinaApplication, getJhadinaApplication } from "./createJhadinaApplication"
import { getStorage } from "../routes/handlers"

describe("Jhadina application composition", () => {
  it("creates one coherent dependency graph", () => {
    const app = createJhadinaApplication()

    expect(app.storage).toBeDefined()
    expect(app.memoryRepo).toBeDefined()
    expect(app.reasoningRepo).toBeDefined()
    expect(app.timelineRepo).toBeDefined()
    expect(app.janet).toBeDefined()
  })

  it("shares the process application graph", () => {
    expect(getJhadinaApplication()).toBe(getJhadinaApplication())
  })

  it("shares storage across repositories in the composed graph", () => {
    const app = createJhadinaApplication()

    const repositories = [app.memoryRepo, app.reasoningRepo, app.timelineRepo] as unknown as Array<
      { storage?: unknown }
    >

    for (const repository of repositories) {
      expect(repository.storage).toBe(app.storage)
    }
  })

  it("uses the same storage instance from route handlers", () => {
    expect(getStorage()).toBe(getJhadinaApplication().storage)
  })
})

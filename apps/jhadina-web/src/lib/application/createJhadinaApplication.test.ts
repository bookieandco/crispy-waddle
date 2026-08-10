import { createJhadinaApplication, getJhadinaApplication } from "./createJhadinaApplication"

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

    // Repository constructors receive the same storage instance from the
    // composition root. The private field is intentionally inspected here so
    // a future refactor cannot silently split persistence between repositories.
    const repositories = [app.memoryRepo, app.reasoningRepo, app.timelineRepo] as Array<
      { storage?: unknown }
    >

    for (const repository of repositories) {
      expect(repository.storage).toBe(app.storage)
    }
  })
})

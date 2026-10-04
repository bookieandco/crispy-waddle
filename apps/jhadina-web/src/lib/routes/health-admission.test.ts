import {describe,expect,it} from "vitest"
import {classifyDurableMemoryFailure} from "./health-admission"

describe("durable memory admission diagnostics",()=>{
  it("classifies exhausted database storage",()=>{
    expect(classifyDurableMemoryFailure(new Error("FATAL 53100: could not extend file: No space left on device"))).toBe("DATABASE_STORAGE_EXHAUSTED")
  })
  it("classifies Postgres crash recovery",()=>{
    expect(classifyDurableMemoryFailure(new Error("57P03: the database system is not accepting connections; Hot standby mode is disabled"))).toBe("DATABASE_RECOVERY")
  })
  it("fails closed for unknown durable memory failures",()=>{
    expect(classifyDurableMemoryFailure(new Error("gateway unavailable"))).toBe("DURABLE_MEMORY_UNAVAILABLE")
  })
})

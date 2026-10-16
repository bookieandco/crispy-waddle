import {describe,expect,it} from "vitest"
import {uncommissionedAskApprovalStore} from "./uncommissioned-ask-approval"

describe("JH-CLOSE.03 production Ask approval boundary",()=>{
  it("never issues or grants an in-memory pending owner approval",async()=>{
    const store=uncommissionedAskApprovalStore()
    await expect(store.createPending({
      actionId:"ask-action-1",userId:"owner-1",type:"memory.propose",
      fingerprint:"exact-proposal",expiresAt:"2099-01-01T00:00:00Z",
    })).rejects.toThrow("NOT_COMMISSIONED")
    await expect(store.approve("receipt", "owner-1")).rejects.toThrow("NOT_COMMISSIONED")
    await expect(store.consume("receipt",{
      actionId:"ask-action-1",userId:"owner-1",type:"memory.propose",
      fingerprint:"exact-proposal",
    })).resolves.toBe(false)
  })
})

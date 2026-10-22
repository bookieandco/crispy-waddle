import {describe,it,expect} from "vitest"
import {assessLocalModelHost,MACBOOK_AUDIT} from "./model-host-audit"

describe("MacBook audit quarantine",()=>{
 it("marks the owner's Mac as unverified, not confirmed broken",()=>{
  expect(MACBOOK_AUDIT).toMatchObject({status:"AUDIT_REPAIR_PENDING",diagnosisVerified:false,inferenceReady:false})
  expect(assessLocalModelHost("owner-m1-macbook")).toMatchObject({
   readiness:"AUDIT_REPAIR_PENDING",permittedForCandidateConfiguration:false,
  })
 })
 it("requires explicitly identified alternate hosts",()=>{
  expect(assessLocalModelHost(undefined).readiness).toBe("HOST_ID_REQUIRED")
  expect(assessLocalModelHost("../mac").permittedForCandidateConfiguration).toBe(false)
  expect(assessLocalModelHost("approved-candidate-node")).toMatchObject({
   readiness:"ALTERNATE_HOST_IDENTIFIED_UNVERIFIED",permittedForCandidateConfiguration:true,auditIssue:null,
  })
 })
})

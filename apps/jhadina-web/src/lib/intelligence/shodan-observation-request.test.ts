import { describe, expect, it } from "vitest"
import { parseShodanObservationRequest } from "./shodan-observation-request"

describe("Shodan passive observation request",()=>{
 it("accepts only the declared passive read capabilities",()=>{
  for(const capability of ["host.read","internetdb.read","dns.read","search.read","history.read"]){
   expect(parseShodanObservationRequest({observationId:"obs-1",subjectId:"subject",capability}).capability).toBe(capability)
  }
 })
 it("rejects scanning mutation and unknown capabilities",()=>{
  for(const capability of ["scan.start","host.write","exploit.run","admin",""]){
   expect(()=>parseShodanObservationRequest({observationId:"obs-1",subjectId:"subject",capability})).toThrow(/NOT_READ_ONLY/)
  }
 })
 it("rejects malformed observation timestamps",()=>{
  expect(()=>parseShodanObservationRequest({observationId:"obs-1",subjectId:"subject",capability:"host.read",observedAt:"yesterday-ish"})).toThrow(/TIMESTAMP_INVALID/)
 })
})

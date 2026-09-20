import { describe, expect, it } from "vitest"
import { PupsonStuffCreativeIntelligenceAdapter } from "../lib/intelligence/jhadina-creative-ingress"

const request:any={
 actorId:"user-1",assetId:"asset-1",
 evidence:[{id:"asset:asset-1:image:0",source:"perception:image",observedAt:"2026-01-01T00:00:00Z",summary:"pet photo",immutable:true}],
 uncertainty:[],intent:"make this into a pet portrait"
}

describe("PupsonStuffCreativeIntelligenceAdapter",()=>{
 it("enters the existing POD workflow at photo_received",async()=>{
  let queued:any
  const adapter=new PupsonStuffCreativeIntelligenceAdapter({async enqueue(input){queued=input;return{receiptId:"creative-r1"}}},()=>new Date("2026-01-02T00:00:00Z"))
  const out=await adapter.ingest(request)
  expect(queued.job.stage).toBe("photo_received")
  expect(queued.job.status).toBe("queued")
  expect(queued.dispatch.event.type).toBe("creation.created")
  expect(queued.sourceAssetId).toBe("asset-1")
  expect(out.receiptId).toBe("creative-r1")
 })
 it("rejects evidence from another asset",async()=>{
  const adapter=new PupsonStuffCreativeIntelligenceAdapter({async enqueue(){return{receiptId:"x"}}})
  await expect(adapter.ingest({...request,evidence:[{...request.evidence[0],id:"asset:other:image:0"}]})).rejects.toThrow("EVIDENCE_NOT_ASSET_BOUND")
 })
 it("does not expose generation, fulfillment, or approval authority",()=>{
  const adapter:any=new PupsonStuffCreativeIntelligenceAdapter({async enqueue(){return{receiptId:"x"}}})
  expect(adapter.generate).toBeUndefined()
  expect(adapter.createOrder).toBeUndefined()
  expect(adapter.approve).toBeUndefined()
  expect(adapter.execute).toBeUndefined()
 })
})

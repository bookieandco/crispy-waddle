import {describe,it,expect} from "vitest"
import {parsePublicAccount,publicAccountMayBeSaved} from "./owner-public-connections"
import type {ExternalFeedCandidate} from "./connected-source-contract"
const item=(overrides:Partial<ExternalFeedCandidate>={}):ExternalFeedCandidate=>({
 provider:"bluesky",sourceAccount:"owner.bsky.social",externalId:"1",
 title:"Verified",summary:"Public",occurredAt:"2026-10-20T00:00:00Z",
 url:"https://bsky.app/profile/owner.bsky.social/post/123",
 provenance:["official public appview"],sourceTrust:"provider_verified",...overrides,
})
describe("owner public source connection",()=>{
 it("allows only fixed public providers and normalized handles",()=>{
  expect(parsePublicAccount({provider:"bluesky",handle:"@owner.bsky.social"})).toEqual({provider:"bluesky",handle:"owner.bsky.social"})
  expect(parsePublicAccount({provider:"github",handle:"@bookieandco"})).toEqual({provider:"github",handle:"bookieandco"})
  expect(()=>parsePublicAccount({provider:"tiktok",handle:"owner"})).toThrow("UNSUPPORTED")
  expect(()=>parsePublicAccount({provider:"github",handle:"localhost/foo"})).toThrow()
  expect(()=>parsePublicAccount({provider:"github",handle:"user",password:"secret"})).toThrow("FIELDS_INVALID")
 })
 it("requires a verified real post from exactly the requested source",()=>{
  const account={provider:"bluesky" as const,handle:"owner.bsky.social"}
  expect(publicAccountMayBeSaved([item()],account)).toBe(true)
  expect(publicAccountMayBeSaved([item({sourceTrust:"owner_unverified"})],account)).toBe(false)
  expect(publicAccountMayBeSaved([item({sourceAccount:"impostor.bsky.social"})],account)).toBe(false)
  expect(publicAccountMayBeSaved([],account)).toBe(false)
 })
})

import {describe,expect,it} from "vitest"
import {canonicalSelectedProfile,presentOwnerSelectedProfiles} from "./requested-account-contract"
const row={provider:"instagram",handle:"bookieandco",profile_url:"https://www.instagram.com/bookieandco/",
 status:"authorization_required",requested_at:"2026-10-21T23:00:00Z"}
describe("owner-requested social profiles",()=>{
 it("normalizes all five user-selected platform URLs without tracking parameters",()=>{
  expect(canonicalSelectedProfile("instagram","bookieandco")).toBe("https://www.instagram.com/bookieandco/")
  expect(canonicalSelectedProfile("x","atwoodbookie")).toBe("https://x.com/atwoodbookie")
  expect(canonicalSelectedProfile("tiktok","pupsonstuff")).toBe("https://www.tiktok.com/@pupsonstuff")
  expect(canonicalSelectedProfile("reddit","Double_Stage_1784")).toBe("https://www.reddit.com/user/Double_Stage_1784/")
  expect(canonicalSelectedProfile("facebook","avebookie")).toBe("https://www.facebook.com/avebookie")
 })
 it("never represents a submitted account as an authenticated connection",()=>{
  const result=presentOwnerSelectedProfiles([row])
  expect(result[0].status).toBe("authorization_required")
  expect(result[0].connection).toBe("not_connected")
  expect(result[0].profileUrl).toBe(row.profile_url)
 })
 it("rejects spoofed URLs, unsupported providers and mismatched grant statuses",()=>{
  expect(()=>presentOwnerSelectedProfiles([{...row,profile_url:"https://instagram.com.evil.invalid/profile"}])).toThrow("URL_MISMATCH")
  expect(()=>presentOwnerSelectedProfiles([{...row,status:"connected"}])).toThrow("STATUS_INVALID")
  expect(()=>canonicalSelectedProfile("facebook","https://attacker.invalid")).toThrow("HANDLE_INVALID")
  expect(()=>canonicalSelectedProfile("unknown","bookieandco")).toThrow("UNSUPPORTED")
 })
 it("rejects excessive collections and malformed timestamps",()=>{
  expect(()=>presentOwnerSelectedProfiles(Array(26).fill(row))).toThrow("RESULT_INVALID")
  expect(()=>presentOwnerSelectedProfiles([{...row,requested_at:"tomorrow-ish"}])).toThrow("DATE_INVALID")
 })
})

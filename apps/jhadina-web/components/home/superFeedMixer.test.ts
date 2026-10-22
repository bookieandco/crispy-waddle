import {describe,expect,it} from "vitest"
import {balancedSourceMix} from "./superFeedMixer"
type Item={source:"GitHub"|"Bluesky"|"YouTube";id:string}
const y=(id:string):Item=>({source:"YouTube",id})
const g=(id:string):Item=>({source:"GitHub",id})
const b=(id:string):Item=>({source:"Bluesky",id})
describe("SuperFeed-inspired source balance",()=>{
 it("does not starve an older social source in the balanced Home view",()=>{
  const rows=[y("1"),y("2"),y("3"),y("4"),g("5")]
  expect(balancedSourceMix(rows).map(x=>x.id)).toEqual(["1","5","2","3","4"])
 })
 it("returns exactly the original items, not duplicates or invented updates",()=>{
  const rows=[y("1"),g("2"),b("3"),y("4"),g("5")]
  const got=balancedSourceMix(rows)
  expect(got).toHaveLength(rows.length)
  expect(new Set(got).size).toBe(rows.length)
  expect(got.every(x=>rows.includes(x))).toBe(true)
 })
 it("can limit output, and does not mutate the provider records",()=>{
  const rows=[y("1"),y("2"),g("3")]
  expect(balancedSourceMix(rows,{limit:2}).map(x=>x.id)).toEqual(["1","3"])
  expect(rows.map(x=>x.id)).toEqual(["1","2","3"])
  expect(balancedSourceMix(rows,{limit:0})).toEqual([])
 })
 it("respects preferred maximum source streak when alternatives exist",()=>{
  const rows=[y("1"),y("2"),y("3"),y("4"),g("5"),g("6"),b("7")]
  const out=balancedSourceMix(rows,{minPerSource:0,maxStreak:2})
  expect(out.map(x=>x.id)).toEqual(["1","2","5","3","4","6","7"])
 })
})

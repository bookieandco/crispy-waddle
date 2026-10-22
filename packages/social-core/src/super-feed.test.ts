import { describe,expect,it } from "vitest"
import { mergePublicFeeds, publicFeedSource, publicFeedUrl, type PublicFeedResult } from "./super-feed"

const mk=(p:"github"|"youtube",id:string):PublicFeedResult=> {
 const source=publicFeedSource(p,id)
 return {source,state:"ok",items:Array.from({length:6},(_,i)=>({
   id:source.label+":"+i,sourceId:source.label,provider:p,title:"Item "+i,
   url:"https://example.com/"+p+"/"+i,publishedAt:new Date(Date.UTC(2026,9,21,12-i,0)).toISOString(),
   summary:"Read-only",provenance:"official_public_feed" as const,
 }))}
}
describe("SuperFeed-inspired authorized public feed coordination",()=>{
 it("permits only bounded canonical known-host source identifiers",()=>{
  expect(publicFeedUrl(publicFeedSource("github","BookieAndCo"))).toBe("https://github.com/bookieandco.atom")
  expect(publicFeedUrl(publicFeedSource("youtube","UC4fAVLUoIqgKkOV0JMAX7Rg"))).toContain("channel_id=UC4fAVLUoIqgKkOV0JMAX7Rg")
  expect(publicFeedUrl(publicFeedSource("wordpress","Pups"))).toBe("https://pups.wordpress.com/feed/")
  for(const invalid of ["127.0.0.1","user@localhost","https://localhost","user/path","user?x=1","a..b"])
    expect(()=>publicFeedSource("github",invalid)).toThrow()
 })
 it("limits dominant source streak and includes both sources before exhaustion",()=>{
  const results=[mk("github","bookieandco"),mk("youtube","UC4fAVLUoIqgKkOV0JMAX7Rg")]
  const output=mergePublicFeeds(results,{limit:10,minPerSource:2,streakLimit:2})
  expect(output).toHaveLength(10)
  expect(new Set(output.map(x=>x.provider))).toEqual(new Set(["github","youtube"]))
  for(let i=2;i<output.length;i++)expect(output.slice(i-2,i+1).every(x=>x.provider===output[i]!.provider)).toBe(false)
 })
 it("deduplicates links, rejects invalid dates and bounds item count",()=>{
  const input=mk("github","bookieandco")
  input.items.push({...input.items[0]!,id:"duplicate"})
  input.items.push({...input.items[0]!,url:"https://example.com/bad",publishedAt:"not-a-date"})
  expect(mergePublicFeeds([input],{limit:100})).toHaveLength(6)
  expect(mergePublicFeeds([input],{limit:1})).toHaveLength(1)
 })
})
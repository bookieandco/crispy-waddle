import {describe,it,expect,vi} from "vitest"
import {searchWikipediaPublic,validWikiQuery} from "./wikipedia-public-research"

const pages={query:{pages:[{
 pageid:42,title:"Example article",extract:"An encyclopedia description.",
 fullurl:"https://en.wikipedia.org/wiki/Example_article",
},{pageid:43,title:"Poisoned",extract:"evil",fullurl:"https://attacker.example/wiki/Poisoned"}]}}
describe("bounded owner-triggered wiki candidate search",()=>{
 it("only sends explicit public phrase to fixed Wikimedia HTTPS origin",async()=>{
  let requested=""
  let init:RequestInit|undefined
  const mock=vi.fn(async (url:RequestInfo|URL,options?:RequestInit)=>{
   requested=String(url);init=options
   return new Response(JSON.stringify(pages),{status:200})
  })
  const result=await searchWikipediaPublic("open model weights",mock as typeof fetch)
  expect(requested.startsWith("https://en.wikipedia.org/w/api.php?")).toBe(true)
  const u=new URL(requested)
  expect(u.searchParams.get("gsrsearch")).toBe("open model weights")
  expect(u.searchParams.get("gsrlimit")).toBe("5")
  expect(init?.redirect).toBe("error")
  expect(result.items).toHaveLength(1)
  expect(result.items[0]).toMatchObject({pageId:42,source:"EN_WIKIPEDIA",verified:false})
  expect(result.verified).toBe(false)
 })
 it("rejects invalid queries without network requests",async()=>{
  const mock=vi.fn()
  await expect(searchWikipediaPublic("ab",mock as typeof fetch)).rejects.toThrow(/QUERY_INVALID/)
  expect(mock).not.toHaveBeenCalled()
  expect(validWikiQuery("  A topic  ")).toBe("A topic")
 })
 it("does not report upstream errors as empty verified results",async()=>{
  const mock=vi.fn(async()=>new Response("busy",{status:503}))
  await expect(searchWikipediaPublic("topic",mock as typeof fetch)).rejects.toThrow(/UNAVAILABLE/)
 })
})

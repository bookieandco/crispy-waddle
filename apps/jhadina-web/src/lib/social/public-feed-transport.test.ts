import { describe,expect,it,vi } from "vitest"
import { publicFeedSource } from "@jhadina/social-core"
import { parsePublicFeedXml,readPublicFeed } from "./public-feed-transport"
const youtube=publicFeedSource("youtube","UC4fAVLUoIqgKkOV0JMAX7Rg")
describe("SuperFeed public transport",()=>{
 it("parses Atom source, drops unsafe javascript links and sanitizes markup",()=>{
  const xml=`<feed><entry><title>Nice &amp; <b>Safe</b></title><published>2026-10-21T14:00:00Z</published><link rel="alternate" href="https://www.youtube.com/watch?v=abc" /><summary><![CDATA[<script>no</script>new video]]></summary></entry><entry><title>Bad</title><published>2026-10-21T10:00:00Z</published><link href="javascript:alert(1)" /></entry></feed>`
  const rows=parsePublicFeedXml(youtube,xml)
  expect(rows).toHaveLength(1)
  expect(rows[0]!.title).toContain("Nice &")
  expect(rows[0]!.summary).not.toContain("<script>")
 })
 it("accepts RSS item and requires real dates",()=>{
  const source=publicFeedSource("wordpress","pups")
  const xml=`<rss><channel><item><title>Dog</title><pubDate>Wed, 21 Oct 2026 14:00:00 GMT</pubDate><link>https://pups.wordpress.com/dog/</link><description><![CDATA[<b>Hi</b>]]></description></item></channel></rss>`
  expect(parsePublicFeedXml(source,xml)[0]?.title).toBe("Dog")
 })
 it("will not request arbitrary target and forbids redirects",async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response("<feed/>",{headers:{"content-type":"application/atom+xml"}}))
  await readPublicFeed(youtube,fetcher)
  expect(fetcher).toHaveBeenCalledWith("https://www.youtube.com/feeds/videos.xml?channel_id=UC4fAVLUoIqgKkOV0JMAX7Rg",expect.objectContaining({redirect:"error",method:"GET"}))
 })
 it("does not claim items on upstream failure or huge bodies",async()=>{
  const denied=vi.fn().mockResolvedValue(new Response("no",{status:403}))
  expect((await readPublicFeed(youtube,denied)).state).toBe("unavailable")
  const big=vi.fn().mockResolvedValue(new Response("X".repeat(260000),{headers:{"content-type":"application/atom+xml"}}))
  expect((await readPublicFeed(youtube,big)).items).toEqual([])
 })
})
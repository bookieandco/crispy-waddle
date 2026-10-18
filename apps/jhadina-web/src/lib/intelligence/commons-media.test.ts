import { describe,expect,it } from "vitest"
import { parseCommonsImageInfo, parseCommonsSearchResult,searchCommonsImages,validCommonsSearchQuery } from "./commons-media"

const good={
  title:"File:Grand_library_interior.jpg",
  imageinfo:[{
    thumburl:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Grand_library_interior.jpg/800px-Grand_library_interior.jpg",
    mime:"image/jpeg",descriptionurl:"https://commons.wikimedia.org/wiki/File:Grand_library_interior.jpg",
    extmetadata:{
      LicenseShortName:{value:"CC BY-SA 4.0"},
      LicenseUrl:{value:"https://creativecommons.org/licenses/by-sa/4.0/"},
      Artist:{value:"<a>Test Contributor</a>"},
    },
  }],
}
describe("JLLM-VISUAL Wikimedia media provenance",()=>{
  it("reads only allowlisted attributed images from returned API pages",()=>{
    const parsed=parseCommonsImageInfo({query:{pages:[good]}})
    expect(parsed).toHaveLength(1)
    expect(parsed[0].author).toBe("Test Contributor")
    expect(parsed[0].provenance).toBe("WIKIMEDIA_COMMONS_SEARCH_CANDIDATE")
    const safe=parseCommonsSearchResult({query:"grand library",images:parsed,authority:"MEDIA_DISCOVERY_ONLY",relevanceVerified:false})
    expect(safe?.images).toHaveLength(1)
    expect(parseCommonsSearchResult({...safe,authority:"ACTION_EXECUTION"})).toBeNull()
    expect(parseCommonsSearchResult({...safe,relevanceVerified:true})).toBeNull()
  })
  it("rejects injection, uploads, SVG, unsupported license, unsafe domains and links",()=>{
    const bad=[
      {...good,title:"File:evil.svg"},
      {...good,imageinfo:[{...good.imageinfo[0],thumburl:"https://evil.example/picture.jpg"}]},
      {...good,imageinfo:[{...good.imageinfo[0],mime:"image/svg+xml"}]},
      {...good,imageinfo:[{...good.imageinfo[0],extmetadata:{...good.imageinfo[0].extmetadata,LicenseShortName:{value:"All Rights Reserved"}}}]},
      {...good,imageinfo:[{...good.imageinfo[0],descriptionurl:"https://evil.example/wiki/File:Something.jpg"}]},
    ]
    expect(parseCommonsImageInfo({query:{pages:bad}})).toEqual([])
    expect(validCommonsSearchQuery("<img>")).toBeNull()
    expect(validCommonsSearchQuery("a".repeat(121))).toBeNull()
    const original=parseCommonsImageInfo({query:{pages:[good]}})[0]
    expect(parseCommonsSearchResult({query:"test photos",images:[{...original,imageUrl:"https://example.org/a.jpg"}],authority:"MEDIA_DISCOVERY_ONLY",relevanceVerified:false})).toBeNull()
    expect(parseCommonsSearchResult({query:"test photos",images:[{...original,licenseUrl:"https://bad.example/license"}],authority:"MEDIA_DISCOVERY_ONLY",relevanceVerified:false})).toBeNull()
  })
  it("sends only the owner-entered query to the read-only Wikimedia endpoint",async()=>{
    let called=""
    let opts:RequestInit|undefined
    const mock=(async (input:RequestInfo|URL,init?:RequestInit)=>{
      called=String(input);opts=init
      return new Response(JSON.stringify({query:{pages:[good]}}),{status:200,headers:{"content-type":"application/json"}})
    }) as typeof fetch
    const response=await searchCommonsImages("grand library",mock)
    const url=new URL(called)
    expect(url.origin).toBe("https://commons.wikimedia.org")
    expect(url.searchParams.get("gsrsearch")).toBe("grand library")
    expect(url.searchParams.get("gsrnamespace")).toBe("6")
    expect(opts?.method).toBe("GET")
    expect(opts?.cache).toBe("no-store")
    expect(opts?.redirect).toBe("error")
    expect(new Headers(opts?.headers).get("User-Agent")).toContain("JhadinaVisualExplorer/1.0")
    expect(new Headers(opts?.headers).get("User-Agent")).toContain("github.com/bookieandco/crispy-waddle")
    expect(response.images).toHaveLength(1)
    expect(response.relevanceVerified).toBe(false)
  })
  it("fails closed on upstream provider errors",async()=>{
    await expect(searchCommonsImages("test photos",(async()=>new Response("unavailable",{status:503})) as typeof fetch)).rejects.toThrow("MEDIA_PROVIDER_UNAVAILABLE")
    await expect(searchCommonsImages("x",(async()=>new Response("x")) as typeof fetch)).rejects.toThrow("INVALID_MEDIA_QUERY")
  })
})

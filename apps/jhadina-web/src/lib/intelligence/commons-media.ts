/**
 * JLLM-VISUAL.05: opt-in, public Wikimedia Commons photograph lookup.
 * Media are search candidates, NOT evidence for claims in the JLLM answer.
 * Query leaves the device only after an explicit owner click.
 * No images or query history are persisted to Supabase/Memory.
 */
export type CommonsImage = {
  title: string
  imageUrl: string
  sourceUrl: string
  author: string
  license: string
  licenseUrl: string
  provenance: "WIKIMEDIA_COMMONS_SEARCH_CANDIDATE"
}
export type CommonsSearchResult = {
  query: string
  images: CommonsImage[]
  authority: "MEDIA_DISCOVERY_ONLY"
  relevanceVerified: false
}

const HOST = "commons.wikimedia.org"
const IMAGE_HOST = "upload.wikimedia.org"
const LICENSES = /^(?:CC0(?: [0-9.]+)?|CC BY(?:-SA)? [0-9.]+|Public domain|PD-[A-Za-z0-9 -]+)$/i

function safeUrl(input: unknown, host: string): string | null {
  if (typeof input !== "string" || input.length > 2000) return null
  try {
    const url = new URL(input)
    if (url.protocol !== "https:" || url.hostname !== host || url.port || url.username || url.password) return null
    return url.href
  } catch { return null }
}
function plain(value: unknown, max: number): string {
  if (typeof value !== "string") return ""
  return value.replace(/<[^>]*>/g," ").replace(/&(?:nbsp|amp|quot|lt|gt|#39);/g," ").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max)
}
function meta(info: Record<string,unknown>,key:string): string {
  const field = info[key]
  return field && typeof field === "object" && "value" in field ? String((field as {value:unknown}).value ?? "") : ""
}
export function validCommonsSearchQuery(query: unknown): string | null {
  if (typeof query !== "string") return null
  const normalized = query.replace(/\s+/g," ").trim()
  if (normalized.length < 3 || normalized.length > 120 || /[\u0000-\u001f\u007f<>]/.test(normalized)) return null
  return normalized
}
export function parseCommonsImageInfo(raw: unknown): CommonsImage[] {
  if (!raw || typeof raw !== "object") return []
  const pages = (raw as {query?:{pages?:Record<string,unknown>}}).query?.pages
  if (!pages || typeof pages !== "object") return []
  const candidates: CommonsImage[]=[]
  for(const candidate of Object.values(pages)) {
    if (!candidate || typeof candidate !== "object") continue
    const page=candidate as {title?:unknown;imageinfo?:unknown}
    if(typeof page.title!=="string" || !/^File:[^<>]{3,220}\.(?:jpe?g|png|webp)$/i.test(page.title))continue
    const entries=Array.isArray(page.imageinfo)?page.imageinfo:[]
    const image=entries[0] as Record<string,unknown> | undefined
    if(!image || typeof image!=="object" || !["image/jpeg","image/png","image/webp"].includes(String(image.mime)))continue
    const imageUrl=safeUrl(image.thumburl ?? image.url,IMAGE_HOST)
    const sourceUrl=safeUrl(image.descriptionurl,HOST)
    if(!imageUrl || !sourceUrl || !new URL(sourceUrl).pathname.startsWith("/wiki/File:"))continue
    if(!new URL(imageUrl).pathname.startsWith("/wikipedia/commons/"))continue
    const metadata=image.extmetadata
    if(!metadata || typeof metadata!=="object")continue
    const md=metadata as Record<string,unknown>
    const license=plain(meta(md,"LicenseShortName"),70)
    const licenseUrl=safeUrl(meta(md,"LicenseUrl"),"creativecommons.org")
    if(!LICENSES.test(license) || !licenseUrl)continue
    if(!/^\/(?:licenses\/(?:by|by-sa)\/|publicdomain\/(?:zero|mark)\/)/.test(new URL(licenseUrl).pathname))continue
    const author=plain(meta(md,"Artist"),130)||"See file attribution"
    candidates.push({
      title:plain(page.title.slice(5).replace(/\.[^.]+$/,"").replace(/_/g," "),160),
      imageUrl,sourceUrl,author,license,licenseUrl,
      provenance:"WIKIMEDIA_COMMONS_SEARCH_CANDIDATE",
    })
    if(candidates.length===6)break
  }
  return candidates
}
export async function searchCommonsImages(
  rawQuery:unknown,
  fetchImpl:typeof fetch=fetch,
):Promise<CommonsSearchResult>{
  const query=validCommonsSearchQuery(rawQuery)
  if(!query)throw new Error("INVALID_MEDIA_QUERY")
  const url=new URL("https://commons.wikimedia.org/w/api.php")
  for(const [k,v] of Object.entries({
    action:"query",format:"json",formatversion:"2",generator:"search",
    gsrsearch:query,gsrnamespace:"6",gsrlimit:"6",
    prop:"imageinfo",iiprop:"url|mime|extmetadata",
    iiextmetadatafilter:"LicenseShortName|LicenseUrl|Artist",
    iiurlwidth:"800",
  }))url.searchParams.set(k,v)
  const response=await fetchImpl(url.href,{
    method:"GET",cache:"no-store",redirect:"error",
    headers:{Accept:"application/json"},
    signal:AbortSignal.timeout(7000),
  })
  if(!response.ok)throw new Error("MEDIA_PROVIDER_UNAVAILABLE")
  const size=Number(response.headers.get("content-length")??0)
  if(size>512000)throw new Error("MEDIA_RESPONSE_TOO_LARGE")
  const body=await response.text()
  if(body.length>512000)throw new Error("MEDIA_RESPONSE_TOO_LARGE")
  const parsed:unknown=JSON.parse(body)
  return {query,images:parseCommonsImageInfo(parsed),authority:"MEDIA_DISCOVERY_ONLY",relevanceVerified:false}
}
/** The browser also validates the response: no untrusted src or href reaches an element. */
export function parseCommonsSearchResult(raw:unknown):CommonsSearchResult|null{
  if(!raw || typeof raw!=="object")return null
  const result=raw as Record<string,unknown>
  if(result.authority!=="MEDIA_DISCOVERY_ONLY" || result.relevanceVerified!==false || !validCommonsSearchQuery(result.query))return null
  if(!Array.isArray(result.images) || result.images.length>6)return null
  const images:CommonsImage[]=[]
  for(const value of result.images){
    if(!value || typeof value!=="object")return null
    const item=value as Record<string,unknown>
    const imageUrl=safeUrl(item.imageUrl,IMAGE_HOST)
    const sourceUrl=safeUrl(item.sourceUrl,HOST)
    const licenseUrl=safeUrl(item.licenseUrl,"creativecommons.org")
    if(!imageUrl || !sourceUrl || !licenseUrl || item.provenance!=="WIKIMEDIA_COMMONS_SEARCH_CANDIDATE")return null
    if(!/^\/(?:licenses\/(?:by|by-sa)\/|publicdomain\/(?:zero|mark)\/)/.test(new URL(licenseUrl).pathname))return null
    if(!new URL(imageUrl).pathname.startsWith("/wikipedia/commons/") || !new URL(sourceUrl).pathname.startsWith("/wiki/File:"))return null
    if(typeof item.title!=="string" || typeof item.author!=="string" || typeof item.license!=="string" || !LICENSES.test(item.license))return null
    images.push({title:plain(item.title,160),author:plain(item.author,130),license:plain(item.license,70),imageUrl,sourceUrl,licenseUrl,provenance:"WIKIMEDIA_COMMONS_SEARCH_CANDIDATE"})
  }
  return {query:result.query as string,images,authority:"MEDIA_DISCOVERY_ONLY",relevanceVerified:false}
}

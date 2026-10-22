/** Bounded, opt-in, read-only encyclopedia lookup.
 * Returned extracts are source candidates, not independently verified facts.
 * Search query never includes the user's private chat, files or Memory.
 */
export type WikiSource={pageId:number;title:string;url:string;summary:string;source:"EN_WIKIPEDIA";verified:false}
export type WikiResearchResult={query:string;items:WikiSource[];authority:"READ_ONLY_SOURCE_CANDIDATES";verified:false}
export function validWikiQuery(raw:unknown):string|null{
 if(typeof raw!=="string")return null
 const q=raw.replace(/\s+/g," ").trim()
 return q.length>=3&&q.length<=120&&!/[\x00-\x1f]/.test(q)?q:null
}
export async function searchWikipediaPublic(q:string,fetchImpl:typeof fetch=fetch):Promise<WikiResearchResult>{
 const query=validWikiQuery(q)
 if(!query)throw Error("WIKIPEDIA_QUERY_INVALID")
 const url=new URL("https://en.wikipedia.org/w/api.php")
 const params={
  action:"query",format:"json",formatversion:"2",generator:"search",
  gsrsearch:query,gsrlimit:"5",gsrnamespace:"0",prop:"extracts|info",
  exintro:"1",explaintext:"1",exlimit:"max",inprop:"url",
 }
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v)
 const response=await fetchImpl(url.href,{
  method:"GET",redirect:"error",cache:"no-store",
  headers:{Accept:"application/json","User-Agent":"JhadinaResearch/1.0 (https://github.com/bookieandco/crispy-waddle)"},
  signal:AbortSignal.timeout(8000),
 })
 if(!response.ok)throw Error("WIKIPEDIA_PROVIDER_UNAVAILABLE")
 if(Number(response.headers.get("content-length")||0)>500_000)throw Error("WIKIPEDIA_RESPONSE_TOO_LARGE")
 const text=await response.text()
 if(text.length>500_000)throw Error("WIKIPEDIA_RESPONSE_TOO_LARGE")
 const parsed=JSON.parse(text) as {query?:{pages?:unknown}}
 const rows=Array.isArray(parsed.query?.pages)?parsed.query.pages:[]
 const items:WikiSource[]=[]
 for(const raw of rows.slice(0,5)){
  if(!raw||typeof raw!=="object")continue
  const page=raw as Record<string,unknown>
  const id=page.pageid,title=page.title,extract=page.extract,fullurl=page.fullurl
  if(!Number.isInteger(id)||typeof title!=="string"||!title.trim()||typeof extract!=="string")continue
  if(typeof fullurl!=="string")continue
  let source:URL
  try{source=new URL(fullurl)}catch{continue}
  if(source.protocol!=="https:"||source.hostname!=="en.wikipedia.org"||!source.pathname.startsWith("/wiki/")||source.username||source.password)continue
  items.push({pageId:id as number,title:title.slice(0,160),
   url:source.href,summary:extract.replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim().slice(0,900),
   source:"EN_WIKIPEDIA",verified:false})
 }
 return {query,items,authority:"READ_ONLY_SOURCE_CANDIDATES",verified:false}
}

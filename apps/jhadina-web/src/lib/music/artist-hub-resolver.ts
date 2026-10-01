import {
  ATWOOD_BOOKIE_CANONICAL_HUB,
  resolveArtistHubLinks,
  type ResolvedArtistLink,
} from '@jhadina/growth-core';

export interface ArtistHubResolution {
  hubUrl:string;
  fetched:boolean;
  outboundLinks:readonly string[];
  resolvedLinks:readonly ResolvedArtistLink[];
  warnings:readonly string[];
  observedAt:string;
}

export async function resolveAtwoodBookieHub(input:{
  fetchImpl?:typeof fetch;
  now?:()=>Date;
}={}):Promise<ArtistHubResolution> {
  const fetchImpl=input.fetchImpl??fetch;
  const now=input.now??(()=>new Date());
  const observedAt=now().toISOString();
  try{
    const response=await fetchImpl(ATWOOD_BOOKIE_CANONICAL_HUB,{
      method:'GET',
      redirect:'follow',
      headers:{
        accept:'text/html,application/xhtml+xml',
        'user-agent':'Jhadina-Music-Commission/1.0 (+owner-declared artist hub)',
      },
      cache:'no-store',
    });
    if(!response.ok)throw new Error('HTTP_'+response.status);
    const html=await response.text();
    const outboundLinks=extractHubLinksFromHtml(html,ATWOOD_BOOKIE_CANONICAL_HUB);
    return Object.freeze({
      hubUrl:ATWOOD_BOOKIE_CANONICAL_HUB,
      fetched:true,
      outboundLinks,
      resolvedLinks:resolveArtistHubLinks(outboundLinks,ATWOOD_BOOKIE_CANONICAL_HUB),
      warnings:Object.freeze([]),
      observedAt,
    });
  }catch(error){
    return Object.freeze({
      hubUrl:ATWOOD_BOOKIE_CANONICAL_HUB,
      fetched:false,
      outboundLinks:Object.freeze([]),
      resolvedLinks:Object.freeze([]),
      warnings:Object.freeze(['Artist hub fetch unavailable: '+safeMessage(error)+'. Existing verified sources remain usable; no links are fabricated.']),
      observedAt,
    });
  }
}

export function extractHubLinksFromHtml(html:string,baseUrl:string):readonly string[] {
  const links:string[]=[];
  const seen=new Set<string>();
  const pattern=/\bhref\s*=\s*["']([^"'#]+)["']/gi;
  for(const match of html.matchAll(pattern)){
    const raw=match[1]?.trim();
    if(!raw)continue;
    try{
      const url=new URL(raw,baseUrl);
      if(url.protocol!=='https:'&&url.protocol!=='http:')continue;
      url.hash='';
      const normalized=url.toString().replace(/\/$/,'');
      if(normalized===baseUrl||seen.has(normalized))continue;
      seen.add(normalized);
      links.push(normalized);
    }catch{
      continue;
    }
  }
  return Object.freeze(links);
}

function safeMessage(error:unknown):string {
  return error instanceof Error?error.message:'unknown error';
}

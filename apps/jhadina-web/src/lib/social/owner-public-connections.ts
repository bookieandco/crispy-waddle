import {readBlueskyPublicAuthor,readMastodonPublicAuthor,readGitHubPublicActivity,safePublicHandle,safeGitHubUsername} from "./public-feed-adapters"
import type {ExternalFeedCandidate} from "./connected-source-contract"

export type PublicAccountProvider="bluesky"|"mastodon"|"github"
export const PUBLIC_ACCOUNT_PROVIDERS:readonly PublicAccountProvider[]=["bluesky","mastodon","github"]

/** Public-only. This is NOT OAuth and does not verify ownership of an account. */
export function parsePublicAccount(input:unknown):{provider:PublicAccountProvider;handle:string}{
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("PUBLIC_ACCOUNT_INVALID")
 const v=input as Record<string,unknown>
 if(Object.keys(v).some(k=>k!=="provider"&&k!=="handle"))throw Error("PUBLIC_ACCOUNT_FIELDS_INVALID")
 if(v.provider!=="bluesky"&&v.provider!=="mastodon"&&v.provider!=="github")throw Error("PUBLIC_ACCOUNT_PROVIDER_UNSUPPORTED")
 if(typeof v.handle!=="string")throw Error("PUBLIC_ACCOUNT_HANDLE_INVALID")
 const handle=v.provider==="github"?safeGitHubUsername(v.handle):safePublicHandle(v.handle)
 if(handle.length>200)throw Error("PUBLIC_ACCOUNT_HANDLE_INVALID")
 return {provider:v.provider,handle}
}
export function publicAccountMayBeSaved(items:readonly ExternalFeedCandidate[],account:{provider:PublicAccountProvider;handle:string}){
 return items.length>0&&items.some(item=>
  item.sourceTrust==="provider_verified"&&
  item.provider===account.provider&&
  item.sourceAccount.toLowerCase()===account.handle.toLowerCase()
 )
}
export async function readPublicAccount(account:{provider:PublicAccountProvider;handle:string}){
 switch(account.provider){
  case "bluesky":return readBlueskyPublicAuthor(account.handle)
  case "mastodon":return readMastodonPublicAuthor({handle:account.handle})
  case "github":return readGitHubPublicActivity(account.handle)
 }
}

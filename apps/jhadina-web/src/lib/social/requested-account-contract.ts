/** An owner-entered profile address is only a pending selection.
 * Do not use it as evidence of OAuth, Meta page ownership, private feeds,
 * publisher scopes or permission to train on a user's activity.
 */
export type PendingSocialProvider="instagram"|"x"|"tiktok"|"reddit"|"facebook"
export type SelectedSocialProfile={
 provider:PendingSocialProvider;handle:string;profileUrl:string;
 status:"authorization_required";connection:"not_connected";requestedAt:string
}
type Row={provider:unknown;handle:unknown;profile_url:unknown;status:unknown;requested_at:unknown}
const handles:Record<PendingSocialProvider,RegExp>={
 instagram:/^[A-Za-z0-9._]{1,30}$/,
 x:/^[A-Za-z0-9_]{1,15}$/,
 tiktok:/^[A-Za-z0-9._]{1,24}$/,
 reddit:/^[A-Za-z0-9_-]{3,20}$/,
 facebook:/^[A-Za-z0-9.]{1,60}$/,
}
export function canonicalSelectedProfile(provider:unknown,handle:unknown):string{
 if(typeof provider!=="string"||!Object.prototype.hasOwnProperty.call(handles,provider))
  throw Error("SELECTED_PROFILE_PLATFORM_UNSUPPORTED")
 const p=provider as PendingSocialProvider
 if(typeof handle!=="string"||!handles[p].test(handle)||handle==="."||handle==="..")
  throw Error("SELECTED_PROFILE_HANDLE_INVALID")
 const path=encodeURIComponent(handle)
 switch(p){
  case "instagram":return "https://www.instagram.com/"+path+"/"
  case "x":return "https://x.com/"+path
  case "tiktok":return "https://www.tiktok.com/@"+path
  case "reddit":return "https://www.reddit.com/user/"+path+"/"
  case "facebook":return "https://www.facebook.com/"+path
 }
}
export function presentOwnerSelectedProfiles(raw:unknown):SelectedSocialProfile[]{
 if(!Array.isArray(raw)||raw.length>25)throw Error("SELECTED_PROFILE_RESULT_INVALID")
 return raw.map((input:unknown)=>{
  if(!input||typeof input!=="object"||Array.isArray(input))
   throw Error("SELECTED_PROFILE_ROW_INVALID")
  const row=input as Row
  const canonical=canonicalSelectedProfile(row.provider,row.handle)
  if(typeof row.profile_url!=="string"||row.profile_url!==canonical)
   throw Error("SELECTED_PROFILE_URL_MISMATCH")
  if(row.status!=="authorization_required")throw Error("SELECTED_PROFILE_STATUS_INVALID")
  if(typeof row.requested_at!=="string"||!Number.isFinite(Date.parse(row.requested_at)))
   throw Error("SELECTED_PROFILE_DATE_INVALID")
  return {provider:row.provider as PendingSocialProvider,handle:row.handle as string,
   profileUrl:canonical,status:"authorization_required" as const,
   connection:"not_connected" as const,requestedAt:row.requested_at}
 })
}

import {assertOwnerUuid,assertFeedStoreCommissioned} from "./feed-storage-gate"
import {normalizeFeedCandidate,type ExternalFeedCandidate,type FeedSourceConnection} from "./connected-source-contract"

/** Pure sync contract. No Supabase client, scheduler, OAuth token or writes here.
 * The caller must be a separately authorized server adapter after live commissioning.
 */
export type FeedSyncSnapshot={
 ownerId:string;storage:{flag?:string;ref?:string;configuredUrl?:string};
 connection:FeedSourceConnection;requestedAccount:string;
 verifiedProviderRead:boolean;ownerConsent:boolean;verifiedOwnerGrant:boolean;
 storedCursorAtRead:string|null;nextCursorBefore:string|null;nextCursorAfter:string|null;
 items:readonly ExternalFeedCandidate[];observedAt:string
}
export type FeedSyncWrite={
 user_id:string;provider:ExternalFeedCandidate["provider"];source_account:string;
 external_id:string;title:string;summary:string;occurred_at:string;url:string;
 provenance:string[];source_trust:"provider_verified";expires_at:string
}
export type FeedSyncPlan={
 connectionKey:string;cursorBefore:string|null;cursorAfter:string|null;
 writes:FeedSyncWrite[];observedAt:string;expiresAt:string
}
function cursor(value:string|null){
 if(value!==null&&(typeof value!=="string"||value.length>1024))throw Error("FEED_SYNC_CURSOR_INVALID")
}
const DAY_MS=86400000
export function buildVerifiedFeedSyncPlan(snapshot:FeedSyncSnapshot):FeedSyncPlan{
 assertFeedStoreCommissioned(snapshot.storage)
 assertOwnerUuid(snapshot.ownerId)
 const c=snapshot.connection
 if(!snapshot.ownerConsent)throw Error("FEED_SYNC_OWNER_CONSENT_REQUIRED")
 if(!snapshot.verifiedProviderRead)throw Error("FEED_SYNC_PROVIDER_NOT_VERIFIED")
 if(c.state!=="healthy")throw Error("FEED_SYNC_SOURCE_NOT_HEALTHY")
 if(c.capability==="none")throw Error("FEED_SYNC_SOURCE_NOT_AUTHORIZED")
 if(c.capability==="authorized_owner_read"&&
    (!snapshot.verifiedOwnerGrant||c.grantedScopes.length===0))
   throw Error("FEED_SYNC_PROVIDER_GRANT_NOT_VERIFIED")
 if(c.capability==="public_read"&&snapshot.verifiedOwnerGrant)
   throw Error("FEED_SYNC_GRANT_TYPE_MISMATCH")
 if(c.identityLabel!==snapshot.requestedAccount)throw Error("FEED_SYNC_SOURCE_MISMATCH")
 if(!snapshot.requestedAccount.trim()||snapshot.requestedAccount.length>200)
   throw Error("FEED_SYNC_SOURCE_MISMATCH")
 cursor(snapshot.storedCursorAtRead);cursor(snapshot.nextCursorBefore);cursor(snapshot.nextCursorAfter)
 if(snapshot.storedCursorAtRead!==snapshot.nextCursorBefore)
  throw Error("FEED_SYNC_STALE_CURSOR")
 const now=Date.parse(snapshot.observedAt)
 if(!Number.isFinite(now)||now>Date.now()+300000)throw Error("FEED_SYNC_OBSERVATION_TIME_INVALID")
 if(snapshot.items.length>25)throw Error("FEED_SYNC_RESULT_LIMIT")
 const seen=new Set<string>()
 const writes:FeedSyncWrite[]=[]
 const expiresAt=new Date(now+30*DAY_MS).toISOString()
 for(const raw of snapshot.items){
  // Calling normalizeFeedCandidate alone upgrades input to provider_verified.
  // Check original transport trust before normalizing.
  if(raw.sourceTrust!=="provider_verified")throw Error("FEED_SYNC_UNVERIFIED_ITEM")
  const verified=normalizeFeedCandidate(raw)
  if(verified.provider!==c.provider||verified.sourceAccount!==snapshot.requestedAccount)
    throw Error("FEED_SYNC_ITEM_SOURCE_MISMATCH")
  if(Date.parse(verified.occurredAt)>now+300000)
    throw Error("FEED_SYNC_ITEM_FUTURE_DATED")
  const dedup=verified.provider+"|"+verified.externalId
  if(seen.has(dedup))continue
  seen.add(dedup)
  writes.push({
   user_id:snapshot.ownerId,provider:verified.provider,source_account:verified.sourceAccount,
   external_id:verified.externalId,title:verified.title,summary:verified.summary,
   occurred_at:verified.occurredAt,url:verified.url,
   provenance:[...verified.provenance],source_trust:"provider_verified",expires_at:expiresAt,
  })
 }
 return {connectionKey:[snapshot.ownerId,c.provider,snapshot.requestedAccount].join("|"),
  cursorBefore:snapshot.nextCursorBefore,cursorAfter:snapshot.nextCursorAfter,
  writes,observedAt:new Date(now).toISOString(),expiresAt}
}
/** Compute bounded retry proposal; does not sleep, enqueue, persist, or advance cursor. */
export function proposeFeedRetry(input:{
 attempt:number;observedAt:string;cursor:string|null;errorCode:string
}){
 if(!Number.isInteger(input.attempt)||input.attempt<1||input.attempt>4)
  throw Error("FEED_SYNC_RETRY_EXHAUSTED")
 cursor(input.cursor)
 if(!/^[A-Z][A-Z0-9_]{1,79}$/.test(input.errorCode))
  throw Error("FEED_SYNC_FAILURE_CODE_INVALID")
 const now=Date.parse(input.observedAt)
 if(!Number.isFinite(now))throw Error("FEED_SYNC_OBSERVATION_TIME_INVALID")
 const delays=[15,60,240,1440] as const
 return {status:"retry" as const,cursorAfter:input.cursor,
  retryAt:new Date(now+delays[input.attempt-1]*60000).toISOString(),
  failureCode:input.errorCode}
}

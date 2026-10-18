/** SHARK-ALPHA.FABRIC.16 — owner-operated iPhone acceptance contract.
 * Checking UI boxes is useful local evidence but can never independently prove
 * actual iPhone execution, a running host, source authorization, or delivery.
 */
export const ALPHA_IPHONE_CHECKS=[
 {id:'portrait' as const,label:'Portrait layout works without sideways scrolling'},
 {id:'tap' as const,label:'Files and controls are usable by touch'},
 {id:'snapshot' as const,label:'Read-only Alpha Board JSON opens locally'},
 {id:'refusal' as const,label:'Invalid JSON is rejected without upload'},
 {id:'privacy' as const,label:'No social messages, credentials or owner identities are displayed'},
 {id:'no_trade' as const,label:'No buy, sell, wallet or auto-snipe action exists'},
 {id:'accessibility' as const,label:'Warnings and candidate labels are legible'},
 {id:'reconnect' as const,label:'Disconnected feeds do not claim full coverage'},
] as const
export type AlphaIphoneCheckId=typeof ALPHA_IPHONE_CHECKS[number]['id']
export type AlphaLocalAcceptance=Readonly<{
 schema:'SHARK_ALPHA_IPHONE_ACCEPT_V1'
 recordedAt:string
 deviceClaim:'IPHONE_SAFARI_OWNER_REPORTED'
 checks:Readonly<Record<AlphaIphoneCheckId,boolean>>
 passed:number
 total:8
 status:'LOCAL_SELF_CHECK_NOT_CERTIFIED'
 realProviderDeliveryVerified:false
 independentDeviceAcceptanceVerified:false
 productionCommissioned:false
 canTrade:false
}>
export function createAlphaLocalAcceptance(input:Readonly<{
 recordedAt:string
 selected:readonly AlphaIphoneCheckId[]
}>):AlphaLocalAcceptance{
 if(!/^\d{4}-\d\d-\d\dT/.test(input.recordedAt)||!Number.isFinite(Date.parse(input.recordedAt))||
   input.selected.length>ALPHA_IPHONE_CHECKS.length||
   input.selected.some(v=>!ALPHA_IPHONE_CHECKS.some(c=>c.id===v))||
   new Set(input.selected).size!==input.selected.length)
    throw new Error('shark_alpha_iphone_acceptance_invalid')
 const selected=new Set(input.selected)
 const checks=Object.fromEntries(ALPHA_IPHONE_CHECKS.map(c=>[c.id,selected.has(c.id)])) as Record<AlphaIphoneCheckId,boolean>
 return Object.freeze({
   schema:'SHARK_ALPHA_IPHONE_ACCEPT_V1' as const,recordedAt:input.recordedAt,
   deviceClaim:'IPHONE_SAFARI_OWNER_REPORTED' as const,checks:Object.freeze(checks),
   passed:input.selected.length,total:8 as const,
   status:'LOCAL_SELF_CHECK_NOT_CERTIFIED' as const,
   realProviderDeliveryVerified:false as const,
   independentDeviceAcceptanceVerified:false as const,
   productionCommissioned:false as const,canTrade:false as const,
 })
}

import { JHADINA_WORLDS } from "@/lib/jhadina/jhadina-world-registry"

/** Continue useful Jhadina work when no verified inference host exists.
 * A link is only navigation to an existing workspace, never proof its
 * external integrations or action capabilities are commissioned.
 */
const SAFE_WORLD_IDS=new Set(["home","work","activity","memory","health"])
export function getNoHostOperatingPlan(){
 const workspaces=JHADINA_WORLDS.filter(world=>SAFE_WORLD_IDS.has(world.id)&&world.href)
  .map(world=>({id:world.id,label:world.label,href:world.href!,description:world.description,
   access:"NAVIGATION_ONLY" as const}))
 return Object.freeze({
  mode:"NO_VERIFIED_REASONING_HOST" as const,
  liveGeneralModel:false,
  automaticCloudFallback:false,
  executionAuthority:"NONE" as const,
  publicLookup:"USER_TRIGGERED_ONLY" as const,
  workspaces,
  disclaimer:"Opening a workspace is not evidence that its backing services or permissions are active.",
 })
}

import { routeDoctorIntent, type DoctorIntent } from "@jhadina/evolution-core"

export interface AskDoctorIntent {
  intent: DoctorIntent
  subsystemId: string
  explicitApproval: boolean
}

const SUBSYSTEM_ALIASES: Record<string,string> = {
  sports:"sports", betting:"sports-betting", money:"money", shark:"shark",
  overage:"overage", overages:"overage", sam:"sam", director:"director",
  media:"media", social:"social", growth:"growth", safety:"safety",
  pupsonstuff:"pupsonstuff", jllm:"jllm", jhadina:"jllm",
}

export function inspectAskDoctorIntent(message:string):AskDoctorIntent|null {
  const value=message.trim().toLowerCase()
  if(!/\b(broken|break|error|failing|failed|diagnos|repair|fix|what.?s wrong)\b/.test(value)) return null
  const subsystem=Object.keys(SUBSYSTEM_ALIASES).find((key)=>new RegExp(`\\b${key}\\b`).test(value))
  if(!subsystem) return null
  return {
    intent:routeDoctorIntent(value),
    subsystemId:SUBSYSTEM_ALIASES[subsystem]!,
    // Natural-language "fix" requests propose repairs only. Approval must arrive
    // as a separate governed Security Core receipt, never from model interpretation.
    explicitApproval:false,
  }
}

export function doctorProposal(input:AskDoctorIntent){
  const action=input.intent==="diagnose_subsystem"?"diagnose":"prepare a governed repair proposal for"
  return {
    disposition:"DEFER" as const,
    recommendation:`Jhadina can ${action} the ${input.subsystemId} subsystem. Execution has not been authorized.`,
    rationale:"Subsystem Doctor requires runtime evidence and an independent Security Core approval before any repair executor can change code.",
    doctorIntent:input,
  }
}

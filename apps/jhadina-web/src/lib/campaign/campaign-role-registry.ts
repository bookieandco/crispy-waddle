export type CampaignDepartment =
  | "executive"
  | "political"
  | "field"
  | "communications"
  | "finance"
  | "digital"
  | "technology"
  | "legal"
  | "research"
  | "policy"
  | "ballot_access"
  | "volunteer"
  | "advance"
  | "security"

export type CampaignApprovalClass =
  | "observe"
  | "recommend"
  | "draft"
  | "approve"
  | "execute"

export type CampaignRole = {
  id: string
  title: string
  department: CampaignDepartment
  responsibilities: string[]
  allowedClasses: CampaignApprovalClass[]
  requiresHumanApprovalFor: CampaignApprovalClass[]
}

export const CAMPAIGN_ROLES: CampaignRole[] = [
  { id: "campaign_manager", title: "Campaign Manager", department: "executive", responsibilities: ["national strategy", "budget oversight", "senior staff coordination"], allowedClasses: ["observe", "recommend", "draft", "approve"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "deputy_campaign_manager", title: "Deputy Campaign Manager", department: "executive", responsibilities: ["daily operations", "cross-department coordination", "execution tracking"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "senior_strategist", title: "Senior Strategist / Advisor", department: "executive", responsibilities: ["strategy", "debate preparation", "crisis analysis"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "national_field_director", title: "National Field Director", department: "field", responsibilities: ["field operations", "volunteer mobilization", "field performance"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "state_director", title: "Regional / State Director", department: "political", responsibilities: ["state operations", "local adaptation", "state reporting"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "political_director", title: "Political Director", department: "political", responsibilities: ["coalition relationships", "endorsement intelligence", "political outreach"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "communications_director", title: "Communications Director", department: "communications", responsibilities: ["message framework", "media strategy", "public communications"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "press_secretary", title: "Press Secretary", department: "communications", responsibilities: ["press briefings", "media inquiries", "press coordination"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "rapid_response_director", title: "Rapid Response Director", department: "communications", responsibilities: ["monitoring", "claim verification", "response drafting"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "speechwriter", title: "Speechwriter", department: "communications", responsibilities: ["speeches", "remarks", "debate language"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "national_finance_director", title: "National Finance Director", department: "finance", responsibilities: ["fundraising strategy", "finance operations", "budget visibility"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "digital_fundraising_director", title: "Digital Fundraising Director", department: "finance", responsibilities: ["digital fundraising", "channel performance", "donor communications"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "campaign_treasurer", title: "Campaign Treasurer", department: "finance", responsibilities: ["financial records", "reconciliation", "compliance signoff"], allowedClasses: ["observe", "recommend", "draft", "approve"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "cto", title: "Chief Technology Officer", department: "technology", responsibilities: ["infrastructure", "security", "technical governance"], allowedClasses: ["observe", "recommend", "draft", "approve"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "data_director", title: "Data Director / Analytics Chief", department: "digital", responsibilities: ["aggregate analytics", "polling analysis", "data quality"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "digital_director", title: "Digital Director", department: "digital", responsibilities: ["social presence", "website", "digital content", "creative operations"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "general_counsel", title: "General Counsel", department: "legal", responsibilities: ["legal compliance", "contracts", "ballot access", "privacy"], allowedClasses: ["observe", "recommend", "draft", "approve"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "research_director", title: "Research & Verification Director", department: "research", responsibilities: ["research", "verification", "candidate record", "political environment"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "policy_director", title: "Policy & Solutions Director", department: "policy", responsibilities: ["issue analysis", "solution gaps", "intervention evidence", "outcome tracking"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "ballot_access_director", title: "Ballot Access Director", department: "ballot_access", responsibilities: ["state requirements", "deadlines", "petition tracking", "submission status"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "volunteer_director", title: "Volunteer & Community Operations Director", department: "volunteer", responsibilities: ["volunteer operations", "training", "community events"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "advance_director", title: "Scheduling & Advance Director", department: "advance", responsibilities: ["candidate schedule", "travel", "events", "briefing logistics"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
  { id: "security_director", title: "Security & Safety Director", department: "security", responsibilities: ["event safety", "travel safety", "incident escalation"], allowedClasses: ["observe", "recommend", "draft"], requiresHumanApprovalFor: ["approve", "execute"] },
]

export function getCampaignRole(roleId: string): CampaignRole | undefined {
  return CAMPAIGN_ROLES.find((role) => role.id === roleId)
}

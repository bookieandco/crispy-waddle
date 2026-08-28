import type { Opportunity } from './sideIncome'
import type { MoneyActionItem } from '@/lib/money-opportunities/action-queue'

export type ResearchCaseStatus = 'PENDING' | 'READY' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'REJECTED'
export type ResearchTaskStatus = 'PENDING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'
export type ResearchTaskKind = 'VERIFY_SOURCE' | 'VERIFY_ECONOMICS' | 'VERIFY_REQUIREMENTS' | 'VERIFY_DEADLINE' | 'ASSESS_CAPABILITY' | 'FIND_PARTNER' | 'ASSESS_COMPETITION'
export interface ResearchCase { id:string; userId:string; opportunityId:string; status:ResearchCaseStatus; title:string; sourceName:string; sourceUrl:string; action:MoneyActionItem['action']; createdAt:string; updatedAt:string }
export interface ResearchTask { id:string; caseId:string; kind:ResearchTaskKind; title:string; required:boolean; status:ResearchTaskStatus; createdAt:string; completedAt?:string }
export interface ResearchCasePlan { researchCase:ResearchCase; tasks:ResearchTask[] }
export function buildResearchCasePlan(opportunity:Opportunity, action:MoneyActionItem, now=new Date().toISOString()):ResearchCasePlan {
 const caseId=`research_${opportunity.id}`
 const researchCase={id:caseId,userId:opportunity.userId,opportunityId:opportunity.id,status:'PENDING' as const,title:`Research: ${opportunity.title}`,sourceName:opportunity.sourceName,sourceUrl:opportunity.sourceUrl,action:action.action,createdAt:now,updatedAt:now}
 const kinds:ResearchTaskKind[]=['VERIFY_SOURCE','VERIFY_ECONOMICS','VERIFY_REQUIREMENTS','VERIFY_DEADLINE']
 if(action.action==='FIND_PARTNER') kinds.push('FIND_PARTNER')
 if(action.action==='BID_NOW'||action.action==='RESPOND_SOURCES_SOUGHT') kinds.push('ASSESS_CAPABILITY','ASSESS_COMPETITION')
 return {researchCase,tasks:kinds.map((kind,index)=>({id:`${caseId}_task_${index+1}`,caseId,kind,title:taskTitle(kind),required:true,status:'PENDING' as const,createdAt:now}))}
}
function taskTitle(kind:ResearchTaskKind):string { switch(kind){case 'VERIFY_SOURCE':return 'Verify the opportunity source and primary notice.';case 'VERIFY_ECONOMICS':return 'Verify award value, costs, margin assumptions, and economics.';case 'VERIFY_REQUIREMENTS':return 'Verify eligibility, requirements, and material constraints.';case 'VERIFY_DEADLINE':return 'Verify the response deadline and submission window.';case 'ASSESS_CAPABILITY':return 'Assess whether current capabilities satisfy the opportunity.';case 'FIND_PARTNER':return 'Identify and evaluate a suitable partner for capability gaps.';case 'ASSESS_COMPETITION':return 'Assess competition, set-aside structure, and pursuit difficulty.'} }
export interface ResearchPersistence { upsertCase(researchCase:ResearchCase):Promise<void>; upsertTasks(tasks:ResearchTask[]):Promise<void> }
export async function persistResearchCasePlan(persistence:ResearchPersistence,plan:ResearchCasePlan):Promise<void>{await persistence.upsertCase(plan.researchCase);if(plan.tasks.length>0)await persistence.upsertTasks(plan.tasks)}

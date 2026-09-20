import type { Opportunity } from './opportunity.js'

export type PursuitCaseStatus = 'pending' | 'researching' | 'blocked' | 'ready' | 'closed'
export type PursuitTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'
export type PursuitTaskKind =
  | 'verify_source'
  | 'verify_economics'
  | 'verify_requirements'
  | 'verify_deadline'
  | 'verify_identity'
  | 'verify_entitlement'
  | 'verify_jurisdiction'
  | 'verify_employer'
  | 'verify_compensation'
  | 'verify_provider'
  | 'assess_margin'
  | 'assess_capability'
  | 'assess_competition'
  | 'assess_compliance'

export type PursuitTask = {
  id: string
  kind: PursuitTaskKind
  title: string
  required: boolean
  status: PursuitTaskStatus
  createdAt: string
  completedAt?: string
  evidenceRefs: string[]
}

export type OpportunityPursuitCase = {
  id: string
  opportunityId: string
  title: string
  status: PursuitCaseStatus
  tasks: PursuitTask[]
  createdAt: string
  updatedAt: string
}

export function approveOpportunityForResearch(
  opportunity: Opportunity,
  now = new Date().toISOString(),
): { opportunity: Opportunity; pursuitCase: OpportunityPursuitCase } {
  if (!['discovered', 'research_pending'].includes(opportunity.status)) {
    throw new Error(`Opportunity cannot enter research from status ${opportunity.status}`)
  }

  const caseId = `research:${opportunity.id}`
  const kinds = researchTasksFor(opportunity)
  const tasks = kinds.map((kind, index): PursuitTask => ({
    id: `${caseId}:task:${index + 1}`,
    kind,
    title: taskTitle(kind),
    required: true,
    status: 'pending',
    createdAt: now,
    evidenceRefs: [],
  }))

  return {
    opportunity: { ...opportunity, status: 'research_pending', updatedAt: now },
    pursuitCase: {
      id: caseId,
      opportunityId: opportunity.id,
      title: `Research: ${opportunity.title}`,
      status: 'pending',
      tasks,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export function updatePursuitTask(
  pursuitCase: OpportunityPursuitCase,
  taskId: string,
  update: { status: PursuitTaskStatus; evidenceRefs?: string[] },
  now = new Date().toISOString(),
): OpportunityPursuitCase {
  let found = false
  const tasks = pursuitCase.tasks.map((task) => {
    if (task.id !== taskId) return task
    found = true
    return {
      ...task,
      status: update.status,
      evidenceRefs: update.evidenceRefs ?? task.evidenceRefs,
      completedAt: update.status === 'completed' ? now : undefined,
    }
  })
  if (!found) throw new Error(`Unknown pursuit task: ${taskId}`)

  const required = tasks.filter((task) => task.required)
  const status: PursuitCaseStatus =
    required.some((task) => task.status === 'blocked') ? 'blocked' :
    required.every((task) => task.status === 'completed') ? 'ready' :
    required.some((task) => task.status === 'in_progress' || task.status === 'completed') ? 'researching' :
    'pending'

  return { ...pursuitCase, tasks, status, updatedAt: now }
}

export function isPursuitReady(pursuitCase: OpportunityPursuitCase): boolean {
  return pursuitCase.status === 'ready' &&
    pursuitCase.tasks.filter((task) => task.required).every((task) => task.status === 'completed' && task.evidenceRefs.length > 0)
}

function researchTasksFor(opportunity: Opportunity): PursuitTaskKind[] {
  const common: PursuitTaskKind[] = ['verify_source', 'verify_economics', 'verify_requirements', 'verify_deadline']
  const vertical: PursuitTaskKind[] =
    opportunity.family === 'recovery'
      ? ['verify_identity', 'verify_entitlement', 'verify_jurisdiction']
      : opportunity.family === 'employment'
        ? ['verify_employer', 'verify_compensation', 'assess_capability']
        : opportunity.family === 'funding'
          ? ['assess_capability', 'assess_competition', 'assess_compliance']
          : ['verify_provider', 'assess_margin', 'assess_capability', 'assess_competition', 'assess_compliance']
  return [...new Set([...common, ...vertical])]
}

function taskTitle(kind: PursuitTaskKind): string {
  const titles: Record<PursuitTaskKind, string> = {
    verify_source: 'Verify the primary source and provenance.',
    verify_economics: 'Verify expected revenue, costs, margin, and time assumptions.',
    verify_requirements: 'Verify eligibility, requirements, and material constraints.',
    verify_deadline: 'Verify deadline and response window.',
    verify_identity: 'Verify claimant identity with authoritative evidence.',
    verify_entitlement: 'Verify entitlement before recovery activity.',
    verify_jurisdiction: 'Verify jurisdiction rules and recovery constraints.',
    verify_employer: 'Verify the employer/client and listing legitimacy.',
    verify_compensation: 'Verify compensation and payment terms.',
    verify_provider: 'Verify the marketplace, supplier, or platform.',
    assess_margin: 'Assess expected contribution margin after real costs.',
    assess_capability: 'Assess capability fit and identify material gaps.',
    assess_competition: 'Assess competition and pursuit difficulty.',
    assess_compliance: 'Assess platform, advertising, disclosure, and policy constraints.',
  }
  return titles[kind]
}

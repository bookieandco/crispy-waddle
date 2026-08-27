import type { MoneyAction, MoneyActionItem } from "./action-queue"
import type { MoneyResearchCase, ResearchBranchKind } from "./research-case"
import { createMoneyResearchCase } from "./research-case"

const focusByAction: Record<MoneyAction, ResearchBranchKind[]> = {
  BID_NOW: ["REQUIREMENTS", "INCUMBENT", "COMPETITORS", "ECONOMICS", "NEXT_ACTION"],
  FIND_PARTNER: ["REQUIREMENTS", "PARTNERS", "INCUMBENT", "ECONOMICS", "NEXT_ACTION"],
  RESPOND_SOURCES_SOUGHT: ["AGENCY", "REQUIREMENTS", "PARTNERS", "NEXT_ACTION"],
  CONTACT_AGENCY: ["AGENCY", "REQUIREMENTS", "NEXT_ACTION"],
  MONITOR: ["AGENCY", "REQUIREMENTS", "ECONOMICS"],
  PASS: [],
}

export interface PlannedResearchCase extends MoneyResearchCase {
  action: MoneyAction
  priority: MoneyActionItem["priority"]
  estimatedValue: number
  estimatedMarginPercent: number
  focusBranches: ResearchBranchKind[]
}

export function planResearchCase(input: {
  action: MoneyActionItem
  title: string
  now?: Date
}): PlannedResearchCase | null {
  const focusBranches = focusByAction[input.action.action]
  if (!focusBranches.length) return null

  const base = createMoneyResearchCase({
    opportunityId: input.action.opportunityId,
    title: input.title,
    now: input.now,
  })

  const focus = new Set(focusBranches)
  return {
    ...base,
    action: input.action.action,
    priority: input.action.priority,
    estimatedValue: input.action.estimatedValue,
    estimatedMarginPercent: input.action.estimatedMarginPercent,
    focusBranches,
    branches: base.branches.map((item) => ({
      ...item,
      status: focus.has(item.kind) ? "READY" : "PENDING",
    })),
  }
}

export function planResearchQueue(
  actions: MoneyActionItem[],
  titles: Record<string, string> = {},
): PlannedResearchCase[] {
  return actions.flatMap((action) => {
    const planned = planResearchCase({
      action,
      title: titles[action.opportunityId] || `SAM opportunity ${action.opportunityId}`,
    })
    return planned ? [planned] : []
  })
}

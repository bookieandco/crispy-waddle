import type {
  ID,
  PlanningPlan,
  PlanningProposal,
  PlanningRegistry,
} from "./index";

export class InMemoryPlanningRegistry implements PlanningRegistry {
  private readonly plans = new Map<ID, PlanningPlan>();
  private readonly proposals = new Map<ID, PlanningProposal>();

  async getPlan(id: ID): Promise<PlanningPlan | null> {
    return this.plans.get(id) ?? null;
  }

  async savePlan(plan: PlanningPlan): Promise<void> {
    this.plans.set(plan.id, structuredClone(plan));
  }

  async listPlans(): Promise<PlanningPlan[]> {
    return Array.from(this.plans.values(), (plan) => structuredClone(plan));
  }

  async createProposal(proposal: PlanningProposal): Promise<void> {
    this.proposals.set(proposal.id, structuredClone(proposal));
  }

  async listProposals(): Promise<PlanningProposal[]> {
    return Array.from(this.proposals.values(), (proposal) => structuredClone(proposal));
  }
}

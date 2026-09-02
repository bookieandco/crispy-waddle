import type { ResearchSourceProfile } from './research-source-registry.js';

export interface ResearchSourceOutcome { sourceId: string; usefulEvidence: number; corroboratedEvidence: number; verifiedEvidence: number; rejectedEvidence: number; }
export interface ResearchSourcePerformance { sourceId: string; investigations: number; usefulEvidence: number; corroboratedEvidence: number; verifiedEvidence: number; rejectedEvidence: number; score: number; decayedScore: number; posteriorMean: number; posteriorLowerBound: number; posteriorUpperBound: number; updatedAt: string; }
export interface ResearchSourceDecayPolicy { halfLifeDays: number; minimumScore: number; priorAlpha: number; priorBeta: number; explorationWeight: number; }
const DEFAULT_POLICY: ResearchSourceDecayPolicy = { halfLifeDays: 30, minimumScore: -1, priorAlpha: 1, priorBeta: 1, explorationWeight: 0.35 };

/** Adaptive routing memory. Bayesian confidence guides exploration; it never establishes factual truth. */
export class ResearchSourcePerformanceStore {
  protected readonly state = new Map<string, ResearchSourcePerformance>();
  constructor(private readonly policy: ResearchSourceDecayPolicy = DEFAULT_POLICY) {}
  protected set(value: ResearchSourcePerformance): void { this.state.set(value.sourceId, value); }
  record(outcome: ResearchSourceOutcome, now = new Date().toISOString()): ResearchSourcePerformance {
    const previous = this.state.get(outcome.sourceId);
    const base = previous ? this.applyDecay(previous, now) : this.empty(outcome.sourceId, now);
    const next = { ...base, investigations: base.investigations + 1, usefulEvidence: base.usefulEvidence + outcome.usefulEvidence, corroboratedEvidence: base.corroboratedEvidence + outcome.corroboratedEvidence, verifiedEvidence: base.verifiedEvidence + outcome.verifiedEvidence, rejectedEvidence: base.rejectedEvidence + outcome.rejectedEvidence, updatedAt: now };
    const total = next.usefulEvidence + next.rejectedEvidence;
    next.score = total === 0 ? next.score : ((next.verifiedEvidence * 2) + (next.corroboratedEvidence * 1.5) + next.usefulEvidence - next.rejectedEvidence) / total;
    const alpha = this.policy.priorAlpha + next.verifiedEvidence + next.corroboratedEvidence * 0.5;
    const beta = this.policy.priorBeta + next.rejectedEvidence;
    next.posteriorMean = alpha / (alpha + beta);
    const radius = 1.96 * Math.sqrt((next.posteriorMean * (1 - next.posteriorMean)) / Math.max(1, alpha + beta));
    next.posteriorLowerBound = Math.max(0, next.posteriorMean - radius); next.posteriorUpperBound = Math.min(1, next.posteriorMean + radius);
    next.decayedScore = next.score; this.set(next); return next;
  }
  get(sourceId: string, now = new Date().toISOString()): ResearchSourcePerformance | undefined { const v = this.state.get(sourceId); return v ? this.applyDecay(v, now) : undefined; }
  rank(profiles: readonly ResearchSourceProfile[], now = new Date().toISOString()): ResearchSourceProfile[] {
    const totalTrials = Math.max(1, [...this.state.values()].reduce((n, v) => n + v.investigations, 0));
    return [...profiles].sort((a,b) => this.routingScore(b,totalTrials,now)-this.routingScore(a,totalTrials,now));
  }
  private routingScore(profile: ResearchSourceProfile, totalTrials: number, now: string): number { const p=this.get(profile.id,now); if(!p) return this.policy.explorationWeight; const uncertainty=Math.sqrt(Math.log(totalTrials+1)/Math.max(1,p.investigations)); return p.decayedScore+p.posteriorMean+this.policy.explorationWeight*uncertainty; }
  private empty(sourceId:string,now:string):ResearchSourcePerformance { const mean=this.policy.priorAlpha/(this.policy.priorAlpha+this.policy.priorBeta); return {sourceId,investigations:0,usefulEvidence:0,corroboratedEvidence:0,verifiedEvidence:0,rejectedEvidence:0,score:0,decayedScore:0,posteriorMean:mean,posteriorLowerBound:0,posteriorUpperBound:1,updatedAt:now}; }
  private applyDecay(v:ResearchSourcePerformance,now:string):ResearchSourcePerformance { const decayedScore=Math.max(this.policy.minimumScore,this.decayScore(v.score,v.updatedAt,now)); const n={...v,decayedScore}; this.set(n); return n; }
  private decayScore(score:number,from:string,to:string):number { const ageDays=Math.max(0,(Date.parse(to)-Date.parse(from))/86400000); return score*Math.pow(0.5,ageDays/Math.max(1,this.policy.halfLifeDays)); }
}

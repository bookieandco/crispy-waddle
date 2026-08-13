import type { CareerPassportSnapshot, JobOrder, MatchDecision } from "./domain.js";

export function scoreCandidate(job: JobOrder, worker: CareerPassportSnapshot): MatchDecision {
  const workerSkills = new Set(worker.skills.map((skill) => skill.trim().toLowerCase()));
  const reasons: string[] = [];
  const unmetRequirements: string[] = [];
  let matched = 0;

  for (const requirement of job.requirements) {
    const normalized = requirement.trim().toLowerCase();
    if (!normalized) continue;

    const match = [...workerSkills].some(
      (skill) => skill === normalized || skill.includes(normalized) || normalized.includes(skill),
    );

    if (match) {
      matched += 1;
      reasons.push(`Matches requirement: ${requirement}`);
    } else {
      unmetRequirements.push(requirement);
    }
  }

  const requirementCount = job.requirements.filter(Boolean).length;
  const score = requirementCount === 0 ? 1 : matched / requirementCount;

  if (worker.availability) reasons.push(`Availability supplied: ${worker.availability}`);
  if (worker.verifiedCredentials.length > 0) reasons.push("Has verified credentials");

  return {
    workerId: worker.workerId,
    jobId: job.id,
    score,
    reasons,
    unmetRequirements,
  };
}

export function rankCandidates(job: JobOrder, workers: CareerPassportSnapshot[]): MatchDecision[] {
  return workers
    .map((worker) => scoreCandidate(job, worker))
    .sort((a, b) => b.score - a.score);
}

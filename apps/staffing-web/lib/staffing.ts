import { validateCommercialAgreement } from "../../../packages/staffing-core/src/agency-agreements.js";

export type JobDraft = {
  title: string;
  description: string;
  location: string;
  payRate: number;
};

export function validateJobDraft(job: JobDraft): string[] {
  const errors: string[] = [];
  if (!job.title.trim()) errors.push("Job title is required");
  if (!job.description.trim()) errors.push("Job description is required");
  if (!job.location.trim()) errors.push("Location is required");
  if (!Number.isFinite(job.payRate) || job.payRate <= 0) errors.push("Pay rate must be greater than zero");
  return errors;
}

export function validateAgencyAgreement(input: Parameters<typeof validateCommercialAgreement>[0]): string[] {
  try {
    validateCommercialAgreement(input);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : "Invalid commercial agreement"];
  }
}

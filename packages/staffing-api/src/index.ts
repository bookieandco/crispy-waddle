import type { JobService } from "../../staffing-core/src/jobs.js";

export interface StaffingRequestContext {
  actorId: string;
  organizationId: string;
  requestId: string;
}

export interface CreateJobRequest {
  title: string;
  description: string;
  location: string;
  payRate: number;
  currency: string;
  remote: boolean;
}

export function createJobEndpoint(jobService: JobService, context: StaffingRequestContext, request: CreateJobRequest) {
  return jobService.create({
    organizationId: context.organizationId,
    employerId: context.actorId,
    ...request,
  });
}

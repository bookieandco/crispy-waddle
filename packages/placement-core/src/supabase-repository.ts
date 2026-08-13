import type { SupabaseClient } from "@supabase/supabase-js";
import type { Assignment, JobOrder, Placement, Referral, Timesheet } from "./domain.js";
import type { PlacementRepository } from "./vertical-slice.js";

/**
 * Persistence adapter for the PlacementOS domain.
 *
 * The service layer remains responsible for business rules; this adapter only
 * translates domain objects into database rows. Authentication is expected to
 * be established on the Supabase client so database RLS remains authoritative.
 */
export class SupabasePlacementRepository implements PlacementRepository {
  constructor(private readonly db: SupabaseClient) {}

  async saveJob(job: JobOrder): Promise<void> {
    const { error } = await this.db.from("placement_jobs").insert({
      id: job.id,
      employer_id: job.employerId,
      agency_id: job.agencyId ?? null,
      title: job.title,
      openings: job.openings,
      location: job.location,
      pay_min: job.payMin,
      pay_max: job.payMax,
      currency: job.currency,
      shift: job.shift,
      starts_at: job.startsAt,
      requirements: job.requirements,
      status: job.status,
      source_system: job.source?.system ?? null,
      source_external_id: job.source?.externalId ?? null,
    });
    if (error) throw error;
  }

  async saveReferral(referral: Referral): Promise<void> {
    const { error } = await this.db.from("placement_referrals").insert({
      id: referral.id,
      worker_id: referral.workerId,
      job_id: referral.jobId,
      agency_id: referral.agencyId,
      consent_id: referral.consentId,
      match_score: referral.match.score,
      match_reasons: referral.match.reasons,
      unmet_requirements: referral.match.unmetRequirements,
      status: referral.status,
    });
    if (error) throw error;
  }

  async savePlacement(placement: Placement): Promise<void> {
    const { error } = await this.db.from("placement_placements").insert({
      id: placement.id,
      referral_id: placement.referralId,
      worker_id: placement.workerId,
      agency_id: placement.agencyId,
      employer_id: placement.employerId,
      job_id: placement.jobId,
      agreed_pay_rate: placement.agreedPayRate,
      currency: placement.currency,
      starts_at: placement.startsAt,
      status: placement.status,
    });
    if (error) throw error;
  }

  async saveAssignment(assignment: Assignment): Promise<void> {
    const { error } = await this.db.from("placement_assignments").insert({
      id: assignment.id,
      placement_id: assignment.placementId,
      schedule: assignment.schedule,
      supervisor_id: assignment.supervisorId ?? null,
      status: assignment.status,
    });
    if (error) throw error;
  }

  async saveTimesheet(timesheet: Timesheet): Promise<void> {
    const { error } = await this.db.from("placement_timesheets").insert({
      id: timesheet.id,
      assignment_id: timesheet.assignmentId,
      worker_id: timesheet.workerId,
      period_start: timesheet.periodStart,
      period_end: timesheet.periodEnd,
      hours: timesheet.hours,
      status: timesheet.status,
    });
    if (error) throw error;
  }
}

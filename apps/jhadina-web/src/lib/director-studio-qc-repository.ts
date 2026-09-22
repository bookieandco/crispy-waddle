import type { SupabaseClient } from '@supabase/supabase-js';
import { validateStudioApprovalEvidence } from '@jhadina/director-core/studio-asset-approval';

export type PersistedDirectorStudioQCReport = {
  id: string;
  projectId: string;
  assetId: string;
  provider: string;
  minimumObservedScore: number;
  evidenceIds: string[];
  actionRequestId?: string;
  createdAt?: string;
};

export async function recordPassedDirectorStudioQC(
  client: SupabaseClient,
  report: PersistedDirectorStudioQCReport,
): Promise<PersistedDirectorStudioQCReport> {
  const errors = validateStudioApprovalEvidence({
    qcReportId: report.id,
    minimumObservedScore: report.minimumObservedScore,
    evidenceIds: report.evidenceIds,
  });
  if (errors.length) throw new Error(`DIRECTOR_STUDIO_QC_REPORT_INVALID:${errors.join('; ')}`);

  const { data, error } = await client
    .from('director_studio_qc_reports')
    .insert({
      id: report.id,
      project_id: report.projectId,
      asset_id: report.assetId,
      provider: report.provider,
      minimum_observed_score: report.minimumObservedScore,
      evidence_ids: report.evidenceIds,
      passed: true,
      action_request_id: report.actionRequestId ?? null,
      created_at: report.createdAt ?? new Date().toISOString(),
    })
    .select('id,project_id,asset_id,provider,minimum_observed_score,evidence_ids,action_request_id,created_at')
    .single();

  if (error) throw new Error(`DIRECTOR_STUDIO_QC_REPORT_WRITE_FAILED:${error.message}`);
  return {
    id: String(data.id),
    projectId: String(data.project_id),
    assetId: String(data.asset_id),
    provider: String(data.provider),
    minimumObservedScore: Number(data.minimum_observed_score),
    evidenceIds: Array.isArray(data.evidence_ids) ? data.evidence_ids.map(String) : [],
    actionRequestId: data.action_request_id ? String(data.action_request_id) : undefined,
    createdAt: String(data.created_at),
  };
}

"""Source-only Recast schema safety contract; DOES NOT access Supabase."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
proposal=(ROOT/"docs/director/RECAST-REVIEW-REGISTRY-PROPOSAL.sql").read_text()
artifacts=(ROOT/"supabase/migrations/20260922235500_create_jhadina_artifacts.sql").read_text()
inputs=(ROOT/"supabase/migrations/20261004193000_director_workstation_project_inputs.sql").read_text()
def demand(condition,message):
    if not condition:raise AssertionError(message)
demand(bool(re.search(r"create table if not exists public\.jhadina_artifacts\s*\(\s*id uuid",artifacts,re.I)),
       "Artifact Core primary key must be UUID")
demand("artifact_id uuid" in inputs.lower() and
       "references public.jhadina_artifacts(id)" in inputs.lower(),
       "Workstation inputs must have constrained artifact UUID")
for field in ("source_video_asset_id","character_image_asset_id","source_audio_asset_id"):
    demand(bool(re.search(rf"\b{field}\s+uuid\s+not null\s+references public\.jhadina_artifacts\(id\)",proposal,re.I)),
           f"Recast {field} must reference an immutable owner-scoped artifact")
demand("enable row level security" in proposal.lower(),"RLS required")
demand("revoke all on public.director_recast_review_receipts from public,anon,authenticated;" in
       re.sub(r"\s+","",proposal.lower()).replace("frompublic"," frompublic").replace("from public","from public")
       or bool(re.search(r"revoke all on public\.director_recast_review_receipts from public,\s*anon,\s*authenticated;",proposal,re.I)),
       "Anon/auth roles must have no table access")
demand(bool(re.search(r"grant select,\s*insert on public\.director_recast_review_receipts to service_role;",proposal,re.I)),
       "Service role needs only SELECT and INSERT")
demand(bool(re.search(r"for select\s+to service_role using \(true\)",proposal,re.I)),
       "Service role SELECT RLS policy required")
demand(bool(re.search(r"for insert\s+to service_role with check \(true\)",proposal,re.I)),
       "Service role INSERT RLS policy required")
demand("before update or delete" in proposal.lower() and
       "append-only" in proposal.lower(),"Immutable approval receipts required")
demand("security definer" not in "\n".join(line for line in proposal.lower().splitlines()
                                       if not line.lstrip().startswith("--")),
       "Avoid SECURITY DEFINER bypass")
demand("approved_by_user_id" not in proposal.lower() or "reviewed_by_user_id" in proposal.lower(),
       "Auth reviewer identity must be preserved")
print("Recast source-only SQL proposal checks passed; NO live database touched.")

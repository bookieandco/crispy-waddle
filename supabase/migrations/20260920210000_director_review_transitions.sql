-- DIR-12 atomic review outcome transition with compare-and-swap stage versions.
create or replace function public.apply_director_review_transition(
 p_decision_id text,p_project_id text,p_review_stage_id text,p_review_version bigint,p_generation_stage_id text,p_generation_version bigint,p_review_status text,p_generation_status text,p_successor_version bigint,p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r director_creative_stages; g director_creative_stages; successor_id text;
begin
 select * into r from director_creative_stages where id=p_review_stage_id and project_id=p_project_id for update;
 select * into g from director_creative_stages where id=p_generation_stage_id and project_id=p_project_id for update;
 if r.id is null or g.id is null then raise exception 'DIRECTOR_TRANSITION_STAGE_NOT_FOUND'; end if;
 if r.version<>p_review_version or g.version<>p_generation_version then raise exception 'DIRECTOR_TRANSITION_STALE_VERSION'; end if;
 if exists(select 1 from director_review_transitions where decision_id=p_decision_id) then return jsonb_build_object('applied',false,'idempotent',true); end if;
 update director_creative_stages set status=p_review_status,updated_at=now() where id=r.id;
 update director_creative_stages set status=p_generation_status,updated_at=now() where id=g.id;
 if p_successor_version is not null then
  successor_id:=g.id||':v'||p_successor_version;
  insert into director_creative_stages(id,project_id,kind,depends_on,status,input_artifact_ids,output_artifact_ids,version,last_invalidation)
  values(successor_id,g.project_id,'generation',g.depends_on,'ready',g.input_artifact_ids,'{}',p_successor_version,jsonb_build_object('reason',p_reason,'decisionId',p_decision_id,'previousStageId',g.id))
  on conflict(id) do nothing;
 end if;
 insert into director_review_transitions(decision_id,project_id,review_stage_id,review_stage_version,generation_stage_id,generation_stage_version,successor_generation_stage_id,reason)
 values(p_decision_id,p_project_id,r.id,r.version,g.id,g.version,successor_id,p_reason);
 return jsonb_build_object('applied',true,'successorGenerationStageId',successor_id);
end $$;
create table if not exists public.director_review_transitions(
 decision_id text primary key references public.director_media_review_decisions(id) on delete restrict,project_id text not null,review_stage_id text not null,review_stage_version bigint not null,generation_stage_id text not null,generation_stage_version bigint not null,successor_generation_stage_id text,reason text not null,created_at timestamptz not null default now()
);
alter table public.director_review_transitions enable row level security; revoke all on public.director_review_transitions from anon,authenticated; grant select,insert on public.director_review_transitions to service_role;

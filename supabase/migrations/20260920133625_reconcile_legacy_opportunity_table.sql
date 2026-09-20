-- Production drift reconciliation for the pre-canonical Opportunity table.
-- Fresh databases that already have the canonical schema will no-op.
do $$
declare
  v_has_canonical boolean;
  v_has_legacy boolean;
  v_rows bigint;
begin
  if to_regclass('public.jhadina_opportunities') is null then
    return;
  end if;

  select exists (
    select 1
      from information_schema.columns
     where table_schema='public'
       and table_name='jhadina_opportunities'
       and column_name='family'
  ) into v_has_canonical;

  if v_has_canonical then
    return;
  end if;

  select exists (
    select 1
      from information_schema.columns
     where table_schema='public'
       and table_name='jhadina_opportunities'
       and column_name='opportunity_class'
  ) into v_has_legacy;

  if not v_has_legacy then
    raise exception 'jhadina_opportunities has an unknown incompatible schema';
  end if;

  select count(*) into v_rows from public.jhadina_opportunities;
  if v_rows <> 0 then
    raise exception 'legacy jhadina_opportunities is not empty; refusing automatic archive';
  end if;

  execute 'alter table public.jhadina_opportunities rename to jhadina_opportunities_legacy_20260828';

  if to_regclass('public.jhadina_opportunities_pkey') is not null then
    execute 'alter index public.jhadina_opportunities_pkey rename to jhadina_opportunities_legacy_20260828_pkey';
  end if;
  if to_regclass('public.jhadina_opportunities_deadline_idx') is not null then
    execute 'alter index public.jhadina_opportunities_deadline_idx rename to jhadina_opportunities_legacy_20260828_deadline_idx';
  end if;
  if to_regclass('public.jhadina_opportunities_user_source_idx') is not null then
    execute 'alter index public.jhadina_opportunities_user_source_idx rename to jhadina_opportunities_legacy_20260828_user_source_idx';
  end if;
  if to_regclass('public.jhadina_opportunities_user_status_idx') is not null then
    execute 'alter index public.jhadina_opportunities_user_status_idx rename to jhadina_opportunities_legacy_20260828_user_status_idx';
  end if;

  execute 'revoke all on table public.jhadina_opportunities_legacy_20260828 from anon';
  execute 'revoke all on table public.jhadina_opportunities_legacy_20260828 from authenticated';
  execute 'comment on table public.jhadina_opportunities_legacy_20260828 is ''Archived empty pre-canonical Opportunity schema; preserved only for rollback/audit reference.''';
end
$$;

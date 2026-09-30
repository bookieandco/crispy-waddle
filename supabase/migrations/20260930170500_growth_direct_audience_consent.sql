-- Music Juggernaut direct-audience consent bridge.
-- Reuses the canonical Growth customer graph; no duplicate fan identity store.

create schema if not exists growth_private;
revoke all on schema growth_private from public;
grant usage on schema growth_private to authenticated;

create or replace function growth_private.set_customer_consent(
  p_brand_id text,
  p_customer_key text,
  p_channel text,
  p_granted boolean,
  p_evidence_ref text,
  p_occurred_at timestamptz default now()
)
returns public.jhadina_growth_customers
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_customer public.jhadina_growth_customers;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_brand_id),'') is null or nullif(trim(p_customer_key),'') is null then
    raise exception 'brand and customer key required';
  end if;
  if p_channel not in ('email','sms','whatsapp','social_dm') then
    raise exception 'unsupported consent channel';
  end if;
  if nullif(trim(p_evidence_ref),'') is null then
    raise exception 'consent evidence reference required';
  end if;

  insert into public.jhadina_growth_customers(
    user_id,brand_id,customer_key,lifecycle_stage,consent,first_seen_at,last_seen_at
  )
  values(
    v_user,trim(p_brand_id),trim(p_customer_key),
    case when p_granted then 'lead' else 'prospect' end,
    jsonb_build_object(p_channel,p_granted),
    p_occurred_at,p_occurred_at
  )
  on conflict(user_id,brand_id,customer_key)
  do update set
    consent=jsonb_set(
      coalesce(public.jhadina_growth_customers.consent,'{}'::jsonb),
      array[p_channel],
      to_jsonb(p_granted),
      true
    ),
    lifecycle_stage=case
      when p_granted and public.jhadina_growth_customers.lifecycle_stage in ('prospect','engaged') then 'lead'
      else public.jhadina_growth_customers.lifecycle_stage
    end,
    last_seen_at=greatest(public.jhadina_growth_customers.last_seen_at,p_occurred_at),
    updated_at=now()
  returning * into v_customer;

  insert into public.jhadina_growth_customer_events(
    user_id,customer_id,event_type,source,confidence,occurred_at,evidence
  ) values (
    v_user,v_customer.id,'form_submit','music-juggernaut',1,p_occurred_at,
    jsonb_build_object('consent_channel',p_channel,'consent_granted',p_granted,'evidence_ref',trim(p_evidence_ref))
  );

  return v_customer;
end;
$$;

create or replace function public.jhadina_growth_set_customer_consent(
  p_brand_id text,
  p_customer_key text,
  p_channel text,
  p_granted boolean,
  p_evidence_ref text,
  p_occurred_at timestamptz default now()
)
returns public.jhadina_growth_customers
language sql
security invoker
set search_path=''
as $$
  select * from growth_private.set_customer_consent(
    p_brand_id,p_customer_key,p_channel,p_granted,p_evidence_ref,p_occurred_at
  )
$$;

revoke execute on function public.jhadina_growth_set_customer_consent(text,text,text,boolean,text,timestamptz) from public,anon;
grant execute on function growth_private.set_customer_consent(text,text,text,boolean,text,timestamptz) to authenticated;
grant execute on function public.jhadina_growth_set_customer_consent(text,text,text,boolean,text,timestamptz) to authenticated;

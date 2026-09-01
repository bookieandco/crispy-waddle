create table if not exists public.jhadina_security_nonce (
  nonce text primary key,
  request_id text not null,
  actor_id text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now()
);

create index if not exists jhadina_security_nonce_expiry_idx
  on public.jhadina_security_nonce (expires_at);

create or replace function public.consume_jhadina_security_nonce(
  p_nonce text,
  p_request_id text,
  p_actor_id text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid()::text <> p_actor_id then
    raise exception 'SECURITY_NONCE_ACTOR_MISMATCH';
  end if;
  if p_nonce is null or p_request_id is null or p_actor_id is null then
    raise exception 'SECURITY_NONCE_INPUT_INVALID';
  end if;
  if p_expires_at <= now() then
    return false;
  end if;

  insert into public.jhadina_security_nonce (nonce, request_id, actor_id, expires_at)
  values (p_nonce, p_request_id, p_actor_id, p_expires_at)
  on conflict (nonce) do nothing;

  return found;
end;
$$;

revoke all on public.jhadina_security_nonce from anon;
revoke all on function public.consume_jhadina_security_nonce(text, text, text, timestamptz) from public, anon;
grant execute on function public.consume_jhadina_security_nonce(text, text, text, timestamptz) to authenticated;

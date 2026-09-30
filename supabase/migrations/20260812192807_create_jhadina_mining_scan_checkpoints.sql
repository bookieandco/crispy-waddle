create table public.jhadina_mining_scan_checkpoints (
  checkpoint_id uuid primary key default gen_random_uuid(),
  network text not null check (network in ('mainnet','testnet','signet','regtest')),
  receiving_address text not null,
  scanner_version text not null,
  last_scanned_height bigint not null check (last_scanned_height >= 0),
  last_scanned_hash text not null,
  last_successful_scan_at timestamptz not null,
  reorg_lookback integer not null default 12 check (reorg_lookback >= 0 and reorg_lookback <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network, receiving_address)
);

create index jhadina_mining_scan_checkpoints_network_height_idx
  on public.jhadina_mining_scan_checkpoints (network, last_scanned_height);

alter table public.jhadina_mining_scan_checkpoints enable row level security;

comment on table public.jhadina_mining_scan_checkpoints is 'Durable read-only Bitcoin payout scanner checkpoints. Server-side miner monitoring only; no wallet signing or custody.';

create or replace function public.commit_jhadina_mining_scan_checkpoint(
  p_network text,
  p_receiving_address text,
  p_scanner_version text,
  p_last_scanned_height bigint,
  p_last_scanned_hash text,
  p_last_successful_scan_at timestamptz,
  p_reorg_lookback integer
)
returns public.jhadina_mining_scan_checkpoints
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.jhadina_mining_scan_checkpoints;
begin
  if p_last_scanned_height < 0 then
    raise exception 'invalid checkpoint height';
  end if;

  insert into public.jhadina_mining_scan_checkpoints (
    network, receiving_address, scanner_version,
    last_scanned_height, last_scanned_hash,
    last_successful_scan_at, reorg_lookback
  ) values (
    p_network, p_receiving_address, p_scanner_version,
    p_last_scanned_height, p_last_scanned_hash,
    p_last_successful_scan_at, p_reorg_lookback
  )
  on conflict (network, receiving_address) do update
    set scanner_version = excluded.scanner_version,
        last_scanned_height = excluded.last_scanned_height,
        last_scanned_hash = excluded.last_scanned_hash,
        last_successful_scan_at = excluded.last_successful_scan_at,
        reorg_lookback = excluded.reorg_lookback,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.commit_jhadina_mining_scan_checkpoint(text,text,text,bigint,text,timestamptz,integer) from public, anon, authenticated;
revoke all on table public.jhadina_mining_scan_checkpoints from public, anon, authenticated;

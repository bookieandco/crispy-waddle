create table if not exists public.jhadina_mining_processed_payouts (
  id uuid primary key default gen_random_uuid(),
  network text not null,
  receiving_address text not null,
  txid text not null,
  output_index integer not null check (output_index >= 0),
  payout_sats bigint not null check (payout_sats > 0),
  block_height bigint not null check (block_height >= 0),
  block_hash text not null,
  processed_at timestamptz not null default now(),
  unique (network, receiving_address, txid, output_index)
);

alter table public.jhadina_mining_processed_payouts enable row level security;

create or replace function public.process_jhadina_mining_payout(
  p_network text,
  p_receiving_address text,
  p_txid text,
  p_output_index integer,
  p_payout_sats bigint,
  p_block_height bigint,
  p_block_hash text,
  p_scanned_at timestamptz default now()
) returns table(processed boolean, checkpoint_height bigint, checkpoint_hash text)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.jhadina_mining_processed_payouts (
    network, receiving_address, txid, output_index, payout_sats,
    block_height, block_hash, processed_at
  ) values (
    p_network, p_receiving_address, p_txid, p_output_index, p_payout_sats,
    p_block_height, p_block_hash, p_scanned_at
  ) on conflict (network, receiving_address, txid, output_index) do nothing;

  get diagnostics inserted_count = row_count;

  update public.jhadina_mining_scan_checkpoints
  set height = p_block_height,
      block_hash = p_block_hash,
      scanned_at = p_scanned_at,
      updated_at = now()
  where network = p_network
    and receiving_address = p_receiving_address;

  if not found then
    insert into public.jhadina_mining_scan_checkpoints (
      network, receiving_address, height, block_hash,
      scanned_at, scanner_version, reorg_lookback
    ) values (
      p_network, p_receiving_address, p_block_height, p_block_hash,
      p_scanned_at, '1', 12
    );
  end if;

  return query select (inserted_count = 1), p_block_height, p_block_hash;
end;
$$;

revoke all on function public.process_jhadina_mining_payout(text,text,text,integer,bigint,bigint,text,timestamptz) from public;

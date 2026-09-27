do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'jhadina_safety_consumer_setups'
      and policyname = 'consumer_safetyos_deny_client_access'
  ) then
    create policy consumer_safetyos_deny_client_access
      on public.jhadina_safety_consumer_setups
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end
$$;

-- Keep the delivery-claim RPC executable by the privileged server role.
-- Client roles remain explicitly denied because OCE delivery is server-side.

revoke all on function public.claim_oce_alert_deliveries(timestamptz, text, integer)
  from public, anon, authenticated;

grant execute on function public.claim_oce_alert_deliveries(timestamptz, text, integer)
  to service_role;

# Jhadina Memory Gateway

Production Jhadina uses this Supabase Edge Function as a secretless workload
identity bridge when the Vercel runtime does not have a direct
`SUPABASE_SERVICE_ROLE_KEY`.

The function must be deployed with **Supabase platform JWT verification
disabled** because it performs its own authorization. It accepts only a
cryptographically verified Vercel OIDC token bound to:

- team: `bookieandcos-projects`
- team id: `team_NYQJ3NwijZZ6UJQdOdc5FjmX`
- project: `crispy-waddle-jhadina-web`
- project id: `prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco`
- environment: `production`

The Edge Function then uses Supabase's internally provided
`SUPABASE_SERVICE_ROLE_KEY` for the same service-role-only Memory tables and
RPCs already used by `SupabaseMemoryStorage`.

This changes transport only. Candidate approval, correction/forget lineage,
Personality eligibility, and RNC authority remain in the application layer.

Deployment equivalent:

```sh
supabase functions deploy jhadina-memory-gateway --no-verify-jwt
```

Never expose the Supabase service-role key to Vercel, browsers, logs, or source.

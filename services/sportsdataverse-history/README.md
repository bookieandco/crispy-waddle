# SportsDataverse History Service

Server-side historical sports adapter for Jhadina.

It resolves a player with SportsDataverse, enumerates the player's seasons, fetches
per-season game logs, and normalizes numeric game statistics into the canonical
`SportsHistoricalStatRecord` shape consumed by Money/Sports.

## Endpoints

- `GET /health`
- `POST /history/query`

Example request:

```json
{
  "query": "LeBron James NBA all-time stats",
  "statKeys": ["points", "three_point_field_goals_made"],
  "maxSeasons": 30
}
```

## Authority

This service is read-only historical evidence.

It never:

- places a wager;
- changes a SPORT-SIM probability directly;
- claims a historical record was available at its event date merely because it can
  be fetched today;
- certifies complete career coverage when season enumeration or a season fetch fails.

Current live API fetch timestamps are observation timestamps **now**. Historical
backtests require archived/release-time evidence rather than pretending today's API
response existed in the past.

## Run

```bash
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8094
```

Configure Jhadina Web with:

```text
SPORTS_HISTORY_URL=https://<your-protected-sports-history-host>/history/query
SPORTS_HISTORY_TOKEN=<matching-server-only-secret>
```

## Vercel deployment without Railway

Vercel recognizes this directory's `app.py` as a FastAPI entrypoint. In the
**existing Vercel account**, create a separate FastAPI project connected to
`bookieandco/crispy-waddle` with **Root Directory**
`services/sportsdataverse-history`. Do not change Jhadina Web's existing
Next.js Root Directory or copy this sidecar into the browser.

Deployment gates:
1. Deploy a **protected preview** first and verify `GET /health`. A healthy
   service process does not prove its upstream game logs are available.
2. Set `SPORTS_HISTORY_TOKEN` as an encrypted **server-only** environment
   variable for this service, and the exact same value in Jhadina Web's
   server-side environment. Never set it as `NEXT_PUBLIC_*`.
3. In Jhadina Web, set `SPORTS_HISTORY_URL` to the verified HTTPS endpoint
   `/history/query` for the target deployment environment. Never point a
   Vercel deployment at the old Railway-only DNS name.
4. Call `POST /history/query` with and without the bearer token to verify
   authorized=200 and unauthorized=401. Missing secret must fail closed (503).
5. Verify LeBron's career points and made three-pointers against an independent
   NBA/ESPN totals source. This service provides normalized game logs,
   **not** authoritative proof of complete historical coverage.
6. Keep prediction, betting, signing and trading permissions disabled; this
   service is for historical evidence only.
7. Monitor cold-start, upstream failures, data coverage and Vercel usage
   quotas. Do not upgrade a plan or enable paid compute without separate approval.

The existing Python implementation and its dependency set are reused. No
second canonical sports-history model or new database is introduced.

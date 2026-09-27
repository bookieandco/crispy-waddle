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
SPORTS_HISTORY_URL=http://sportsdataverse-history:8094/history/query
SPORTS_HISTORY_TOKEN=...   # optional if protected by your internal network
```

from __future__ import annotations

import importlib
import math
import re
from datetime import datetime, timezone
from typing import Any, Iterable

import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from sportsdataverse import find_athlete

app = FastAPI(title="Jhadina SportsDataverse History", version="1.0.0")

SUPPORTED_LEAGUES = {
    "nba", "wnba", "nfl", "mlb", "nhl", "cfb", "mbb", "wbb",
    "mls", "epl", "ucl", "nwsl", "laliga", "bundesliga", "seriea", "ligue1",
}
LEAGUE_WORDS = {
    "nba": "nba", "wnba": "wnba", "nfl": "nfl", "mlb": "mlb", "nhl": "nhl",
    "cfb": "cfb", "college football": "cfb",
    "mbb": "mbb", "college basketball": "mbb", "men's college basketball": "mbb",
    "wbb": "wbb", "women's college basketball": "wbb",
    "mls": "mls", "epl": "epl", "premier league": "epl", "ucl": "ucl",
    "champions league": "ucl", "nwsl": "nwsl", "la liga": "laliga",
    "laliga": "laliga", "bundesliga": "bundesliga", "serie a": "seriea",
    "ligue 1": "ligue1",
}
META_COLUMNS = {
    "season_type_id", "season_type_name", "category", "event_id", "event_date",
    "home_away", "score", "opponent_id", "opponent_abbreviation",
    "opponent_display_name", "game_result", "game_processed",
}


class HistoryQuery(BaseModel):
    query: str | None = None
    entity_name: str | None = Field(default=None, alias="entityName")
    league: str | None = None
    stat_keys: list[str] = Field(default_factory=list, alias="statKeys")
    from_season: int | None = Field(default=None, alias="fromSeason")
    to_season: int | None = Field(default=None, alias="toSeason")
    max_seasons: int = Field(default=60, ge=1, le=100, alias="maxSeasons")
    max_records: int = Field(default=50000, ge=1, le=200000, alias="maxRecords")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def _infer_league(query: str) -> str | None:
    q = query.lower()
    for phrase, league in sorted(LEAGUE_WORDS.items(), key=lambda item: -len(item[0])):
        if re.search(r"\b" + re.escape(phrase) + r"\b", q):
            return league
    return None


def _extract_entity_name(query: str, league: str | None) -> str:
    value = query
    removable = [
        r"\b(show|give|tell)\s+me\b",
        r"\b(all[- ]time|career|historical|history|stats?|statistics|gamelog|game log|splits?)\b",
        r"\b(last\s+\d+|playoffs?|postseason|regular season|home|away)\b",
        r"\b(vs\.?|versus|against)\s+.+$",
        r"\b(in|for|on)\s+the\b",
    ]
    for pattern in removable:
        value = re.sub(pattern, " ", value, flags=re.I)
    for phrase in sorted(LEAGUE_WORDS, key=len, reverse=True):
        value = re.sub(r"\b" + re.escape(phrase) + r"\b", " ", value, flags=re.I)
    value = re.sub(r"\s+", " ", value).strip(" ,.-")
    if league and value.lower() == league:
        return ""
    return value


def _year_values(value: Any) -> set[int]:
    years: set[int] = set()
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in {"year", "season", "seasonyear", "season_year"}:
                try:
                    year = int(item)
                    if 1800 <= year <= 2200:
                        years.add(year)
                except (TypeError, ValueError):
                    pass
            years |= _year_values(item)
    elif isinstance(value, list):
        for item in value:
            years |= _year_values(item)
    elif isinstance(value, str):
        for found in re.findall(r"(?:/seasons/|season=)(\d{4})", value):
            years.add(int(found))
        if re.fullmatch(r"\d{4}", value):
            year = int(value)
            if 1800 <= year <= 2200:
                years.add(year)
    elif isinstance(value, int) and 1800 <= value <= 2200:
        years.add(value)
    return years


def _records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    if frame is None or frame.empty:
        return []
    return frame.where(pd.notna(frame), None).to_dict(orient="records")


def _numeric(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        number = float(value)
        return number if math.isfinite(number) else None
    if isinstance(value, str):
        text = value.strip().replace(",", "")
        if not text or "/" in text or "-" in text[1:]:
            return None
        if text.endswith("%"):
            text = text[:-1]
        try:
            number = float(text)
            return number if math.isfinite(number) else None
        except ValueError:
            return None
    return None


def _phase(name: Any) -> str:
    value = str(name or "").lower()
    if "post" in value or "playoff" in value or "tournament" in value:
        return "PLAYOFFS"
    if "pre" in value:
        return "PRESEASON"
    if "regular" in value:
        return "REGULAR"
    return "UNKNOWN"


def _venue(value: Any) -> str:
    text = str(value or "").lower()
    if text == "home":
        return "HOME"
    if text == "away":
        return "AWAY"
    if text == "neutral":
        return "NEUTRAL"
    return "UNKNOWN"


def _event_date(value: Any, fallback_year: int) -> str:
    if value:
        parsed = pd.to_datetime(value, utc=True, errors="coerce")
        if not pd.isna(parsed):
            return parsed.isoformat().replace("+00:00", "Z")
    return f"{fallback_year:04d}-01-01T00:00:00Z"


def _display_name(athlete: dict[str, Any], fallback: str) -> str:
    for key in ("displayName", "fullName", "name", "shortName"):
        value = athlete.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return fallback


def _athlete_id(athlete: dict[str, Any]) -> str:
    for key in ("id", "athlete_id", "uid"):
        value = athlete.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    raise ValueError("resolved athlete has no id")


def _function(module: Any, league: str, suffix: str):
    name = f"espn_{league}_{suffix}"
    fn = getattr(module, name, None)
    if fn is None:
        raise AttributeError(name)
    return fn


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "provider": "sportsdataverse",
        "sportsdataverseCommit": "9e20c292a670d805a11aec06ef8ef2bcd3968966",
        "authority": "HISTORICAL_EVIDENCE_ONLY",
    }


@app.post("/history/query")
def history_query(request: HistoryQuery) -> dict[str, Any]:
    raw_query = (request.query or "").strip()
    league = (request.league or _infer_league(raw_query) or "").lower().strip()
    if league not in SUPPORTED_LEAGUES:
        raise HTTPException(
            status_code=422,
            detail="A supported league is required (for example NBA, NFL, MLB, NHL, WNBA, CFB, MBB, WBB, MLS or EPL).",
        )

    entity_name = (request.entity_name or _extract_entity_name(raw_query, league)).strip()
    if not entity_name:
        raise HTTPException(status_code=422, detail="A player name is required.")

    try:
        athlete = find_athlete(entity_name, league=league)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"athlete resolution failed: {type(exc).__name__}") from exc
    if not athlete:
        raise HTTPException(status_code=404, detail="Player not found.")
    athlete = dict(athlete)
    athlete_id = _athlete_id(athlete)
    label = _display_name(athlete, entity_name)
    module = importlib.import_module(f"sportsdataverse.{league}")

    warnings: list[str] = []
    season_years: set[int] = set()
    seasons_complete = False
    try:
        raw_seasons = _function(module, league, "player_seasons")(
            athlete_id=athlete_id,
            return_parsed=False,
        )
        season_years = _year_values(raw_seasons)
        seasons_complete = bool(season_years)
    except Exception as exc:
        warnings.append(f"season enumeration unavailable: {type(exc).__name__}")

    if request.from_season is not None:
        season_years = {y for y in season_years if y >= request.from_season}
    if request.to_season is not None:
        season_years = {y for y in season_years if y <= request.to_season}

    if not season_years:
        current = datetime.now(timezone.utc).year
        low = request.from_season or current
        high = request.to_season or low
        season_years = set(range(low, high + 1))
        seasons_complete = False
        warnings.append("Season list was not certified complete; requested/fallback seasons only.")

    seasons = sorted(season_years)[-request.max_seasons:]
    all_rows: list[dict[str, Any]] = []
    failed_seasons: list[int] = []
    fetched_at = _now()

    for season in seasons:
        try:
            frame = _function(module, league, "player_gamelog")(
                athlete_id=athlete_id,
                season=season,
                return_as_pandas=True,
            )
            for row in _records(frame):
                row["_season"] = season
                all_rows.append(row)
        except Exception:
            failed_seasons.append(season)

    if failed_seasons:
        warnings.append("Gamelog fetch failed for seasons: " + ", ".join(map(str, failed_seasons)))

    records: list[dict[str, Any]] = []
    requested_keys = {_slug(key) for key in request.stat_keys if key.strip()}
    for row in all_rows:
        season = int(row["_season"])
        event_id = str(row.get("event_id") or f"{league}:{athlete_id}:{season}:unknown")
        event_date = _event_date(row.get("event_date"), season)
        category = _slug(str(row.get("category") or "general"))
        for column, raw_value in row.items():
            if column in META_COLUMNS or column.startswith("_"):
                continue
            value = _numeric(raw_value)
            if value is None:
                continue
            stat = _slug(column)
            full_key = f"{category}.{stat}" if category else stat
            if requested_keys and stat not in requested_keys and full_key not in requested_keys:
                continue
            record_id = f"sdv:{league}:{athlete_id}:{event_id}:{full_key}"
            records.append({
                "recordId": record_id,
                "entityKind": "PLAYER",
                "entityId": f"sportsdataverse:{league}:athlete:{athlete_id}",
                "entityLabel": label,
                "sport": league.upper(),
                "competition": league.upper(),
                "season": str(season),
                "eventId": f"sportsdataverse:{league}:event:{event_id}",
                "eventDate": event_date,
                "opponentId": str(row.get("opponent_id") or "") or None,
                "opponentLabel": row.get("opponent_display_name"),
                "venue": _venue(row.get("home_away")),
                "phase": _phase(row.get("season_type_name")),
                "statKey": full_key,
                "statLabel": str(column).replace("_", " "),
                "value": value,
                "observedAt": fetched_at,
                "availableAt": fetched_at,
                "sourceProvider": "sportsdataverse/espn",
                "sourceClass": "PRIMARY_API",
                "evidenceIds": [
                    f"sportsdataverse:{league}:athlete:{athlete_id}",
                    f"sportsdataverse:{league}:season:{season}:event:{event_id}",
                ],
                "authority": "HISTORICAL_EVIDENCE_ONLY",
                "canExecute": False,
            })
            if len(records) >= request.max_records:
                warnings.append("History response reached maxRecords and was truncated.")
                break
        if len(records) >= request.max_records:
            break

    complete = seasons_complete and not failed_seasons and len(seasons) == len(season_years)
    if not complete:
        warnings.append("Complete all-time coverage is not certified for this response.")
    warnings.append(
        "Live API fetch timestamps show when Jhadina observed these historical records now; "
        "they are not valid point-in-time availability timestamps for historical backtests."
    )

    return {
        "provider": "sportsdataverse",
        "providerCommit": "9e20c292a670d805a11aec06ef8ef2bcd3968966",
        "entity": {
            "kind": "PLAYER",
            "id": f"sportsdataverse:{league}:athlete:{athlete_id}",
            "providerId": athlete_id,
            "label": label,
            "league": league,
        },
        "records": records,
        "providerClaimsAllTimeCoverage": complete,
        "seasonsAttempted": seasons,
        "failedSeasons": failed_seasons,
        "warnings": warnings,
        "authority": "HISTORICAL_EVIDENCE_ONLY",
        "canExecute": False,
    }

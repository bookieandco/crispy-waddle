"""Strict ESPN gamelog stat-name mapping for Jhadina historical evidence.

SportsDataverse's parsed game logs label measurements stat_0, stat_1, ... .
ESPN's response-level names list supplies their actual meaning. Never infer
that a particular numbered column means points or made threes.
"""
from __future__ import annotations

import math
import re
from typing import Any, Sequence

ALIASES = {
    "pts": "points",
    "point": "points",
    "points": "points",
    "three_points_made": "three_point_field_goals_made",
    "three_pointers_made": "three_point_field_goals_made",
    "three_point_field_goals_made": "three_point_field_goals_made",
    "three_point_field_goals": "three_point_field_goals_made",
    "three_point_made": "three_point_field_goals_made",
    "three_pt": "three_point_field_goals_made",
    "three_pt_made": "three_point_field_goals_made",
    "3pt": "three_point_field_goals_made",
    "3pt_made": "three_point_field_goals_made",
    "3pm": "three_point_field_goals_made",
    "field_goals": "field_goals_made",
    "field_goals_made": "field_goals_made",
    "reb": "rebounds",
    "rebounds": "rebounds",
    "ast": "assists",
    "assists": "assists",
    "stl": "steals",
    "steals": "steals",
    "blk": "blocks",
    "blocks": "blocks",
}

PAIR_MADE_STATS = {"three_point_field_goals_made", "field_goals_made"}


def normalize_name(label: str) -> str:
    snake = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", label)
    snake = re.sub(r"[^a-zA-Z0-9]+", "_", snake).strip("_").lower()
    return ALIASES.get(snake, snake)


def resolve_stat(column: str, names: Sequence[Any] | None) -> str | None:
    numbered = re.fullmatch(r"stat_(\\d+)", column)
    if numbered:
        # A missing/out-of-range index is unknown, not an unnamed measurement.
        if not isinstance(names, (list, tuple)):
            return None
        index = int(numbered.group(1))
        if index >= len(names) or not isinstance(names[index], str):
            return None
        name = names[index].strip()
        if not name:
            return None
    else:
        name = column
    resolved = normalize_name(name)
    if not resolved or re.fullmatch(r"stat_\\d+", resolved):
        return None
    return resolved


def decode_stat_value(value: Any, stat: str) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        number = float(value)
        return number if math.isfinite(number) else None
    if not isinstance(value, str):
        return None
    cleaned = value.strip().replace(",", "")
    if stat in PAIR_MADE_STATS:
        pair = re.fullmatch(r"(\\d+)-(\\d+)", cleaned)
        if pair:
            made, attempted = map(int, pair.groups())
            return float(made) if made <= attempted else None
    if not cleaned or "/" in cleaned or "-" in cleaned[1:]:
        return None
    if cleaned.endswith("%"):
        cleaned = cleaned[:-1]
    try:
        number = float(cleaned)
        return number if math.isfinite(number) else None
    except ValueError:
        return None

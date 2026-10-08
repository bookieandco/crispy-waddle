#!/usr/bin/env python3
"""Read-only semantic audit of a disposable Shadow PostgreSQL restore.

No target is accepted from an operator: only the random container name created
by restore_drill. Report aggregate counts, never token addresses or user rows.
This is backup recoverability evidence, not trading-performance certification.
"""
from __future__ import annotations

import json
import re
import subprocess

CONTAINER_RE = re.compile(r"jhadina-drill-[a-f0-9]{12}\Z")

AGGREGATE_SQL = """
SELECT jsonb_build_object(
 'market_samples',(SELECT count(*) FROM runpod_shadow_market_samples),
 'decisions',(SELECT count(*) FROM runpod_shark_shadow_decisions),
 'executions',(SELECT count(*) FROM runpod_shark_shadow_executions),
 'observations',(SELECT count(*) FROM runpod_shark_shadow_observations),
 'lessons',(SELECT count(*) FROM runpod_shark_shadow_lessons),
 'calibrations',(SELECT count(*) FROM runpod_shark_shadow_calibrations),
 'memories',(SELECT count(*) FROM runpod_shark_shadow_memory),
 'sync_records',(SELECT count(*) FROM runpod_shark_shadow_sync_queue),
 'runtime_state',(SELECT count(*) FROM runpod_shark_shadow_runtime_state),
 'observation_horizons',(
   SELECT coalesce(jsonb_object_agg(horizon,n),'{}'::jsonb)
   FROM (SELECT horizon,count(*) AS n FROM runpod_shark_shadow_observations GROUP BY horizon) t),
 'lesson_horizons',(
   SELECT coalesce(jsonb_object_agg(horizon,n),'{}'::jsonb)
   FROM (SELECT horizon,count(*) AS n FROM runpod_shark_shadow_lessons GROUP BY horizon) t),
 'grade_review_table_present',
    to_regclass('public.runpod_shark_shadow_grade_reviews') IS NOT NULL,
 'orphan_observations',(
    SELECT count(*) FROM runpod_shark_shadow_observations o
    LEFT JOIN runpod_shark_shadow_decisions d ON d.decision_id=o.decision_id
    LEFT JOIN runpod_shadow_market_samples s ON s.sample_id=o.target_sample_id
    WHERE d.decision_id IS NULL OR s.sample_id IS NULL),
 'orphan_lessons',(
    SELECT count(*) FROM runpod_shark_shadow_lessons l
    LEFT JOIN runpod_shark_shadow_decisions d ON d.decision_id=l.decision_id
    WHERE d.decision_id IS NULL),
 'authority_violations',(
    (SELECT count(*) FROM runpod_shark_shadow_decisions
     WHERE can_execute IS DISTINCT FROM FALSE OR authority <> 'SHADOW_DECISION_ONLY')
   +(SELECT count(*) FROM runpod_shark_shadow_executions
     WHERE can_sign IS DISTINCT FROM FALSE OR can_broadcast IS DISTINCT FROM FALSE
       OR can_execute IS DISTINCT FROM FALSE
       OR authority <> 'SHADOW_EXECUTION_SIMULATION_ONLY')
   +(SELECT count(*) FROM runpod_shark_shadow_observations
     WHERE can_execute IS DISTINCT FROM FALSE OR authority <> 'SHADOW_OUTCOME_ONLY')
   +(SELECT count(*) FROM runpod_shark_shadow_lessons
     WHERE can_authorize_live IS DISTINCT FROM FALSE OR authority <> 'LEARNING_ONLY')
   +(SELECT count(*) FROM runpod_shark_shadow_calibrations
     WHERE can_mutate_mandate IS DISTINCT FROM FALSE
       OR can_authorize_live IS DISTINCT FROM FALSE OR authority <> 'LEARNING_ONLY')
   +(SELECT count(*) FROM runpod_shark_shadow_memory
     WHERE can_authorize_live IS DISTINCT FROM FALSE OR authority <> 'LEARNING_MEMORY_ONLY')),
 'spot_quote_grade_review_required',(
    SELECT count(*) FROM runpod_shark_shadow_observations o
    WHERE (o.observation_json->'evidenceIds') ? 'runpod-shadow-reprice:v1'),
 'observation_sample_timestamp_disagreement',(
    SELECT count(*) FROM runpod_shark_shadow_observations o
    JOIN runpod_shadow_market_samples s ON s.sample_id=o.target_sample_id
    WHERE s.observed_at IS DISTINCT FROM o.observed_at),
 'pending_sync',(
    SELECT count(*) FROM runpod_shark_shadow_sync_queue WHERE status='PENDING')
)::text;
"""


class ShadowSemanticError(RuntimeError):
    pass


def validate_audit(data: object) -> dict:
    if not isinstance(data, dict):
        raise ShadowSemanticError("Disposable Shadow audit must return an object")
    count_fields = (
        "market_samples", "decisions", "executions", "observations", "lessons",
        "calibrations", "memories", "sync_records", "runtime_state",
        "orphan_observations", "orphan_lessons", "authority_violations",
        "spot_quote_grade_review_required",
        "observation_sample_timestamp_disagreement", "pending_sync",
    )
    for name in count_fields:
        if type(data.get(name)) is not int or data[name] < 0:
            raise ShadowSemanticError("Invalid aggregate count: " + name)
    for name in ("observation_horizons", "lesson_horizons"):
        horizons = data.get(name)
        if not isinstance(horizons, dict) or any(
            h not in ("15M", "1H", "4H", "24H", "3D", "7D")
            or type(n) is not int or n < 0 for h, n in horizons.items()
        ):
            raise ShadowSemanticError("Invalid restored horizon aggregation")
        if sum(horizons.values()) != data["observations" if name == "observation_horizons" else "lessons"]:
            raise ShadowSemanticError("Restored horizon counts do not reconcile")
    if type(data.get("grade_review_table_present")) is not bool:
        raise ShadowSemanticError("Grade-review schema presence not established")
    if (data["orphan_observations"] or data["orphan_lessons"]
            or data["authority_violations"]):
        raise ShadowSemanticError("Restored Shadow integrity/authority failed")
    return dict(data)


def audit_disposable_shadow_postgres(container: str) -> dict:
    if not CONTAINER_RE.fullmatch(container):
        raise ShadowSemanticError("Refusing an unrecognized disposable restore target")
    command = ["docker", "exec", container, "psql", "-X", "-At",
               "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "jhadina_canary",
               "-c", AGGREGATE_SQL]
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                            timeout=60, check=False)
    if result.returncode or len(result.stdout) > 128_000:
        raise ShadowSemanticError("Isolated Shadow semantic query failed")
    try:
        data = json.loads(result.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ShadowSemanticError("Isolated Shadow semantic JSON invalid") from exc
    return validate_audit(data)

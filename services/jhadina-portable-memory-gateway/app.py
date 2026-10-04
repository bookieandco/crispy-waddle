"""OIDC-authenticated portable Memory gateway backed by plain PostgreSQL.

The public HTTP surface deliberately exposes only the existing MemoryStorage
protocol. PostgreSQL remains localhost-only on the RunPod staging host.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
import json
import logging
import os
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
import psycopg
from psycopg.rows import dict_row

from vercel_oidc import authorize_vercel_token

LOGGER = logging.getLogger("jhadina-portable-memory-gateway")
MAX_BODY_BYTES = 512 * 1024
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

app = FastAPI(
    title="Jhadina Portable Memory Gateway",
    version="1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def database_url() -> str:
    value = os.environ.get("DATABASE_URL", "").strip() or DATABASE_URL
    if not value:
        raise RuntimeError("PORTABLE_MEMORY_DATABASE_URL_REQUIRED")
    return value


def connect():
    return psycopg.connect(database_url(), row_factory=dict_row)


def must_object(value: Any, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    return value


def must_string(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name} must be a non-empty string")
    return value.strip()


def must_number(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a finite number")
    number = float(value)
    if number != number or number in (float("inf"), float("-inf")):
        raise ValueError(f"{name} must be a finite number")
    return number


def optional_string(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def next_id(prefix: str) -> str:
    return f"{prefix}_{uuid4()}"


def json_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, list):
        return [json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: json_value(item) for key, item in value.items()}
    return value


def memory_from_row(row: dict[str, Any]) -> dict[str, Any]:
    result = {
        "id": row["id"],
        "userId": row["user_id"],
        "type": row["type"],
        "status": row["status"],
        "content": row["content"],
        "confidence": json_value(row["confidence"]),
        "createdAt": json_value(row["created_at"]),
    }
    optional = {
        "approvedAt": "approved_at",
        "rejectedAt": "rejected_at",
        "reasoningEventId": "reasoning_event_id",
        "revokedAt": "revoked_at",
        "revocationReason": "revocation_reason",
        "supersedesMemoryId": "supersedes_memory_id",
    }
    for target, source in optional.items():
        if row.get(source) is not None:
            result[target] = json_value(row[source])
    return result


def candidate_from_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "type": row["type"],
        "content": row["content"],
        "confidence": json_value(row["confidence"]),
        "status": row["status"],
        "createdAt": json_value(row["created_at"]),
        "reasoningEventId": row["reasoning_event_id"],
    }


def reasoning_from_row(row: dict[str, Any]) -> dict[str, Any]:
    result = {
        "id": row["id"],
        "userId": row["user_id"],
        "timestamp": json_value(row["occurred_at"]),
        "userMessage": row["user_message"],
        "observation": row["observation"],
        "classification": row["classification"],
        "systemResponse": row["system_response"],
        "confidence": json_value(row["confidence"]),
        "actor": row["actor"],
        "metadata": row.get("metadata") or {},
    }
    optional = {
        "candidateId": "candidate_id",
        "outcome": "outcome",
        "correlationId": "correlation_id",
        "causationId": "causation_id",
    }
    for target, source in optional.items():
        if row.get(source) is not None:
            result[target] = row[source]
    return result


def timeline_from_row(row: dict[str, Any]) -> dict[str, Any]:
    result = {
        "id": row["id"],
        "userId": row["user_id"],
        "timestamp": json_value(row["occurred_at"]),
        "type": row["type"],
    }
    optional = {
        "reasoningEventId": "reasoning_event_id",
        "memoryId": "memory_id",
        "memoryType": "memory_type",
        "memoryContent": "memory_content",
        "decision": "decision",
    }
    for target, source in optional.items():
        if row.get(source) is not None:
            result[target] = row[source]
    return result


def execute_action(action: str, payload: dict[str, Any]) -> Any:
    with connect() as conn:
        with conn.cursor() as cur:
            if action == "probe":
                cur.execute("SELECT 1 FROM public.jhadina_memories LIMIT 1")
                return {"ok": True}

            if action == "createMemory":
                data = must_object(payload.get("data"), "data")
                row = {
                    "id": next_id("mem"),
                    "user_id": must_string(data.get("userId"), "data.userId"),
                    "type": must_string(data.get("type"), "data.type"),
                    "status": must_string(data.get("status"), "data.status"),
                    "content": must_string(data.get("content"), "data.content"),
                    "confidence": must_number(data.get("confidence"), "data.confidence"),
                    "created_at": must_string(data.get("createdAt"), "data.createdAt"),
                    "approved_at": optional_string(data.get("approvedAt")),
                    "rejected_at": optional_string(data.get("rejectedAt")),
                    "reasoning_event_id": optional_string(data.get("reasoningEventId")),
                    "revoked_at": optional_string(data.get("revokedAt")),
                    "revocation_reason": optional_string(data.get("revocationReason")),
                    "supersedes_memory_id": optional_string(data.get("supersedesMemoryId")),
                }
                cur.execute(
                    """
                    INSERT INTO public.jhadina_memories(
                      id,user_id,type,status,content,confidence,created_at,
                      approved_at,rejected_at,reasoning_event_id,revoked_at,
                      revocation_reason,supersedes_memory_id
                    ) VALUES (
                      %(id)s,%(user_id)s,%(type)s,%(status)s,%(content)s,%(confidence)s,
                      %(created_at)s,%(approved_at)s,%(rejected_at)s,%(reasoning_event_id)s,
                      %(revoked_at)s,%(revocation_reason)s,%(supersedes_memory_id)s
                    )
                    RETURNING *
                    """,
                    row,
                )
                return memory_from_row(cur.fetchone())

            if action == "getMemory":
                cur.execute(
                    "SELECT * FROM public.jhadina_memories WHERE id=%s",
                    (must_string(payload.get("id"), "id"),),
                )
                row = cur.fetchone()
                return memory_from_row(row) if row else None

            if action == "listMemories":
                cur.execute(
                    """
                    SELECT * FROM public.jhadina_memories
                    WHERE user_id=%s
                    ORDER BY created_at DESC,id
                    """,
                    (must_string(payload.get("userId"), "userId"),),
                )
                return [memory_from_row(row) for row in cur.fetchall()]

            if action == "retireMemory":
                cur.execute(
                    """
                    SELECT * FROM public.jhadina_retire_memory(%s,%s,%s,%s)
                    """,
                    (
                        must_string(payload.get("id"), "id"),
                        must_string(payload.get("userId"), "userId"),
                        must_string(payload.get("reason"), "reason"),
                        must_string(payload.get("revokedAt"), "revokedAt"),
                    ),
                )
                row = cur.fetchone()
                return memory_from_row(row) if row else None

            if action == "correctMemory":
                params = must_object(payload.get("params"), "params")
                cur.execute(
                    """
                    SELECT retired,replacement
                    FROM public.jhadina_correct_memory(%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        must_string(params.get("memoryId"), "params.memoryId"),
                        must_string(params.get("userId"), "params.userId"),
                        next_id("mem"),
                        must_string(params.get("content"), "params.content"),
                        must_number(params.get("confidence"), "params.confidence"),
                        must_string(params.get("reasoningEventId"), "params.reasoningEventId"),
                        must_string(params.get("correctedAt"), "params.correctedAt"),
                    ),
                )
                row = cur.fetchone()
                if not row or not row.get("retired") or not row.get("replacement"):
                    raise RuntimeError("PORTABLE_MEMORY_CORRECTION_RESULT_INVALID")
                return {
                    "retired": memory_from_row(row["retired"]),
                    "replacement": memory_from_row(row["replacement"]),
                }

            if action == "createCandidate":
                data = must_object(payload.get("data"), "data")
                row = {
                    "id": next_id("cand"),
                    "user_id": must_string(data.get("userId"), "data.userId"),
                    "type": must_string(data.get("type"), "data.type"),
                    "status": "PENDING",
                    "content": must_string(data.get("content"), "data.content"),
                    "confidence": must_number(data.get("confidence"), "data.confidence"),
                    "reasoning_event_id": must_string(data.get("reasoningEventId"), "data.reasoningEventId"),
                    "created_at": must_string(data.get("createdAt"), "data.createdAt"),
                }
                cur.execute(
                    """
                    INSERT INTO public.jhadina_memory_candidates(
                      id,user_id,type,status,content,confidence,reasoning_event_id,created_at
                    ) VALUES (
                      %(id)s,%(user_id)s,%(type)s,%(status)s,%(content)s,%(confidence)s,
                      %(reasoning_event_id)s,%(created_at)s
                    )
                    RETURNING *
                    """,
                    row,
                )
                return candidate_from_row(cur.fetchone())

            if action == "getCandidate":
                cur.execute(
                    "SELECT * FROM public.jhadina_memory_candidates WHERE id=%s",
                    (must_string(payload.get("id"), "id"),),
                )
                row = cur.fetchone()
                return candidate_from_row(row) if row else None

            if action == "listCandidates":
                user_id = must_string(payload.get("userId"), "userId")
                status = payload.get("status")
                if status is not None and status != "PENDING":
                    raise ValueError("status must be PENDING")
                cur.execute(
                    """
                    SELECT * FROM public.jhadina_memory_candidates
                    WHERE user_id=%s
                    ORDER BY created_at DESC,id
                    """,
                    (user_id,),
                )
                return [candidate_from_row(row) for row in cur.fetchall()]

            if action == "removeCandidate":
                cur.execute(
                    "DELETE FROM public.jhadina_memory_candidates WHERE id=%s",
                    (must_string(payload.get("id"), "id"),),
                )
                return None

            if action == "createReasoningEvent":
                data = must_object(payload.get("data"), "data")
                row = {
                    "id": optional_string(data.get("id")) or next_id("reason"),
                    "user_id": must_string(data.get("userId"), "data.userId"),
                    "occurred_at": must_string(data.get("timestamp"), "data.timestamp"),
                    "user_message": must_string(data.get("userMessage"), "data.userMessage"),
                    "observation": json.dumps(must_object(data.get("observation"), "data.observation")),
                    "classification": json.dumps(must_object(data.get("classification"), "data.classification")),
                    "system_response": must_string(data.get("systemResponse"), "data.systemResponse"),
                    "confidence": must_number(data.get("confidence"), "data.confidence"),
                    "candidate_id": optional_string(data.get("candidateId")),
                    "actor": optional_string(data.get("actor")) or "user",
                    "outcome": optional_string(data.get("outcome")),
                    "correlation_id": optional_string(data.get("correlationId")),
                    "causation_id": optional_string(data.get("causationId")),
                    "metadata": json.dumps(data.get("metadata") if isinstance(data.get("metadata"), dict) else {}),
                }
                cur.execute(
                    """
                    INSERT INTO public.jhadina_reasoning_events(
                      id,user_id,occurred_at,user_message,observation,classification,
                      system_response,confidence,candidate_id,actor,outcome,
                      correlation_id,causation_id,metadata
                    ) VALUES (
                      %(id)s,%(user_id)s,%(occurred_at)s,%(user_message)s,
                      %(observation)s::jsonb,%(classification)s::jsonb,%(system_response)s,
                      %(confidence)s,%(candidate_id)s,%(actor)s,%(outcome)s,
                      %(correlation_id)s,%(causation_id)s,%(metadata)s::jsonb
                    )
                    RETURNING *
                    """,
                    row,
                )
                return reasoning_from_row(cur.fetchone())

            if action == "getReasoningEvent":
                cur.execute(
                    "SELECT * FROM public.jhadina_reasoning_events WHERE id=%s",
                    (must_string(payload.get("id"), "id"),),
                )
                row = cur.fetchone()
                return reasoning_from_row(row) if row else None

            if action == "updateReasoningEvent":
                event_id = must_string(payload.get("id"), "id")
                user_id = must_string(payload.get("userId"), "userId")
                updates = must_object(payload.get("updates"), "updates")
                mapping = {
                    "classification": ("classification", True),
                    "systemResponse": ("system_response", False),
                    "confidence": ("confidence", False),
                    "candidateId": ("candidate_id", False),
                    "actor": ("actor", False),
                    "outcome": ("outcome", False),
                    "correlationId": ("correlation_id", False),
                    "causationId": ("causation_id", False),
                    "metadata": ("metadata", True),
                }
                assignments: list[str] = []
                values: list[Any] = []
                for source, (column, as_json) in mapping.items():
                    if source not in updates:
                        continue
                    assignments.append(f"{column}=%s" + ("::jsonb" if as_json else ""))
                    value = updates[source]
                    values.append(json.dumps(value) if as_json else value)
                if not assignments:
                    cur.execute(
                        "SELECT * FROM public.jhadina_reasoning_events WHERE id=%s AND user_id=%s",
                        (event_id, user_id),
                    )
                else:
                    values.extend([event_id, user_id])
                    cur.execute(
                        f"""
                        UPDATE public.jhadina_reasoning_events
                        SET {", ".join(assignments)}
                        WHERE id=%s AND user_id=%s
                        RETURNING *
                        """,
                        values,
                    )
                row = cur.fetchone()
                return reasoning_from_row(row) if row else None

            if action == "listReasoningEvents":
                user_id = must_string(payload.get("userId"), "userId")
                raw_limit = payload.get("limit", 50)
                if isinstance(raw_limit, bool) or not isinstance(raw_limit, (int, float)):
                    raise ValueError("limit must be numeric")
                limit = max(1, min(200, int(raw_limit)))
                cur.execute(
                    """
                    SELECT * FROM public.jhadina_reasoning_events
                    WHERE user_id=%s
                    ORDER BY occurred_at DESC,id
                    LIMIT %s
                    """,
                    (user_id, limit),
                )
                return [reasoning_from_row(row) for row in cur.fetchall()]

            if action == "appendTimelineEvent":
                data = must_object(payload.get("data"), "data")
                row = {
                    "id": next_id("timeline"),
                    "user_id": must_string(data.get("userId"), "data.userId"),
                    "occurred_at": must_string(data.get("timestamp"), "data.timestamp"),
                    "type": must_string(data.get("type"), "data.type"),
                    "reasoning_event_id": optional_string(data.get("reasoningEventId")),
                    "memory_id": optional_string(data.get("memoryId")),
                    "memory_type": optional_string(data.get("memoryType")),
                    "memory_content": optional_string(data.get("memoryContent")),
                    "decision": optional_string(data.get("decision")),
                }
                cur.execute(
                    """
                    INSERT INTO public.jhadina_timeline_events(
                      id,user_id,occurred_at,type,reasoning_event_id,memory_id,
                      memory_type,memory_content,decision
                    ) VALUES (
                      %(id)s,%(user_id)s,%(occurred_at)s,%(type)s,
                      %(reasoning_event_id)s,%(memory_id)s,%(memory_type)s,
                      %(memory_content)s,%(decision)s
                    )
                    RETURNING *
                    """,
                    row,
                )
                return timeline_from_row(cur.fetchone())

            if action == "listTimeline":
                user_id = must_string(payload.get("userId"), "userId")
                raw_limit = payload.get("limit", 50)
                if isinstance(raw_limit, bool) or not isinstance(raw_limit, (int, float)):
                    raise ValueError("limit must be numeric")
                limit = max(1, min(200, int(raw_limit)))
                cur.execute(
                    """
                    SELECT * FROM public.jhadina_timeline_events
                    WHERE user_id=%s
                    ORDER BY occurred_at DESC,id
                    LIMIT %s
                    """,
                    (user_id, limit),
                )
                return [timeline_from_row(row) for row in cur.fetchall()]

            raise ValueError("unsupported_action")


@app.get("/healthz")
def healthz() -> JSONResponse:
    try:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        return JSONResponse(
            {
                "ok": True,
                "service": "jhadina-portable-memory-gateway",
                "authority": "MEMORY_STORAGE_TRANSPORT_ONLY",
                "canExecute": False,
            },
            headers={"cache-control": "no-store"},
        )
    except Exception:
        return JSONResponse(
            {"ok": False, "error": "database_unavailable"},
            status_code=503,
            headers={"cache-control": "no-store"},
        )


@app.post("/v1/memory")
async def memory_gateway(
    request: Request,
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    token = authorization[len("Bearer "):].strip()
    if not authorize_vercel_token(token):
        raise HTTPException(status_code=401, detail="unauthorized")

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_BODY_BYTES:
                raise HTTPException(status_code=413, detail="payload_too_large")
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid_content_length")

    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="payload_too_large")

    try:
        body = must_object(json.loads(raw or b"{}"), "body")
        action = must_string(body.get("action"), "action")
        payload = body.get("payload")
        if payload is None:
            payload = {}
        payload = must_object(payload, "payload")
        data = execute_action(action, payload)
        return JSONResponse(
            {"data": json_value(data)},
            headers={"cache-control": "no-store"},
        )
    except ValueError as exc:
        return JSONResponse(
            {"error": str(exc)},
            status_code=400,
            headers={"cache-control": "no-store"},
        )
    except Exception as exc:
        LOGGER.error("portable memory action failed: %s", type(exc).__name__)
        return JSONResponse(
            {"error": "storage_operation_failed"},
            status_code=500,
            headers={"cache-control": "no-store"},
        )

from __future__ import annotations

import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import app as gateway
import vercel_oidc


DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL required")


def test_oidc_claim_policy_is_exact():
    trusted = {
        "sub": vercel_oidc.SUBJECT,
        "owner": vercel_oidc.OWNER,
        "owner_id": vercel_oidc.OWNER_ID,
        "project": vercel_oidc.PROJECT,
        "project_id": vercel_oidc.PROJECT_ID,
        "environment": vercel_oidc.ENVIRONMENT,
    }
    assert vercel_oidc.claims_are_trusted(trusted)
    for key in ("owner_id", "project_id", "environment"):
        drift = dict(trusted)
        drift[key] = "wrong"
        assert not vercel_oidc.claims_are_trusted(drift)


def test_memory_gateway_round_trip(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(gateway, "authorize_vercel_token", lambda token: token == "test-oidc")
    client = TestClient(gateway.app)

    health = client.get("/healthz")
    assert health.status_code == 200
    assert health.json()["canExecute"] is False

    unauthorized = client.post("/v1/memory", json={"action": "probe", "payload": {}})
    assert unauthorized.status_code == 401
    assert unauthorized.json() == {"error": "unauthorized"}

    headers = {"authorization": "Bearer test-oidc"}
    probe = client.post("/v1/memory", headers=headers, json={"action": "probe", "payload": {}})
    assert probe.status_code == 200
    assert probe.json() == {"data": {"ok": True}}

    suffix = uuid4().hex
    user_id = f"owner:test:{suffix}"
    reasoning_id = f"reason_{suffix}"

    reasoning = client.post(
        "/v1/memory",
        headers=headers,
        json={
            "action": "createReasoningEvent",
            "payload": {
                "data": {
                    "id": reasoning_id,
                    "userId": user_id,
                    "timestamp": "2026-10-04T04:45:00Z",
                    "userMessage": "Remember portable storage.",
                    "observation": {"source": "integration"},
                    "classification": {"kind": "test"},
                    "systemResponse": "Recorded for governed review.",
                    "confidence": 0.9,
                    "actor": "user",
                    "metadata": {"portable": True},
                }
            },
        },
    )
    assert reasoning.status_code == 200
    assert reasoning.json()["data"]["id"] == reasoning_id

    candidate = client.post(
        "/v1/memory",
        headers=headers,
        json={
            "action": "createCandidate",
            "payload": {
                "data": {
                    "userId": user_id,
                    "type": "CONTEXT",
                    "status": "PENDING",
                    "content": "portable candidate",
                    "confidence": 0.8,
                    "reasoningEventId": reasoning_id,
                    "createdAt": "2026-10-04T04:45:01Z",
                }
            },
        },
    )
    assert candidate.status_code == 200
    candidate_id = candidate.json()["data"]["id"]

    memory = client.post(
        "/v1/memory",
        headers=headers,
        json={
            "action": "createMemory",
            "payload": {
                "data": {
                    "userId": user_id,
                    "type": "CONTEXT",
                    "status": "APPROVED",
                    "content": "portable memory",
                    "confidence": 0.85,
                    "createdAt": "2026-10-04T04:45:02Z",
                    "approvedAt": "2026-10-04T04:45:02Z",
                    "reasoningEventId": reasoning_id,
                }
            },
        },
    )
    assert memory.status_code == 200
    memory_id = memory.json()["data"]["id"]

    listed = client.post(
        "/v1/memory",
        headers=headers,
        json={"action": "listMemories", "payload": {"userId": user_id}},
    )
    assert listed.status_code == 200
    assert [row["id"] for row in listed.json()["data"]] == [memory_id]

    corrected = client.post(
        "/v1/memory",
        headers=headers,
        json={
            "action": "correctMemory",
            "payload": {
                "params": {
                    "memoryId": memory_id,
                    "userId": user_id,
                    "content": "portable memory corrected",
                    "confidence": 0.95,
                    "reasoningEventId": reasoning_id,
                    "correctedAt": "2026-10-04T04:45:03Z",
                }
            },
        },
    )
    assert corrected.status_code == 200
    assert corrected.json()["data"]["retired"]["status"] == "RETIRED"
    assert corrected.json()["data"]["replacement"]["supersedesMemoryId"] == memory_id

    timeline = client.post(
        "/v1/memory",
        headers=headers,
        json={
            "action": "appendTimelineEvent",
            "payload": {
                "data": {
                    "userId": user_id,
                    "timestamp": "2026-10-04T04:45:04Z",
                    "type": "CORRECTION",
                    "reasoningEventId": reasoning_id,
                    "memoryId": memory_id,
                    "memoryType": "CONTEXT",
                    "memoryContent": "portable memory corrected",
                    "decision": "RETIRED",
                }
            },
        },
    )
    assert timeline.status_code == 200

    timeline_list = client.post(
        "/v1/memory",
        headers=headers,
        json={"action": "listTimeline", "payload": {"userId": user_id, "limit": 20}},
    )
    assert timeline_list.status_code == 200
    assert len(timeline_list.json()["data"]) == 1

    removed = client.post(
        "/v1/memory",
        headers=headers,
        json={"action": "removeCandidate", "payload": {"id": candidate_id}},
    )
    assert removed.status_code == 200

    candidates = client.post(
        "/v1/memory",
        headers=headers,
        json={"action": "listCandidates", "payload": {"userId": user_id, "status": "PENDING"}},
    )
    assert candidates.status_code == 200
    assert candidates.json()["data"] == []

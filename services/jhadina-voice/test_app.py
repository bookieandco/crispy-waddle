import os
os.environ["JHADINA_VOICE_SERVICE_TOKEN"]="test-secret"
from fastapi.testclient import TestClient
import app

client=TestClient(app.app)

def test_listen_requires_bearer_token():
    r=client.post("/v1/listen",json={"mimeType":"audio/wav","audioBase64":"AA=="})
    assert r.status_code==401

def test_listen_rejects_unadmitted_mime_before_model_load():
    r=client.post("/v1/listen",headers={"Authorization":"Bearer test-secret"},json={"mimeType":"application/octet-stream","audioBase64":"AA=="})
    assert r.status_code==503
    assert "VOICE_MIME_NOT_ADMITTED" in r.json()["detail"]

def test_speak_requires_bearer_token():
    r=client.post("/v1/speak",json={"text":"hello","language":"en-US"})
    assert r.status_code==401

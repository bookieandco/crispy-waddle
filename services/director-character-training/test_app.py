import os
import sys
from pathlib import Path
import unittest

ROOT=Path(__file__).parent
sys.path.insert(0,str(ROOT))

os.environ["DIRECTOR_CHARACTER_TRAINING_CERTIFICATION_MODE"]="true"
os.environ["DIRECTOR_CHARACTER_TRAINING_TOKEN"]="test-token"

from fastapi.testclient import TestClient
import app

client=TestClient(app.app)

DATASET={
    "id":"dataset-plan:mary",
    "projectId":"movie-1",
    "characterId":"mary",
    "continuityRef":"character:mary:v1",
    "canonicalAssetId":"asset:mary-face",
    "triggerWord":"MARYX7",
    "tasks":[{
        "id":"task:1",
        "kind":"angle",
        "label":"view:front",
        "sourceAssetIds":["asset:mary-face"],
        "targetView":"front",
        "instruction":"Preserve identity.",
    }],
    "stages":["generate","curate","caption","upscale","optional-train-lora"],
    "authority":"DIRECTOR_CHARACTER_DATASET_PLAN",
}

class RuntimeHttpTests(unittest.TestCase):
    def test_liveness_does_not_claim_production_readiness(self):
        live=client.get("/health/live")
        self.assertEqual(live.status_code,200)
        health=client.get("/health")
        self.assertEqual(health.status_code,200)
        self.assertFalse(health.json()["productionReady"])
        self.assertEqual(health.json()["mode"],"contract-certification")

    def test_post_requires_bearer_token(self):
        response=client.post("/v1/character-dataset",json=DATASET)
        self.assertEqual(response.status_code,401)

    def test_authorized_contract_request_returns_explicit_synthetic_receipt(self):
        response=client.post(
            "/v1/character-dataset",
            json=DATASET,
            headers={"authorization":"Bearer test-token"},
        )
        self.assertEqual(response.status_code,200)
        payload=response.json()
        self.assertIn("runtime-mode:contract-certification",payload["evidenceIds"])
        self.assertTrue(payload["candidateAssetIds"][0].startswith("cert://"))

if __name__=="__main__":
    unittest.main()

import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location("worker",Path(__file__).with_name("worker.py"))
worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)

class Engine:
    def track_video(self,request):
        return {"artifactId":"sam2:a","tracks":[{"trackId":"t","class":"character","instanceId":"c","frameStart":0,"frameEnd":5,"annotations":[],"confidence":.9,"approved":True}],"segmentationRefs":["mask"],"keypointRefs":[]}

PROOF=worker.ArtifactDeploymentProof(
    artifact_id="sam2:runtime-checkpoint",
    pin_id="artifact:sam2:checkpoint",
    runtime_instance_id="runtime:sam2:1",
    admission_id="admission:sam2:1",
    admission_receipt_hash="receipt",
    attestation_id="attestation:sam2:1",
    attestation_hash="attestation",
    artifact_digest="sha256:"+"a"*64,
    session_id="session:sam2:1",
    session_hash="session-hash",
    heartbeat_expires_at="2099-09-20T06:10:00Z",
    revocation_snapshot_hash="revocation-snapshot-hash",
    revocation_snapshot_expires_at="2099-09-20T06:10:00Z",
)

class TestWorker(unittest.TestCase):
    def test_model_cannot_self_approve(self):
        out=worker.run_sam2(Engine(),{"sourceAssetId":"video","frameStart":0,"frameEnd":5,"classes":["character"]},PROOF)
        self.assertFalse(out["tracks"][0]["approved"]);self.assertEqual(out["tracks"][0]["source"],"model")
    def test_rejects_unbounded_request(self):
        with self.assertRaises(ValueError): worker.parse_request({"sourceAssetId":"v","frameStart":5,"frameEnd":1,"classes":["character"]})
    def test_rejects_unrequested_output_class(self):
        class Bad:
            def track_video(self,request): return {"artifactId":"x","tracks":[{"class":"prop","frameStart":0,"frameEnd":5}]}
        with self.assertRaises(ValueError): worker.run_sam2(Bad(),{"sourceAssetId":"v","frameStart":0,"frameEnd":5,"classes":["character"]},PROOF)
    def test_rejects_missing_or_wrong_artifact_proof(self):
        bad=worker.ArtifactDeploymentProof(
            artifact_id="other:model",
            pin_id="artifact:sam2:checkpoint",
            runtime_instance_id="runtime:sam2:1",
            admission_id="admission:sam2:1",
            admission_receipt_hash="receipt",
            attestation_id="attestation:sam2:1",
            attestation_hash="attestation",
            artifact_digest="sha256:"+"a"*64,
            session_id="session:sam2:1",
            session_hash="session-hash",
            heartbeat_expires_at="2099-09-20T06:10:00Z",
            revocation_snapshot_hash="revocation-snapshot-hash",
            revocation_snapshot_expires_at="2099-09-20T06:10:00Z",
        )
        with self.assertRaises(ValueError): worker.run_sam2(Engine(),{"sourceAssetId":"video","frameStart":0,"frameEnd":5,"classes":["character"]},bad)
    def test_rejects_expired_runtime_lease_before_inference(self):
        expired=worker.ArtifactDeploymentProof(
            artifact_id="sam2:runtime-checkpoint",
            pin_id="artifact:sam2:checkpoint",
            runtime_instance_id="runtime:sam2:1",
            admission_id="admission:sam2:1",
            admission_receipt_hash="receipt",
            attestation_id="attestation:sam2:1",
            attestation_hash="attestation",
            artifact_digest="sha256:"+"a"*64,
            session_id="session:sam2:1",
            session_hash="session-hash",
            heartbeat_expires_at="2020-01-01T00:00:00Z",
            revocation_snapshot_hash="revocation-snapshot-hash",
            revocation_snapshot_expires_at="2099-09-20T06:10:00Z",
        )
        with self.assertRaisesRegex(ValueError,"heartbeat expired"):
            worker.run_sam2(Engine(),{"sourceAssetId":"video","frameStart":0,"frameEnd":5,"classes":["character"]},expired)
if __name__=="__main__": unittest.main()

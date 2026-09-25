import importlib.util
from pathlib import Path
import sys
import unittest

root=Path(__file__).parent
spec=importlib.util.spec_from_file_location("director_character_training_worker",root/"worker.py")
worker=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=worker
spec.loader.exec_module(worker)

def dataset_plan():
    return {
        "id":"dataset-plan:mary",
        "projectId":"movie-1",
        "characterId":"mary",
        "continuityRef":"character:mary:v1",
        "canonicalAssetId":"asset:mary-face",
        "triggerWord":"MARYX7",
        "tasks":[
            {
                "id":"task:1",
                "kind":"angle",
                "label":"view:front",
                "sourceAssetIds":["asset:mary-face"],
                "targetView":"front",
                "instruction":"Preserve Mary identity.",
            }
        ],
        "stages":["generate","curate","caption","upscale","optional-train-lora"],
        "authority":"DIRECTOR_CHARACTER_DATASET_PLAN",
    }

def lora_request():
    return {
        "id":"train:mary",
        "projectId":"movie-1",
        "characterId":"mary",
        "continuityRef":"character:mary:v1",
        "datasetId":"dataset:mary:v1",
        "triggerWord":"MARYX7",
        "baseModel":"video-base-2.1",
        "modalities":["image","video"],
        "executionTarget":"remote-gpu",
        "maxTrainingResolution":512,
        "saveEverySteps":500,
        "sampleEverySteps":500,
        "samplePrompts":["MARYX7 portrait"],
        "evidenceIds":["dataset:approved"],
    }

def upscale_plan():
    return {
        "id":"upscale:shot-1",
        "projectId":"movie-1",
        "sourceAssetId":"render:1080p",
        "sourceWidth":1920,
        "sourceHeight":1080,
        "targetWidth":3840,
        "targetHeight":2160,
        "fps":24,
        "frameCount":61,
        "maxFramesPerChunk":30,
        "chunks":[
            {"id":"c1","startFrame":0,"endFrameExclusive":30,"sourceAssetId":"render:1080p"},
            {"id":"c2","startFrame":30,"endFrameExclusive":60,"sourceAssetId":"render:1080p"},
            {"id":"c3","startFrame":60,"endFrameExclusive":61,"sourceAssetId":"render:1080p"},
        ],
        "preserveAudio":True,
        "preserveFrameCount":True,
        "preserveTiming":True,
        "effects":[{"kind":"grain","strength":0.1,"purpose":"texture"}],
        "authority":"DIRECTOR_VIDEO_UPSCALE_PLAN",
    }

class RuntimeWorkerTests(unittest.TestCase):
    def setUp(self):
        self.backend=worker.CertificationBackend()

    def test_dataset_contract_certification_is_explicit(self):
        result=worker.run_dataset(self.backend,dataset_plan())
        self.assertEqual(result["planId"],"dataset-plan:mary")
        self.assertIn("runtime-mode:contract-certification",result["evidenceIds"])
        self.assertTrue(result["candidateAssetIds"][0].startswith("cert://"))

    def test_dataset_stage_order_fails_closed(self):
        body=dataset_plan()
        body["stages"]=["generate","upscale","caption"]
        with self.assertRaises(ValueError):
            worker.run_dataset(self.backend,body)

    def test_lora_checkpoint_preserves_request_lineage(self):
        result=worker.run_lora(self.backend,lora_request())
        checkpoint=result["checkpoints"][0]
        self.assertEqual(checkpoint["trainingRequestId"],"train:mary")
        self.assertIn("certification:no-model-training",checkpoint["evidenceIds"])

    def test_upscale_preserves_every_frame(self):
        result=worker.run_upscale(self.backend,upscale_plan())
        self.assertEqual(result["result"]["frameCount"],61)
        self.assertEqual(len(result["result"]["chunkArtifactIds"]),3)

    def test_upscale_rejects_frame_gap(self):
        body=upscale_plan()
        body["chunks"][1]["startFrame"]=31
        with self.assertRaises(ValueError):
            worker.run_upscale(self.backend,body)

if __name__=="__main__":
    unittest.main()

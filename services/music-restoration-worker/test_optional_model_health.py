import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parent))
import worker

class OptionalMusicModelHealthTests(unittest.TestCase):
    def test_optional_models_never_imply_core_worker_ready(self):
        with tempfile.TemporaryDirectory() as root, \
             patch.object(worker.shutil,"which",return_value=None), \
             patch.object(worker.importlib.util,"find_spec",return_value=None):
            result=worker.runtime_readiness(worker.RestorationWorkerConfig(output_dir=Path(root)))
            self.assertFalse(result["productionReady"])
            self.assertEqual(result["optionalModels"],{
                "deepDrums":False,"basicPitchMidi":False,"demucs6s":False,
                "ddspTimbre":False,"vocalAdlibs":False,
            })
    def test_midi_and_sixstem_only_claim_available_after_enable_and_install(self):
        with tempfile.TemporaryDirectory() as root, \
             patch.object(worker.shutil,"which",return_value="/usr/bin/fake"), \
             patch.dict(os.environ,{
                 "MUSIC_RESTORATION_BASIC_PITCH_ENABLED":"YES",
                 "MUSIC_RESTORATION_ALLOW_DEMUCS_6S":"YES",
             }), \
             patch.object(worker.importlib.util,"find_spec",
                          side_effect=lambda name: object() if name in ("basic_pitch","demucs","librosa","numpy","soundfile") else None):
            ready=worker.runtime_readiness(worker.RestorationWorkerConfig(output_dir=Path(root)))
            self.assertTrue(ready["optionalModels"]["basicPitchMidi"])
            self.assertTrue(ready["optionalModels"]["demucs6s"])
            self.assertTrue(ready["optionalModels"]["deepDrums"])
            self.assertFalse(ready["optionalModels"]["ddspTimbre"])
            self.assertFalse(ready["optionalModels"]["vocalAdlibs"])

if __name__=="__main__": unittest.main()

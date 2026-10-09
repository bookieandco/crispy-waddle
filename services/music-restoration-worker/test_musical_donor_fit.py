"""Real PCM waveforms test guitar donor note/rhythm rejection on CPU."""
import math
import sys
import tempfile
import unittest
from pathlib import Path
import numpy as np
import soundfile as sf
sys.path.insert(0,str(Path(__file__).parent))
from musical_donor_fit import measure_musical_donor_fit

class MusicalFitTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.sr=16000

    def audio(self, name, hz, silence=False):
        t=np.arange(16000,dtype=np.float64)/self.sr
        v=.45*np.sin(2*math.pi*hz*t) if not silence else np.zeros_like(t)
        path=self.root/(name+".wav")
        sf.write(path,v,self.sr,subtype="PCM_24")
        return path

    def fit(self, a, b):
        return measure_musical_donor_fit(a,b,[{
            "sourceStartMs":0,"sourceEndMs":900,
            "replacementStartMs":0,"replacementEndMs":900,
        }],"electric-guitar")

    def test_identical_note_eligible_only_for_review(self):
        a=self.audio("source",440)
        b=self.audio("donor",440)
        fit=self.fit(a,b)
        self.assertEqual(fit["status"],"compatible")
        self.assertTrue(fit["requiresHumanReview"])
        self.assertFalse(fit["sourceFamilyExternallyVerified"])
        self.assertGreater(fit["segments"][0]["pitchClassSimilarity"],.95)

    def test_wrong_guitar_note_rejected_despite_same_brightness(self):
        a=self.audio("a",440)
        b=self.audio("e",523.251)
        fit=self.fit(a,b)
        self.assertEqual(fit["status"],"mismatch")
        self.assertFalse(fit["compatible"])
        self.assertLess(fit["segments"][0]["pitchClassSimilarity"],.78)

    def test_silent_damaged_source_yields_unresolved_not_hallucinated_note(self):
        a=self.audio("silence",440,True)
        b=self.audio("donor",440)
        fit=self.fit(a,b)
        self.assertEqual(fit["status"],"unresolved")
        self.assertFalse(fit["compatible"])

    def test_wrong_region_and_nonpitched_rejected(self):
        a=self.audio("source",440)
        b=self.audio("donor",440)
        with self.assertRaisesRegex(ValueError,"REGION_OUT_OF_BOUNDS"):
            measure_musical_donor_fit(a,b,[{
                "sourceStartMs":0,"sourceEndMs":1100,
                "replacementStartMs":0,"replacementEndMs":1100,
            }],"electric-guitar")
        self.assertEqual(measure_musical_donor_fit(a,b,[],"drums")["status"],"not-applicable")

if __name__=="__main__":unittest.main()

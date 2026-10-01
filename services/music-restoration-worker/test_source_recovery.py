import importlib.util
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location("music_source_recovery",ROOT/"source_recovery.py")
if spec is None or spec.loader is None:
    raise ImportError("source recovery spec unavailable")
source_recovery=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=source_recovery
spec.loader.exec_module(source_recovery)

class SourceRecoveryPolicyTest(unittest.TestCase):
    def test_timebase_requires_correlated_two_track_evidence(self):
        weak=source_recovery.corroborated_timebase_confidence(0.9,0.9,0.2,0.8,0.1)
        self.assertFalse(weak["corroborated"])
        self.assertLess(weak["timebaseConfidence"],0.1)

        strong=source_recovery.corroborated_timebase_confidence(0.9,0.85,0.9,0.7,0.2)
        self.assertTrue(strong["corroborated"])
        self.assertGreater(strong["timebaseConfidence"],0.6)
        self.assertGreater(strong["wowConfidence"],strong["flutterConfidence"])

    def test_mid_side_repair_requires_stereo_and_bounded_inner_operation(self):
        with self.assertRaisesRegex(ValueError,"STEREO_REQUIRED"):
            source_recovery.validate_source_recovery_parameters(
                "mid-side-repair",{"mode":"side","innerOperation":"denoise"},48000,1,
            )
        resolved=source_recovery.validate_source_recovery_parameters(
            "mid-side-repair",
            {"mode":"side","innerOperation":"denoise","innerNoiseFloorDb":-55,"innerNoiseReductionDb":8},
            48000,2,
        )
        self.assertEqual(resolved["mode"],"side")
        with self.assertRaisesRegex(ValueError,"INNER_OPERATION_INVALID"):
            source_recovery.validate_source_recovery_parameters(
                "mid-side-repair",{"mode":"mid","innerOperation":"shell"},48000,2,
            )

    def test_dereverb_requires_analysis_confidence_and_conservative_bounds(self):
        with self.assertRaisesRegex(ValueError,"ANALYSIS_CONFIDENCE_REQUIRED"):
            source_recovery.validate_source_recovery_parameters(
                "dereverb",{"analysisConfidence":0.4,"strength":0.3},48000,2,
            )
        resolved=source_recovery.validate_source_recovery_parameters(
            "dereverb",{"analysisConfidence":0.8,"strength":0.4,"maxReductionDb":6,"decayMs":150},48000,2,
        )
        self.assertEqual(resolved["strength"],0.4)
        with self.assertRaisesRegex(ValueError,"DEREVERB_PARAMETERS_INVALID"):
            source_recovery.validate_source_recovery_parameters(
                "dereverb",{"analysisConfidence":0.8,"strength":0.9},48000,2,
            )

    def test_spectral_recovery_is_confidence_gated_and_band_limited(self):
        resolved=source_recovery.validate_source_recovery_parameters(
            "spectral-recovery",
            {
                "analysisConfidence":0.85,
                "detectedCutoffHz":8000,
                "maxExtensionHz":18000,
                "strength":0.25,
                "decayDbPerOctave":9,
            },
            48000,2,
        )
        self.assertEqual(resolved["detectedCutoffHz"],8000)
        with self.assertRaisesRegex(ValueError,"CUTOFF_INVALID"):
            source_recovery.validate_source_recovery_parameters(
                "spectral-recovery",
                {"analysisConfidence":0.85,"detectedCutoffHz":23000,"maxExtensionHz":23900},
                48000,2,
            )

if __name__=="__main__":
    unittest.main()

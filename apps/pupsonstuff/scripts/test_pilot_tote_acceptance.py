"""PILOT.10 QA report contract: no false vendor, iPhone, or screenshot approval."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0,str(Path(__file__).parent))
from pilot_tote_glb import build_geometry,build_glb,SYNTHETIC_MM,SYNTHETIC_PROFILE
from pilot_tote_acceptance import parse_glb,check_quality

class AcceptanceTests(unittest.TestCase):
    def test_glb_audit_recognizes_an_actual_generated_candidate(self):
        data,_=build_glb(build_geometry(SYNTHETIC_MM,SYNTHETIC_PROFILE))
        details=parse_glb(data)
        self.assertEqual(details["material"],"tote_material")
        self.assertEqual(details["mesh"],"tote_body")
        self.assertGreater(details["triangles"],1500)
        self.assertAlmostEqual(details["dimensionsMetersYUp"][1],.53,delta=.015)
        with self.assertRaisesRegex(ValueError,"GLB_V2_BUDGET_OR_MAGIC_INVALID"):
            parse_glb(b"not a model")
        broken=bytearray(data)
        broken[4:8]=bytes([1,0,0,0])
        with self.assertRaisesRegex(ValueError,"GLB_V2_LENGTH_OR_VERSION_INVALID"):
            parse_glb(broken)
    def test_no_reference_photos_or_sample_cannot_be_approved(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            pack=root/"reference"
            pack.mkdir()
            (pack/"manifest.json").write_text(json.dumps({
                "supplier":"Printify","supplierSku":None,"productId":"tote",
                "generator":"pupson-procedural-tote-cpu",
                "dimensionsMm":SYNTHETIC_MM,"proceduralTote":SYNTHETIC_PROFILE,
            }))
            candidate=root/"quarantine"/"tote.glb"
            candidate.parent.mkdir()
            candidate.write_bytes(build_glb(build_geometry(SYNTHETIC_MM,SYNTHETIC_PROFILE))[0])
            result=check_quality(pack,candidate,root/"quarantine"/"screenshots",None)
            self.assertEqual(result["status"],"NOT_APPROVED")
            self.assertFalse(result["storefrontApproved"])
            self.assertFalse(result["mayPromoteAutomatically"])
            self.assertIn("REAL_PRINTIFY_VARIANT_REQUIRED",result["blockingReasons"])
            self.assertTrue(any(x.startswith("MANUAL_SIGNOFF_REQUIRED") for x in result["blockingReasons"]))
            self.assertIn("BASELINE_AND_CANDIDATE_SCREENSHOTS_NOT_RENDERED",result["blockingReasons"])
    def test_synthetic_blender_screenshot_placeholder_is_not_quality_acceptance(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            pack=root/"reference"
            pack.mkdir()
            (pack/"manifest.json").write_text(json.dumps({"productId":"tote"}))
            candidate=root/"quarantine"/"tote.glb"
            candidate.parent.mkdir()
            candidate.write_bytes(build_glb(build_geometry(SYNTHETIC_MM,SYNTHETIC_PROFILE))[0])
            folder=root/"quarantine"/"screenshots"
            folder.mkdir()
            # No production QA evidence may be inferred from fake PNG bytes
            for role in ("approved","candidate"):
                for angle in ("front","side","back"):
                    (folder/f"{role}-{angle}.png").write_bytes(b"\x89PNG\r\n\x1a\n"+b"x"*1500)
            report=check_quality(pack,candidate,folder,{
              "supplierSkuMeasurementsPersonallyReviewed":True,
              "frontSideBackLicensedReferenceCompared":True,
              "faceAndHandleSilhouetteAccepted":True,
              "candidateUvAndArtworkFrontOnlyApproved":True,
              "physicalPrintifySampleApproved":True,
              "physicalIphoneSafariApproved":True,
            })
            self.assertEqual(report["status"],"NOT_APPROVED")
            self.assertIn("CANDIDATE_SHA_NOT_ATTESTED",report["blockingReasons"])
            self.assertIn("SIX_SCREENSHOT_HASHES_NOT_SIGNED_OFF",report["blockingReasons"])

if __name__=="__main__":
    unittest.main()

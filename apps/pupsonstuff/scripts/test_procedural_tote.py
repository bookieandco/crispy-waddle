"""PILOT.08 no-GPU physical tote design contract — no Blender dependency."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).parent))
from procedural_tote_geometry import validate_tote_dimensions,build_geometry,measured_bounds
from model_supplier_tote_blender import inspect,verify_approval

# Synthetic millimeter dimensions test only: NEVER a real Printify product.
DIMS=[380,530,95]
SPEC={
    "bodyHeightMm":390,"handleDropMm":140,
    "strapWidthMm":22,"strapThicknessMm":3,"handleAnchorSpacingMm":145,
    "measurementEvidence":"manufacturer measurement fixture for unit tests; not a real sample",
}


class ToteCpuTests(unittest.TestCase):
    def test_requires_full_measured_body_and_strap_values(self):
        self.assertEqual(validate_tote_dimensions(SPEC,DIMS),(0.38,0.53,0.095))
        for key in ("handleDropMm","bodyHeightMm","strapWidthMm","strapThicknessMm","handleAnchorSpacingMm"):
            with self.subTest(field=key):
                broken=dict(SPEC)
                broken.pop(key)
                with self.assertRaises(ValueError):
                    validate_tote_dimensions(broken,DIMS)
        with self.assertRaisesRegex(ValueError,"TOTE_SPEC_EVIDENCE_UNVERIFIED"):
            validate_tote_dimensions({**SPEC,"measurementEvidence":"TODO synthetic"},DIMS)
    def test_no_arbitrary_stretch_of_rounded_bag_or_loops(self):
        with self.assertRaisesRegex(ValueError,"TOTE_TOTAL_HEIGHT_NOT_EQUAL_BODY_PLUS_HANDLE_DROP"):
            validate_tote_dimensions({**SPEC,"handleDropMm":20},DIMS)
        with self.assertRaisesRegex(ValueError,"TOTE_HANDLE_ANCHOR_SPACING_INVALID"):
            validate_tote_dimensions({**SPEC,"handleAnchorSpacingMm":377},DIMS)
        with self.assertRaisesRegex(ValueError,"TOTE_STRAP_WIDTH_THICKNESS_INVALID"):
            validate_tote_dimensions({**SPEC,"strapWidthMm":100,"handleAnchorSpacingMm":300},DIMS)
    def test_candidate_mesh_has_vertices_faces_uvs_and_bounds(self):
        m=build_geometry(DIMS,SPEC)
        self.assertGreater(len(m["faces"]),1500)
        self.assertLess(len(m["faces"]),120000)
        self.assertEqual(len(m["vertices"]),len(m["uv"]))
        self.assertEqual(m["storefrontApproved"],False)
        self.assertEqual(m["watertightApproved"],False)
        for f in m["faces"]:
            self.assertEqual(len(f),3)
            self.assertTrue(all(isinstance(i,int) and 0<=i<len(m["vertices"]) for i in f))
        bounds=measured_bounds(m)
        self.assertAlmostEqual(bounds[0],.38,delta=.012)
        self.assertAlmostEqual(bounds[1],.095,delta=.012)
        self.assertAlmostEqual(bounds[2],.53,delta=.012)
    def test_existing_product_dimensions_or_no_source_pack_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            pack=root/"tote"
            pack.mkdir()
            # No physical reference images, rights or exact Printify variant
            # in this deliberately blocked test manifest.
            (pack/"manifest.json").write_text(json.dumps({
                "productId":"tote","dimensionsMm":DIMS,"proceduralTote":SPEC,
                "supplier":"Printify","supplierSku":None,
            }))
            _, geometry, report=inspect(pack,root/"quarantine"/"candidate.glb")
            self.assertTrue(geometry)
            self.assertFalse(report["candidateReadyForManualExport"])
            self.assertIn("REAL_PRINTIFY_VARIANT_REQUIRED",report["blockers"])
            self.assertFalse((root/"quarantine"/"candidate.glb").exists())
    def test_cpu_export_requires_separate_manifest_bound_approval(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest=Path(directory)/"manifest.json"
            manifest.write_text("{}")
            with self.assertRaisesRegex(ValueError,"EXPLICIT_CPU_EXPORT_APPROVAL_REQUIRED"):
                verify_approval(None,manifest)
            receipt=Path(directory)/"approval.json"
            receipt.write_text(json.dumps({
                "enabled":True,"manifestSha256":"0"*64,
                "model":"measured-tote-cpu-v1","approvedBy":"test-user",
                "ownerCpuComputeNoBilling":True,
            }))
            with self.assertRaisesRegex(ValueError,"CPU_EXPORT_APPROVAL_RECEIPT_INVALID"):
                verify_approval(receipt,manifest)


if __name__=="__main__":
    unittest.main()

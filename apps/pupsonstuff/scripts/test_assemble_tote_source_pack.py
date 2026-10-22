"""Dry-run-only correctness tests: SYNTHETIC operator files are never real SKU proof."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0,str(Path(__file__).parent))
from assemble_tote_source_pack import compile_private_manifest,run


def fixture(root):
    for name in ("front.png","side.png","back.png"):
        (root/name).write_bytes(b"\x89PNG\r\n\x1a\n"+name.encode("ascii")*36)
    for name in ("measurement-source.txt","blank-photo-rights.txt","commercial-usage-license.txt"):
        (root/name).write_text("SYNTHETIC PRIVATE UNIT TEST DOCUMENT: not a licensed supplier record.\n")
    ids={"blueprintId":72,"printProviderId":4,"variantId":611}
    catalog={
      "authority":"PRINTIFY_CATALOG_READ_ONLY","product":"tote",
      **ids,"storefrontApproved":False,
      "printAreasPx":[{"position":"front","decorationMethod":"dtg",
                       "widthPx":3153,"heightPx":3995}],
    }
    (root/"printify-catalog.json").write_text(json.dumps(catalog))
    selection={**ids,"ownerConfirmedForPupsonstuff":True,
       "selectedSku":"TEST-TOTE-42795","selectedBy":"fixture-operator"}
    (root/"merchant-selection.json").write_text(json.dumps(selection))
    intake={
       "ownerReviewedRights":True,
       "physical":{
         "dimensionsMm":[380,530,95],
         "depthBasis":"sample-measured-3d-depth",
         "catalogVariantId":611,
         "measuredVariant":"fake-variant-for-tests",
         "proceduralTote":{
           "bodyHeightMm":390,"handleDropMm":140,
           "strapWidthMm":22,"strapThicknessMm":3,
           "handleAnchorSpacingMm":145,
         },
       },
       "manufacturerMeasurementsFile":"measurement-source.txt",
       "blankPhotoRightsFile":"blank-photo-rights.txt",
       "commercialDerivativeRightsFile":"commercial-usage-license.txt",
       "references":{"front":"front.png","side":"side.png","back":"back.png"},
    }
    (root/"intake.json").write_text(json.dumps(intake))
    return intake,selection


class RealPackAssemblyTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.intake,self.selection=fixture(self.root)
    def tearDown(self):
        self.temp.cleanup()

    def test_local_attestations_are_structurally_prepared_but_never_production_certified(self):
        manifest,blockers=compile_private_manifest(self.root)
        self.assertEqual(blockers,[])
        self.assertFalse((self.root/"manifest.json").exists())
        self.assertEqual(manifest["variantId"],611)
        self.assertEqual(manifest["supplierSku"],"TEST-TOTE-42795")
        self.assertEqual(manifest["dimensionsMm"],[380,530,95])
        self.assertTrue(manifest["skuMeasurementEvidence"].startswith("private-evidence-sha256:"))
        self.assertEqual(manifest["proceduralTote"]["measurementEvidence"],
                         manifest["skuMeasurementEvidence"])
        self.assertNotIn("publicReferenceOnly",manifest)
        self.assertNotIn("_instructions",manifest)
        self.assertEqual(run(["--pack",str(self.root),"--write-manifest"]),0)
        self.assertTrue((self.root/"manifest.json").exists())
        with self.assertRaises(FileExistsError):
            run(["--pack",str(self.root),"--write-manifest"])

    def test_requires_explicit_owner_selection_of_exact_provider_and_variant(self):
        sel={**self.selection,"variantId":999}
        (self.root/"merchant-selection.json").write_text(json.dumps(sel))
        _,blockers=compile_private_manifest(self.root)
        self.assertTrue(any("OWNER_SELECTION_NOT_TIED" in b for b in blockers))
        self.assertFalse((self.root/"manifest.json").exists())

    def test_manufacturer_sample_must_match_actual_selected_catalog_variant(self):
        intake=self.intake
        intake["physical"]["catalogVariantId"]=999
        (self.root/"intake.json").write_text(json.dumps(intake))
        _,blockers=compile_private_manifest(self.root)
        self.assertIn("MEASURED_PRODUCT_VARIANT_MUST_EQUAL_SELECTED_CATALOG_VARIANT",blockers)

    def test_three_view_copies_are_not_proof_of_three_blank_angles(self):
        (self.root/"back.png").write_bytes((self.root/"front.png").read_bytes())
        _,blockers=compile_private_manifest(self.root)
        self.assertIn("THREE_DISTINCT_BLANK_VIEW_FILES_REQUIRED",blockers)

    def test_public_flat_thickness_is_not_3d_depth_evidence(self):
        intake=self.intake
        intake["physical"]["depthBasis"]="public-flat-bag-thickness"
        (self.root/"intake.json").write_text(json.dumps(intake))
        _,blockers=compile_private_manifest(self.root)
        self.assertIn("ACTUAL_3D_DEPTH_SOURCE_REQUIRED_NO_FLAT_THICKNESS_INFERENCE",blockers)
        self.assertEqual(run(["--pack",str(self.root),"--write-manifest"]),2)
        self.assertFalse((self.root/"manifest.json").exists())

    def test_missing_licensed_angle_or_doc_prevents_new_manifest(self):
        (self.root/"back.png").unlink()
        _,blockers=compile_private_manifest(self.root)
        self.assertTrue(any(x.startswith("REFERENCE_FILE_INVALID:BACK") for x in blockers))
        self.assertFalse((self.root/"manifest.json").exists())
        (self.root/"back.png").write_bytes(b"\x89PNG\r\n\x1a\n"+b"UNIT_TEST"*24)
        intake=self.intake
        intake["commercialDerivativeRightsFile"]="../outside.txt"
        (self.root/"intake.json").write_text(json.dumps(intake))
        _,blockers=compile_private_manifest(self.root)
        self.assertTrue(any(x.startswith("DOCUMENT_INVALID:commercialDerivativeRightsFile") for x in blockers))

    def test_no_silent_document_overwrite_or_synthetic_vendor_id_guess(self):
        (self.root/"printify-catalog.json").unlink()
        _,blockers=compile_private_manifest(self.root)
        self.assertTrue(any("EXACT_AUTHENTICATED_CATALOG" in b for b in blockers))
        (self.root/"manifest.json").write_text("KEEP EXISTING SOURCE MANIFEST")
        self.assertEqual(run(["--pack",str(self.root)]),2)
        self.assertEqual((self.root/"manifest.json").read_text(),"KEEP EXISTING SOURCE MANIFEST")


if __name__=="__main__":
    unittest.main()

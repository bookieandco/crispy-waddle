"""CPU-only tests for GENERATE.01-.05; never invoke inference or network."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
from factory_source_pack import verify_pack, source_path
from factory_gpu_runner import preflight, verify_approval, offline_env, validate_glb_header
from render_candidate_comparison import check_inputs


def png_fixture():
    # Intake only checks magic+size; sample content is expressly synthetic.
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 220


class GenerateContracts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.pack = self.root / "pack"
        self.pack.mkdir()
        refs = {}
        for angle in ("front", "side", "back"):
            filename = f"{angle}.png"
            file = self.pack / filename
            file.write_bytes(png_fixture())
            refs[angle] = {"file": filename, "sha256": hashlib.sha256(file.read_bytes()).hexdigest()}
        self.manifest = {
            "productId": "tote", "candidateId": "tote-synthetic-test",
            "supplier": "Printify", "supplierSku": "1234:5678",
            "dimensionsMm": [380, 440, 100],
            "skuMeasurementEvidence": "synthetic fake vendor fixture; NOT real",
            "sourceKind": "operator-owned-reference",
            "generator": "tencent-hunyuan3d-2", "generatorRevision": "immutable pretend commit 012345678",
            "photoRightsEvidence": "synthetic fixture only; operator fixture",
            "outputCommercialRightsEvidence": "synthetic fixture only; operator fixture",
            "checkpointLicenseEvidence": "synthetic fixture only; operator fixture",
            "dependencyLicenseEvidence": "synthetic fixture only; operator fixture",
            "hunyuanTerritoryClearance": "fictional test: operator reviewed territory and distribution terms",
            "references": refs,
        }
        self.catalog = {
            "authority":"PRINTIFY_CATALOG_READ_ONLY",
            "product":"tote", "blueprintId":72, "printProviderId":4,
            "variantId":611, "storefrontApproved":False,
            "printAreasPx":[{"position":"front","widthPx":3153,"heightPx":3995}],
            "physicallyMeasuredWidthHeightDepthMm":None,
        }
        snap = self.pack / "printify-catalog.json"
        snap.write_text(json.dumps(self.catalog))
        self.manifest.update({
            "blueprintId":72,"printProviderId":4,"variantId":611,
            "printifyCatalogEvidence":"printify-catalog.json",
            "printifyCatalogEvidenceSha256":hashlib.sha256(snap.read_bytes()).hexdigest(),
        })
        self.manifestfile = self.pack / "manifest.json"
        self.manifestfile.write_text(json.dumps(self.manifest))

    def test_reference_hashes_and_operator_acknowledgements_are_mandatory(self):
        result = verify_pack(self.pack, self.manifest)
        self.assertTrue(result["prepared"])
        self.assertFalse(result["storefrontApproved"])
        self.assertEqual(set(result["images"]), {"front", "side", "back"})
        self.assertFalse(verify_pack(self.pack, self.manifest)["executable"])
        self.assertTrue(verify_pack(self.pack, self.manifest, for_execution=True)["executable"])

    def test_no_sku_no_real_dimensions_fail_closed(self):
        invalid = dict(self.manifest, supplierSku=None, dimensionsMm=None)
        blocked = verify_pack(self.pack, invalid, for_execution=True)
        self.assertIn("REAL_PRINTIFY_VARIANT_REQUIRED", blocked["blockers"])
        self.assertIn("REAL_SKU_WIDTH_HEIGHT_DEPTH_REQUIRED", blocked["blockers"])

    def test_printify_variant_report_must_be_hash_locked_and_id_matched(self):
        self.assertTrue(verify_pack(self.pack,self.manifest)["prepared"])
        alt=dict(self.manifest, variantId=999)
        self.assertIn("PRINTIFY_EXACT_VARIANT_OR_PRINT_ZONE_NOT_PROVED",
                      verify_pack(self.pack,alt)["blockers"])
        missing=dict(self.manifest,printifyCatalogEvidenceSha256="0"*64)
        self.assertIn("PRINTIFY_CATALOG_SNAPSHOT_HASH_INVALID",
                      verify_pack(self.pack,missing)["blockers"])
        missing=dict(self.manifest,blueprintId=None)
        self.assertIn("PRINTIFY_BLUEPRINTID_REQUIRED",
                      verify_pack(self.pack,missing)["blockers"])

    def test_sha_mismatch_and_no_external_references(self):
        refs = {**self.manifest["references"], "front": {"file": "front.png", "sha256": "0"*64}}
        invalid = dict(self.manifest, references=refs)
        self.assertIn("REFERENCE_FRONT_HASH_MISMATCH", verify_pack(self.pack, invalid)["blockers"])
        with self.assertRaises(ValueError):
            source_path(self.pack, "../photos/private.png")
        with self.assertRaises(ValueError):
            source_path(self.pack, "/etc/passwd")
        (self.pack / "outsider.png").symlink_to(self.pack / "front.png")
        with self.assertRaises(ValueError):
            source_path(self.pack, "outsider.png")

    def test_synthetic_source_cannot_be_certified_as_physical(self):
        manifest = dict(self.manifest, sourceKind="synthetic")
        result = verify_pack(self.pack, manifest, for_execution=True)
        self.assertIn("SYNTHETIC_REFS_NOT_PHYSICAL_SKU_PROOF", result["blockers"])

    def test_hunyuan_license_geography_is_not_implied_by_repository_access(self):
        manifest = dict(self.manifest, hunyuanTerritoryClearance="")
        result = verify_pack(self.pack, manifest)
        self.assertIn("HUNYUAN_TERRITORY_COMMERCIAL_TERMS_UNCLEARED", result["blockers"])

    def test_runtime_preview_never_runs_gpu_or_creates_output(self):
        repo = self.root / "upstream"
        weights = self.root / "weights"
        repo.mkdir()
        (repo / "hy3dgen").mkdir()
        weights.mkdir()
        (weights / "pretend.bin").write_bytes(b"fixture")
        out = self.root / "quarantine" / "preview.glb"
        with patch("factory_gpu_runner.local_gpu_mb", return_value=24576):
            result = preflight(self.pack, self.manifest, repo, weights, out)
        self.assertIn("EXACT_MANIFEST_EXECUTION_APPROVAL_REQUIRED", result["blockers"])
        self.assertFalse(result["ready"])
        self.assertFalse(out.exists())

    def test_explicit_approval_tied_to_exact_manifest(self):
        good = self.root / "run-approval.json"
        good.write_text(json.dumps({
            "enabled": True, "manifestSha256": hashlib.sha256(self.manifestfile.read_bytes()).hexdigest(),
            "generator": "tencent-hunyuan3d-2", "approvedBy": "fixture-operator",
            "termsAndCheckpointsReviewed": True, "noPaidGpuOrApi": True,
        }))
        self.assertTrue(verify_approval(good, self.manifestfile, "tencent-hunyuan3d-2"))
        self.manifestfile.write_text(self.manifestfile.read_text() + " ")
        with self.assertRaisesRegex(ValueError, "EXECUTION_APPROVAL_MISMATCH"):
            verify_approval(good, self.manifestfile, "tencent-hunyuan3d-2")

    def test_offline_flags_do_not_pretend_to_be_a_firewall(self):
        env = offline_env()
        self.assertEqual(env["HF_HUB_OFFLINE"], "1")
        self.assertEqual(env["TRANSFORMERS_OFFLINE"], "1")
        self.assertEqual(env["GRADIO_ANALYTICS_ENABLED"], "0")

    def test_generated_candidate_must_be_v2_glb_with_exact_container_size(self):
        from struct import pack
        source = self.root / "quarantine" / "generated.glb"
        source.parent.mkdir(exist_ok=True)
        body = b"glTF" + pack("<I", 2) + pack("<I", 300) + bytes(288)
        source.write_bytes(body)
        validate_glb_header(source)
        source.write_bytes(body[:-7])
        with self.assertRaisesRegex(ValueError, "GENERATED_GLB_INVALID_HEADER"):
            validate_glb_header(source)

    def test_unpinned_upstream_revision_blocks_operator_run(self):
        repo = self.root / "local-repo"
        (repo / "hy3dgen").mkdir(parents=True)
        weights = self.root / "weights"
        weights.mkdir()
        (weights / "shard.bin").write_bytes(b"weight fixture")
        with patch("factory_gpu_runner.local_gpu_mb", return_value=24576):
            result = preflight(self.pack, self.manifest, repo, weights,
                               self.root / "quarantine" / "a.glb", approval={"enabled": True})
        self.assertIn("EXACT_UPSTREAM_REVISION_SHA_REQUIRED", result["blockers"])

    def test_render_comparison_refuses_active_asset_paths_and_overwrite(self):
        candidate = self.root / "quarantine" / "tote.glb"
        candidate.parent.mkdir()
        candidate.write_bytes(b"synthetic test placeholder")
        approved = self.root / "approved.glb"
        approved.write_bytes(b"immutable original test placeholder")
        folder = self.root / "quarantine" / "comparison"
        self.assertEqual(check_inputs(candidate, approved, folder)[0], candidate.resolve())
        with self.assertRaisesRegex(ValueError, "CANDIDATE_CANNOT_EQUAL_APPROVED_MODEL"):
            check_inputs(candidate, candidate, folder)
        with self.assertRaisesRegex(ValueError, "REVIEW_INPUT_AND_OUTPUT_MUST_BE_QUARANTINED"):
            check_inputs(approved, candidate, folder)
        folder.mkdir()
        (folder / "previous.png").write_bytes(b"do not overwrite")
        with self.assertRaisesRegex(ValueError, "NO_OVERWRITE"):
            check_inputs(candidate, approved, folder)


if __name__ == "__main__":
    unittest.main()

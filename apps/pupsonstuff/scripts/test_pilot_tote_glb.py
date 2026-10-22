"""PILOT.09 unit tests for a real GLB byte stream with synthetic-only shape data."""
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).parent))
from pilot_tote_glb import (build_glb,build_geometry,blocked_destination,
                            generate_from_verified_pack,write_ci_fixture,
                            SYNTHETIC_MM,SYNTHETIC_PROFILE)

class PilotGlbTests(unittest.TestCase):
    def test_triangulated_single_mesh_glb_contains_real_normals_and_uv(self):
        geom=build_geometry(SYNTHETIC_MM,SYNTHETIC_PROFILE)
        blob,metrics=build_glb(geom)
        self.assertEqual(blob[:4],b"glTF")
        self.assertEqual(struct.unpack("<I",blob[4:8])[0],2)
        self.assertEqual(struct.unpack("<I",blob[8:12])[0],len(blob))
        length,kind=struct.unpack("<I4s",blob[12:20])
        self.assertEqual(kind,b"JSON")
        data=json.loads(blob[20:20+length])
        self.assertEqual(len(data["meshes"]),1)
        self.assertEqual(data["nodes"][0]["name"],"tote_body")
        self.assertEqual(data["materials"][0]["name"],"tote_material")
        attrs=data["meshes"][0]["primitives"][0]["attributes"]
        self.assertEqual(set(attrs),{"POSITION","NORMAL","TEXCOORD_0"})
        self.assertLess(metrics["glbBytes"],10*1024*1024)
        self.assertGreater(metrics["vertexCount"],800)
        self.assertGreater(metrics["triangleCount"],1500)
        self.assertGreater(metrics["nondegenerateTriangles"],metrics["triangleCount"]*.99)
        self.assertAlmostEqual(metrics["boundsYUpMeters"][0],.38,delta=.015)
        # Serialized glTF Y-up bounds must reflect the physical tote's
        # *whole* height including the ribbon top; use 0.5 mm tolerance.
        self.assertAlmostEqual(metrics["boundsYUpMeters"][1],.53,delta=.0005)
        self.assertLessEqual(metrics["boundsYUpMeters"][1],.5305)
        self.assertAlmostEqual(metrics["boundsYUpMeters"][2],.095,delta=.015)
        self.assertFalse(data["extras"]["storefrontApproved"])

    def test_unapproved_supplier_pack_does_not_write_candidate(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            pack=root/"pack"
            pack.mkdir()
            (pack/"manifest.json").write_text(json.dumps({
                "productId":"tote","candidateId":"tote-fake",
                "generator":"pupson-procedural-tote-cpu",
                "dimensionsMm":SYNTHETIC_MM,"proceduralTote":SYNTHETIC_PROFILE,
                "supplier":"Printify","supplierSku":None,
            }))
            out=root/"quarantine"/"draft.glb"
            result=generate_from_verified_pack(pack,out,None,execute=True)
            self.assertEqual(result["status"],"BLOCKED_REAL_SUPPLIER_EVIDENCE_REQUIRED")
            self.assertFalse(out.exists())

    def test_exclusive_quarantine_output_refuses_live_storefront_and_collision(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            with self.assertRaisesRegex(ValueError,"OUTPUT_MUST_BE_PRIVATE"):
                blocked_destination(root/"public"/"models"/"tote.glb")
            existing=root/"quarantine"/"existing.glb"
            existing.parent.mkdir()
            existing.write_bytes(b"approved bytes never overwritten")
            with self.assertRaisesRegex(ValueError,"REFUSE_EXISTING_OUTPUT"):
                blocked_destination(existing)
            self.assertEqual(existing.read_bytes(),b"approved bytes never overwritten")

    def test_fixture_refuses_non_ci_and_non_canonical_public_path(self):
        with tempfile.TemporaryDirectory() as d:
            with patch.dict(os.environ,{"CI":"false","PUPSON_3D_QA_FIXTURE":"yes",
                                        "PUPSON_CLOUDFLARE_PREVIEW_ONLY":"true"}):
                with self.assertRaisesRegex(ValueError,"SYNTHETIC_PREVIEW_MUST_BE_EPHEMERAL"):
                    write_ci_fixture(Path(d)/"fixture.glb")
            with patch.dict(os.environ,{"CI":"true","PUPSON_3D_QA_FIXTURE":"yes",
                                        "PUPSON_CLOUDFLARE_PREVIEW_ONLY":"true"}):
                with self.assertRaisesRegex(ValueError,"SYNTHETIC_PREVIEW_PATH_NOT_PERMITTED"):
                    write_ci_fixture(Path(d)/"fixture.glb")

if __name__=="__main__":
    unittest.main()

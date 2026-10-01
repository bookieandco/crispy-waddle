from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location("director_speaker_qc_vercel_oidc",ROOT/"vercel_oidc.py")
if spec is None or spec.loader is None:
    raise RuntimeError("VERCEL_OIDC_TEST_IMPORT_FAILED")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class VercelOidcPolicyTests(unittest.TestCase):
    def trusted(self):
        return {
            "sub":module.SUBJECT,
            "owner":module.OWNER,
            "owner_id":module.OWNER_ID,
            "project":module.PROJECT,
            "project_id":module.PROJECT_ID,
            "environment":module.ENVIRONMENT,
        }

    def test_accepts_only_canonical_production_project_claims(self):
        self.assertTrue(module.claims_are_trusted(self.trusted()))

    def test_rejects_preview_environment(self):
        claims=self.trusted()
        claims["environment"]="preview"
        self.assertFalse(module.claims_are_trusted(claims)

    def test_rejects_other_project(self):
        claims=self.trusted()
        claims["project_id"]="prj_other"
        self.assertFalse(module.claims_are_trusted(claims)

if __name__=="__main__":
    unittest.main()

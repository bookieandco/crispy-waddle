import importlib.util
from pathlib import Path
import sys
import types
import unittest

ROOT=Path(__file__).parent

fake_jwt=types.ModuleType("jwt")
class FakePyJWKClient:
    def __init__(self,*args,**kwargs):
        pass
fake_jwt.PyJWKClient=FakePyJWKClient
fake_jwt.decode=lambda *args,**kwargs: {}
sys.modules.setdefault("jwt",fake_jwt)

spec=importlib.util.spec_from_file_location("music_restoration_vercel_oidc",ROOT/"vercel_oidc.py")
if spec is None or spec.loader is None:
    raise ImportError("music restoration Vercel OIDC spec unavailable")
oidc=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=oidc
spec.loader.exec_module(oidc)

class MusicRestorationVercelOidcTest(unittest.TestCase):
    def trusted_claims(self):
        return {
            "sub":oidc.SUBJECT,
            "owner":oidc.OWNER,
            "owner_id":oidc.OWNER_ID,
            "project":oidc.PROJECT,
            "project_id":oidc.PROJECT_ID,
            "environment":oidc.ENVIRONMENT,
        }

    def test_claims_pin_exact_production_project(self):
        self.assertTrue(oidc.claims_are_trusted(self.trusted_claims()))

    def test_claims_reject_wrong_environment(self):
        claims=self.trusted_claims()
        claims["environment"]="preview"
        self.assertFalse(oidc.claims_are_trusted(claims))

    def test_claims_reject_wrong_project(self):
        claims=self.trusted_claims()
        claims["project_id"]="prj_other"
        self.assertFalse(oidc.claims_are_trusted(claims))

    def test_oversized_token_is_rejected_before_jwks(self):
        self.assertFalse(oidc.authorize_vercel_token("x"*(oidc.MAX_TOKEN_BYTES+1)))

if __name__=="__main__":
    unittest.main()

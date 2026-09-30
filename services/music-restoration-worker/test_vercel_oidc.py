import importlib.util
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import MagicMock, patch

ROOT=Path(__file__).parent

fake_jwt=types.ModuleType("jwt")
fake_jwt.decode=MagicMock()
fake_jwt.PyJWKClient=MagicMock
sys.modules.setdefault("jwt",fake_jwt)

spec=importlib.util.spec_from_file_location("music_restoration_vercel_oidc",ROOT/"vercel_oidc.py")
if spec is None or spec.loader is None:
    raise ImportError("music restoration Vercel OIDC spec unavailable")
vercel_oidc=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=vercel_oidc
spec.loader.exec_module(vercel_oidc)

ENV={
    "MUSIC_RESTORATION_VERCEL_OWNER":"bookieandcos-projects",
    "MUSIC_RESTORATION_VERCEL_OWNER_ID":"team_NYQJ3NwijZZ6UJQdOdc5FjmX",
    "MUSIC_RESTORATION_VERCEL_PROJECT_ID":"prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco",
    "MUSIC_RESTORATION_VERCEL_ENVIRONMENT":"production",
    "MUSIC_RESTORATION_VERCEL_AUDIENCE":"https://vercel.com/bookieandcos-projects",
}

class VercelOidcTest(unittest.TestCase):
    def setUp(self):
        fake_jwt.decode.reset_mock()

    def test_verifies_team_issuer_and_exact_project_claims(self):
        claims={
            "iss":"https://oidc.vercel.com/bookieandcos-projects",
            "sub":"owner:bookieandcos-projects:project:crispy-waddle-jhadina-web:environment:production",
            "aud":"https://vercel.com/bookieandcos-projects",
            "owner":"bookieandcos-projects",
            "owner_id":"team_NYQJ3NwijZZ6UJQdOdc5FjmX",
            "project_id":"prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco",
            "environment":"production",
            "iat":1,
            "exp":2,
        }
        fake_jwt.decode.side_effect=[
            {"iss":claims["iss"]},
            claims,
        ]
        client=MagicMock()
        client.get_signing_key_from_jwt.return_value=types.SimpleNamespace(key="public-key")
        with patch.dict(os.environ,ENV,clear=False), patch.object(vercel_oidc,"_jwks_client",return_value=client):
            verified=vercel_oidc.verify_vercel_oidc("header.payload.signature")
        self.assertEqual(verified["project_id"],ENV["MUSIC_RESTORATION_VERCEL_PROJECT_ID"])
        client.get_signing_key_from_jwt.assert_called_once_with("header.payload.signature")
        second=fake_jwt.decode.call_args_list[1]
        self.assertEqual(second.kwargs["issuer"],claims["iss"])
        self.assertEqual(second.kwargs["audience"],ENV["MUSIC_RESTORATION_VERCEL_AUDIENCE"])

    def test_rejects_valid_token_from_other_project(self):
        claims={
            "iss":"https://oidc.vercel.com/bookieandcos-projects",
            "sub":"other",
            "aud":"https://vercel.com/bookieandcos-projects",
            "owner":"bookieandcos-projects",
            "owner_id":"team_NYQJ3NwijZZ6UJQdOdc5FjmX",
            "project_id":"prj_OTHER",
            "environment":"production",
            "iat":1,
            "exp":2,
        }
        fake_jwt.decode.side_effect=[{"iss":claims["iss"]},claims]
        client=MagicMock()
        client.get_signing_key_from_jwt.return_value=types.SimpleNamespace(key="public-key")
        with patch.dict(os.environ,ENV,clear=False), patch.object(vercel_oidc,"_jwks_client",return_value=client):
            with self.assertRaisesRegex(ValueError,"PROJECT_ID_MISMATCH"):
                vercel_oidc.verify_vercel_oidc("header.payload.signature")

    def test_rejects_untrusted_issuer_before_jwks_fetch(self):
        fake_jwt.decode.return_value={"iss":"https://evil.example/oidc"}
        with patch.dict(os.environ,ENV,clear=False), patch.object(vercel_oidc,"_jwks_client") as jwks:
            with self.assertRaisesRegex(ValueError,"ISSUER_NOT_ADMITTED"):
                vercel_oidc.verify_vercel_oidc("header.payload.signature")
        jwks.assert_not_called()

if __name__=="__main__":
    unittest.main()

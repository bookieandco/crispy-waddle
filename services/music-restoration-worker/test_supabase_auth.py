import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

ROOT=Path(__file__).parent

fake_jwt=types.ModuleType("jwt")
fake_jwt.decode=lambda *args,**kwargs: {}
sys.modules.setdefault("jwt",fake_jwt)

spec=importlib.util.spec_from_file_location("music_restoration_supabase_auth",ROOT/"supabase_auth.py")
if spec is None or spec.loader is None:
    raise ImportError("music restoration Supabase auth spec unavailable")
auth=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=auth
spec.loader.exec_module(auth)

USER_ID="123e4567-e89b-12d3-a456-426614174000"

class FakeResponse:
    def __init__(self,payload,status=200):
        self.status=status
        self.payload=payload
    def __enter__(self):
        return self
    def __exit__(self,*args):
        return False
    def read(self):
        return json.dumps(self.payload).encode("utf-8")

class SupabaseSessionAuthTest(unittest.TestCase):
    def claims(self,**overrides):
        base={
            "iss":auth.SUPABASE_ISSUER,
            "aud":"authenticated",
            "role":"authenticated",
            "sub":USER_ID,
            "session_id":"session-1",
            "aal":"aal1",
        }
        base.update(overrides)
        return base

    def test_authorizes_verified_project_user_and_binds_requested_user(self):
        with patch.object(auth.jwt,"decode",return_value=self.claims()),              patch.object(auth.urllib.request,"urlopen",return_value=FakeResponse({"id":USER_ID,"is_anonymous":False})) as urlopen:
            result=auth.authorize_supabase_user("header.payload.signature",USER_ID)
        self.assertEqual(result["authMode"],"supabase-session")
        self.assertEqual(result["userId"],USER_ID)
        request=urlopen.call_args.args[0]
        self.assertEqual(request.full_url,auth.SUPABASE_USER_URL)
        self.assertEqual(request.headers["Authorization"],"Bearer header.payload.signature")
        self.assertEqual(request.headers["Apikey"],auth.SUPABASE_PUBLISHABLE_KEY)

    def test_rejects_claimed_user_mismatch_before_network(self):
        other="123e4567-e89b-12d3-a456-426614174001"
        with patch.object(auth.jwt,"decode",return_value=self.claims()),              patch.object(auth.urllib.request,"urlopen") as urlopen:
            self.assertIsNone(auth.authorize_supabase_user("token",other))
        urlopen.assert_not_called()

    def test_rejects_wrong_issuer_role_or_audience_before_network(self):
        variants=[
            self.claims(iss="https://evil.example/auth/v1"),
            self.claims(role="service_role"),
            self.claims(aud="anon"),
        ]
        for claims in variants:
            with self.subTest(claims=claims),                  patch.object(auth.jwt,"decode",return_value=claims),                  patch.object(auth.urllib.request,"urlopen") as urlopen:
                self.assertIsNone(auth.authorize_supabase_user("token",USER_ID))
                urlopen.assert_not_called()

    def test_rejects_user_endpoint_identity_mismatch(self):
        other="123e4567-e89b-12d3-a456-426614174001"
        with patch.object(auth.jwt,"decode",return_value=self.claims()),              patch.object(auth.urllib.request,"urlopen",return_value=FakeResponse({"id":other,"is_anonymous":False})):
            self.assertIsNone(auth.authorize_supabase_user("token",USER_ID))

    def test_rejects_anonymous_user(self):
        with patch.object(auth.jwt,"decode",return_value=self.claims()),              patch.object(auth.urllib.request,"urlopen",return_value=FakeResponse({"id":USER_ID,"is_anonymous":True})):
            self.assertIsNone(auth.authorize_supabase_user("token",USER_ID))

if __name__=="__main__":
    unittest.main()

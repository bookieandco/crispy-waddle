#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path

path=Path(__file__).with_name("money-portable-production-probe.py")
spec=importlib.util.spec_from_file_location("money_portable_probe",path)
assert spec and spec.loader
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
SHA="a"*40
WEB={"success":True,"status":"healthy","durableMemory":"ready",
     "environment":"production","commitSha":SHA}
GATEWAY={"ok":True,"service":"jhadina-portable-memory-gateway",
         "authority":"MEMORY_STORAGE_TRANSPORT_ONLY","canExecute":False}

class Tests(unittest.TestCase):
    def test_matching_two_real_endpoint_shape_is_still_review_only(self):
        r=mod.inspect_probes(WEB,GATEWAY,SHA)
        self.assertEqual(r["status"],"PORTABLE_WEB_PROBE_REVIEW_REQUIRED")
        self.assertEqual(r["finalCertification"],"NOT_ISSUED")
        self.assertFalse(r["canAuthorizeLive"])
    def test_stale_web_sha_and_missing_memory_are_blocked(self):
        r=mod.inspect_probes({**WEB,"durableMemory":None,"commitSha":"b"*40},GATEWAY,SHA)
        self.assertEqual(r["status"],"BLOCKED")
        self.assertIn("VERCEL_DURABLE_EXACT_SHA_NOT_PROVEN",r["reasonCodes"])
    def test_fake_gateway_and_exec_authority_are_blocked(self):
        for patch in ({"ok":False},{"canExecute":True},{"service":"other"}):
            r=mod.inspect_probes(WEB,{**GATEWAY,**patch},SHA)
            self.assertEqual(r["status"],"BLOCKED")
    def test_prod_origin_rejects_http_and_embedded_credentials(self):
        for value in ("http://localhost:3000","https://me:password@example.com",
                      "https://example.com/evil","https://example.com?token=abc"):
            with self.assertRaises(ValueError):mod.strict_https_origin(value)
        self.assertEqual(mod.strict_https_origin("https://example.com/"),"https://example.com")
    def test_expected_sha_must_be_40_hex(self):
        with self.assertRaises(ValueError):mod.inspect_probes(WEB,GATEWAY,"main")
if __name__=="__main__":unittest.main()

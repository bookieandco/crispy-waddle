import datetime as dt
import importlib.util
import json
import pathlib
import unittest
from unittest.mock import patch

HERE=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location("private_report",HERE/"private_report.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
probe=m.digest

class TelegramNoSecretsAndPublicRPCTests(unittest.TestCase):
    def test_default_private_send_disabled(self):
        when=dt.datetime(2026,10,14,23,14,tzinfo=dt.timezone.utc)
        self.assertFalse(m.report_enabled(when,"schedule","false"))
        self.assertFalse(m.report_enabled(when,"push","true"))
        self.assertFalse(m.report_enabled(when.replace(hour=21),"schedule","true"))
        self.assertTrue(m.report_enabled(when,"schedule","true"))

    def test_send_fails_closed_without_owner_id_or_token(self):
        def forbidden(*args,**kwargs):
            raise AssertionError("no_network_when_secrets_missing")
        self.assertFalse(m.send_private("safe","", "12",forbidden))
        self.assertFalse(m.send_private("safe","secret","not_an_id",forbidden))

    def test_send_uses_exact_owner_chat_and_no_log(self):
        class Response:
            status=200
            def __enter__(self): return self
            def __exit__(self,*a): return False
            def read(self,n): return b'{"ok":true}'
        seen=[]
        def fake(req,timeout):
            seen.append((req.full_url,req.data.decode()))
            return Response()
        self.assertTrue(m.send_private("paper-only","opaque-key","12345",fake))
        self.assertIn("chat_id=12345",seen[0][1])
        self.assertIn("text=paper-only",seen[0][1])
        self.assertNotIn("opaque-key",seen[0][1])

    def test_public_rpc_failover_requires_no_keys(self):
        class Response:
            status=200
            def __enter__(self): return self
            def __exit__(self,*a): return False
            def read(self,n):
                return json.dumps({"jsonrpc":"2.0","result":{"context":{"slot":100},"value":None},"id":1}).encode()
        called=[]
        def fake(req,timeout):
            called.append(req.full_url)
            if len(called)==1:
                raise probe.urllib.error.URLError("temporary outage")
            return Response()
        with patch.object(probe.urllib.request,"urlopen",fake):
            result=probe.rpc("getAccountInfo",["So11111111111111111111111111111111111111112",{"encoding":"jsonParsed"}])
        self.assertEqual(result["_readOnlyProvider"],"PUBLICNODE_FREE")
        self.assertEqual(called,list(probe.RPC_URLS))
        self.assertTrue(all("apikey" not in url.lower() for url in called))
        with self.assertRaisesRegex(ValueError,"disallowed_rpc_method"):
            probe.rpc("sendTransaction",[])

    def test_public_rpc_both_down_stays_unverified(self):
        def fail(*args,**kwargs): raise probe.urllib.error.URLError("unavailable")
        with patch.object(probe.urllib.request,"urlopen",fail):
            with self.assertRaisesRegex(ValueError,"all_public_rpc_sources_unavailable"):
                probe.rpc("getAccountInfo",["fake",{}])


if __name__=="__main__":
    unittest.main()

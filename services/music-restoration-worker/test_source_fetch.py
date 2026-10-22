import importlib.util
from hashlib import sha256
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location("restoration_source_fetch", ROOT/"source_fetch.py")
source_fetch=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=source_fetch
spec.loader.exec_module(source_fetch)

class Response:
    def __init__(self,status,content=b"",location=None):
        self.status=status
        self.content=content
        self.location=location
        self.used=False
    def getheader(self,key):
        return self.location if key=="Location" else None
    def read(self,n):
        if self.used:return b""
        self.used=True
        return self.content
class Connection:
    def __init__(self):self.closed=False
    def close(self):self.closed=True

class SourceFetchBoundaryTest(unittest.TestCase):
    def test_suffix_must_be_hostname_label(self):
        self.assertTrue(source_fetch._admitted_url("https://project.supabase.co/file",(".supabase.co",)))
        for url in ("https://evilsupabase.co/file","https://supabase.co.evil.test/file",
                    "https://127.0.0.1/file","https://project.supabase.co:8443/file",
                    "http://project.supabase.co/file","https://me@project.supabase.co/file"):
            self.assertFalse(source_fetch._admitted_url(url,(".supabase.co",)),url)

    def test_bad_redirect_rejected_without_following(self):
        with tempfile.TemporaryDirectory() as td:
            target=Path(td)/"source.wav"
            a=Connection()
            with patch.object(source_fetch,"_request_once",
                              return_value=(a,Response(302,location="https://127.0.0.1/internal"))) as call:
                with self.assertRaisesRegex(ValueError,"REDIRECT_NOT_ADMITTED"):
                    source_fetch.stage_verified_source("https://good.supabase.co/a","a"*64,target)
                self.assertEqual(call.call_count,1)
                self.assertTrue(a.closed)
                self.assertFalse(target.exists())
                self.assertFalse(list(Path(td).glob("*.part")))

    def test_success_redirect_hash_and_atomic_publish(self):
        payload=b"valid authorized recording"
        digest=sha256(payload).hexdigest()
        a,b=Connection(),Connection()
        with tempfile.TemporaryDirectory() as td:
            target=Path(td)/"source.wav"
            with patch.object(source_fetch,"_request_once",side_effect=[
                (a,Response(302,location="/signed-source")),
                (b,Response(200,content=payload)),
            ]) as call:
                size=source_fetch.stage_verified_source("https://good.supabase.co/start",digest,target)
            self.assertEqual(size,len(payload))
            self.assertEqual(target.read_bytes(),payload)
            self.assertEqual(call.call_args_list[-1].args[0],"https://good.supabase.co/signed-source")
            self.assertTrue(a.closed and b.closed)

    def test_hash_failure_preserves_prior_file(self):
        with tempfile.TemporaryDirectory() as td:
            target=Path(td)/"source.wav"; target.write_bytes(b"earlier")
            with patch.object(source_fetch,"_request_once",return_value=
                              (Connection(),Response(200,content=b"tamper"))):
                with self.assertRaisesRegex(ValueError,"HASH_MISMATCH"):
                    source_fetch.stage_verified_source("https://good.supabase.co/a","a"*64,target)
            self.assertEqual(target.read_bytes(),b"earlier")

if __name__=="__main__":unittest.main()

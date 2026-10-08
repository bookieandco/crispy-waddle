import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from scan_plugins import discover_installed_plugins, default_roots
from local_discovery import create_handler
class ScannerTests(unittest.TestCase):
    def test_only_local_sanitized_vst_bundle_metadata(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/"Good Guitar.vst3").mkdir()
            (root/"Bad.exe").mkdir()
            (root/"Windows Synth.vst3").write_bytes(b"MZ"+"native plugin fake; scanner never executes".encode())
            (root/"NotAPlugin.vst3").write_text("not a plugin bundle")
            out=discover_installed_plugins("a"*48,[root])
            self.assertEqual(len(out),2)
            self.assertEqual(out[0]["name"],"Good Guitar")
            self.assertEqual(out[1]["name"],"Windows Synth")
            self.assertEqual(out[0]["format"],"vst3")
            self.assertNotIn(str(root),str(out))
            self.assertEqual(out[0]["status"],"discovered-not-executable")
    def test_symlink_escape_never_followed(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            external=root/"outside";external.mkdir()
            (external/"Bad.vst3").mkdir()
            sub=root/"plugins";sub.mkdir()
            (sub/"Hidden.vst3").symlink_to(external/"Bad.vst3",target_is_directory=True)
            self.assertEqual(discover_installed_plugins("b"*48,[sub]),[])
    def test_token_and_https_origin_required(self):
        with self.assertRaises(ValueError):
            create_handler("short","https://myapp.example")
        with self.assertRaises(ValueError):
            create_handler("a"*48,"http://myapp.example")
    def test_stable_ids_never_allow_browsers_to_choose_scan_roots(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/"Echo.vst3").mkdir()
            a=discover_installed_plugins("s"*48,[root])
            b=discover_installed_plugins("s"*48,[root])
            c=discover_installed_plugins("t"*48,[root])
            self.assertEqual(a,b)
            self.assertNotEqual(a[0]["pluginId"],c[0]["pluginId"])
if __name__=="__main__":
    unittest.main()

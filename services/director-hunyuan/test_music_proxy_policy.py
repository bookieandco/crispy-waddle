import importlib.util
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location("director_hunyuan_music_proxy_policy",ROOT/"music_proxy_policy.py")
if spec is None or spec.loader is None:
    raise ImportError("Director Hunyuan Music proxy policy spec unavailable")
policy=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=policy
spec.loader.exec_module(policy)

class MusicProxyPolicyTest(unittest.TestCase):
    def test_health_is_get_only(self):
        self.assertTrue(policy.music_proxy_path_allowed("health","GET"))
        self.assertTrue(policy.music_proxy_path_allowed("health/live","GET"))
        self.assertFalse(policy.music_proxy_path_allowed("health","POST"))

    def test_compute_endpoints_are_post_only(self):
        for path in ("v1/probe","v1/separate","v1/perceive","v1/execute"):
            self.assertTrue(policy.music_proxy_path_allowed(path,"POST"))
            self.assertFalse(policy.music_proxy_path_allowed(path,"GET"))

    def test_artifacts_are_allowlisted_by_token_and_name(self):
        token="a"*24
        self.assertTrue(policy.music_proxy_path_allowed(f"v1/jobs/{token}/artifact/vocals.wav","GET"))
        self.assertTrue(policy.music_proxy_path_allowed(f"v1/jobs/{token}/artifact/output.wav","GET"))
        self.assertFalse(policy.music_proxy_path_allowed(f"v1/jobs/{token}/artifact/secret.wav","GET"))
        self.assertFalse(policy.music_proxy_path_allowed("v1/jobs/../../etc/passwd/artifact/output.wav","GET"))
        self.assertFalse(policy.music_proxy_path_allowed(f"v1/jobs/{token}/artifact/output.wav","POST"))

    def test_arbitrary_local_paths_are_rejected(self):
        for path in ("docs","openapi.json","metrics","v1/jobs","../health","health?x=1"):
            self.assertFalse(policy.music_proxy_path_allowed(path,"GET"))

if __name__=="__main__":
    unittest.main()

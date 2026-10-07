import importlib.util
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location(
    "director_hunyuan_human_media_proxy_policy",
    ROOT/"human_media_proxy_policy.py",
)
if spec is None or spec.loader is None:
    raise ImportError("Director human-media proxy policy spec unavailable")
policy=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=policy
spec.loader.exec_module(policy)

class HumanMediaProxyPolicyTests(unittest.TestCase):
    def test_health_is_get_only(self):
        self.assertTrue(policy.human_media_proxy_path_allowed("health","GET"))
        self.assertTrue(policy.human_media_proxy_path_allowed("health/live","GET"))
        self.assertFalse(policy.human_media_proxy_path_allowed("health","POST"))

    def test_job_collection_is_submit_only(self):
        self.assertTrue(policy.human_media_proxy_path_allowed("v1/jobs","POST"))
        self.assertFalse(policy.human_media_proxy_path_allowed("v1/jobs","GET"))

    def test_job_identity_supports_status_cancel_and_artifact(self):
        job="musetalk-0123456789abcdef01234567"
        self.assertTrue(policy.human_media_proxy_path_allowed(f"v1/jobs/{job}","GET"))
        self.assertTrue(policy.human_media_proxy_path_allowed(f"v1/jobs/{job}","DELETE"))
        self.assertFalse(policy.human_media_proxy_path_allowed(f"v1/jobs/{job}","POST"))
        self.assertTrue(policy.human_media_proxy_path_allowed(f"v1/jobs/{job}/artifact","GET"))
        self.assertFalse(policy.human_media_proxy_path_allowed(f"v1/jobs/{job}/artifact","POST"))

    def test_arbitrary_or_traversal_paths_are_rejected(self):
        for path in (
            "docs",
            "openapi.json",
            "../health",
            "v1/jobs/../../etc/passwd",
            "health?x=1",
            "v1/jobs/job/other",
        ):
            self.assertFalse(policy.human_media_proxy_path_allowed(path,"GET"))

if __name__=="__main__":
    unittest.main()

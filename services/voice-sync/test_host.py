import importlib.util
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location("host",Path(__file__).with_name("host.py"));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class R:
 def synchronize(self,b):raise RuntimeError("secret /models/checkpoint")
class T(unittest.TestCase):
 def test_redacts_runtime_failure(self):self.assertEqual(m.create_app(R())("POST","/v1/synchronize",{})[1],{"error":"voice_sync_failed"})
if __name__=="__main__":unittest.main()

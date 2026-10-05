import importlib.util
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
spec=importlib.util.spec_from_file_location("director_post_app",HERE/"app.py")
with patch.dict(os.environ,{"DIRECTOR_POST_WORKER_TOKEN":"secret"}):
    app=importlib.util.module_from_spec(spec); spec.loader.exec_module(app)


class AppTests(unittest.TestCase):
    def test_authorization(self):
        with patch.dict(os.environ,{"DIRECTOR_POST_WORKER_TOKEN":"secret"}):
            app.authorize("Bearer secret")
            with self.assertRaises(Exception):
                app.authorize("Bearer wrong")


if __name__ == "__main__":
    unittest.main()

"""Static contract for owner-authorized, synthetic-only Colab My Drive canary."""
import json
import unittest
from pathlib import Path


class ColabCanaryTests(unittest.TestCase):
    def test_notebook_is_synthetic_and_declines_production_certification(self):
        notebook=json.loads((Path(__file__).parent/"COLAB-MYDRIVE-SYNTHETIC.ipynb").read_text())
        self.assertEqual(notebook["nbformat"],4)
        code="\n".join("".join(cell["source"]) for cell in notebook["cells"] if cell["cell_type"]=="code")
        self.assertIn("drive.mount('/content/drive')",code)
        self.assertIn("07-DVC-VERSIONED-ASSETS",code)
        self.assertIn("secrets.token_bytes(64)",code)
        self.assertIn("dvc('push'",code)
        self.assertIn("dvc('pull'",code)
        self.assertIn("shutil.rmtree(cache)",code)
        self.assertIn("'dvc_gdrive_plugin_authenticated':False",code)
        self.assertIn("'machine_google_oauth_verified':False",code)
        self.assertIn("'production_backup_restored':False",code)
        self.assertNotIn("GDRIVE_CREDENTIALS_DATA",code)
        self.assertNotIn("MC_HOST_",code)
        self.assertNotIn("dvc('gc'",code)
        self.assertNotIn("remote.unlink(",code)
        self.assertNotIn("shutil.rmtree(remote)",code)

    def test_each_code_cell_compiles(self):
        notebook=json.loads((Path(__file__).parent/"COLAB-MYDRIVE-SYNTHETIC.ipynb").read_text())
        for i,cell in enumerate(notebook["cells"]):
            if cell["cell_type"]=="code":
                compile("".join(cell["source"]),f"colab-cell-{i}","exec")


if __name__=="__main__":
    unittest.main()

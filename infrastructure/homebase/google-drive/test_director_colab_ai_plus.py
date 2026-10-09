"""Hermetic source contract: Colab AI Plus trial is owner-run, synthetic and non-authoritative."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent
NOTEBOOK = ROOT / "DIRECTOR-COLAB-AI-PLUS-PREFLIGHT.ipynb"


class DirectorColabNotebookSafetyTests(unittest.TestCase):
    def test_valid_notebook_is_unexecuted(self) -> None:
        notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
        self.assertEqual(notebook["nbformat"], 4)
        self.assertGreaterEqual(len(notebook["cells"]), 3)
        code = [cell for cell in notebook["cells"] if cell["cell_type"] == "code"]
        for cell in code:
            self.assertIsNone(cell["execution_count"])
            self.assertEqual(cell["outputs"], [])
        self.assertEqual(len(code), 2)

    def test_notebook_cannot_auto_spend_promote_or_access_private_media(self) -> None:
        notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
        src = "\n".join("".join(c["source"]) for c in notebook["cells"] if c["cell_type"] == "code")
        required = [
            "OWNER_APPROVES_THIS_TRIAL = False",
            "RUN_SYNTHETIC_TRAINING = False",
            "REPORTED_REMAINING_UNITS = None",
            "RESERVED_UNITS = 10",
            "reported_remaining_units_before",
            "actual_provider_compute_units_consumed",
            '"model_training_completed": False',
            '"director_character_trained": False',
            '"production_certified": False',
            "torch.cuda.is_available()",
        ]
        for token in required:
            with self.subTest(token=token):
                self.assertIn(token, src)
        forbidden = [
            "drive.mount(",
            "google.auth.default(",
            "subprocess.run(",
            "pip install",
            "requests.post(",
            "https://colaboratory.googleapis.com",
            "service_role",
            "upload_from_filename(",
        ]
        for token in forbidden:
            with self.subTest(forbidden=token):
                self.assertNotIn(token, src)


if __name__ == "__main__":
    unittest.main()

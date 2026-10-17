"""Source-only safety checks; no Colab runtime, payment, or model download."""
import ast
import json
import pathlib
import unittest

HERE = pathlib.Path(__file__).resolve().parent
NOTEBOOK = HERE / "JHADINA-CANDIDATE2-V2-VOICE-GOOGLE-AI-PLUS.ipynb"
PACK = pathlib.Path(__file__).resolve().parents[3] / "docs/architecture/jhadina-candidate2-voice-v2-audition.json"


class JhadinaVoiceAiPlusColabTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
        cls.cells = ["".join(c["source"]) for c in cls.data["cells"] if c["cell_type"] == "code"]
        cls.source = "\n".join(cls.cells)

    def test_valid_unexecuted_notebook(self):
        self.assertEqual(self.data["nbformat"], 4)
        self.assertEqual(len(self.cells), 5)
        for cell in self.data["cells"]:
            if cell["cell_type"] == "code":
                self.assertIsNone(cell["execution_count"])
                self.assertEqual(cell["outputs"], [])
                ast.parse("".join(cell["source"]))

    def test_explicit_no_spend_default_and_reserve(self):
        for term in (
            "REPORTED_REMAINING_UNITS = None",
            "OWNER_APPROVES_THIS_TRIAL = False",
            "RUN_GENERATION = False",
            "RESERVED_UNITS = 10",
            "PLANNED_EXPERIMENT_UNITS = 3",
            "budget_gate()",
            "units>=PLANNED_EXPERIMENT_UNITS+RESERVED_UNITS",
            "torch.cuda.is_available()",
        ):
            with self.subTest(term=term):
                self.assertIn(term, self.source)
        # Budget gate is executable independently without Colab/GPU imports.
        ns = {}
        exec(compile(self.cells[0], "<admission>", "exec"), ns)
        with self.assertRaises(AssertionError):
            ns["budget_gate"]()
        ns["OWNER_APPROVES_THIS_TRIAL"] = True
        ns["RUN_GENERATION"] = True
        ns["REPORTED_REMAINING_UNITS"] = 12
        with self.assertRaises(AssertionError):
            ns["budget_gate"]()
        ns["REPORTED_REMAINING_UNITS"] = 35
        self.assertTrue(ns["budget_gate"]())

    def test_embedded_canonical_pack_and_unapproved_receipts(self):
        self.assertTrue(PACK.exists(), "canonical source pack must exist")
        canonical = json.loads(PACK.read_text(encoding="utf-8"))
        node = ast.parse(self.cells[2])
        assignment = next(n for n in node.body if isinstance(n, ast.Assign)
                          and isinstance(n.targets[0], ast.Name) and n.targets[0].id == "PACK")
        raw = ast.literal_eval(assignment.value.args[0])
        embedded = json.loads(raw)
        self.assertEqual(embedded, canonical)
        self.assertEqual(embedded["reference"]["candidateId"], "jhadina-audition:1274")
        self.assertEqual(len(embedded["variants"]), 4)
        self.assertIn("'productionApproved':False", self.source)
        self.assertIn("'speakerSimilarityMeasured':False", self.source)
        self.assertIn("'qualityClaim':False", self.source)

    def test_private_drive_and_no_autonomous_production_actions(self):
        self.assertIn("JHADINA-HOMEBASE/Jhadina Voice Auditions - Private", self.source)
        self.assertIn("original-candidate-2.mp3", self.source)
        self.assertIn("drive.mount('/content/drive')", self.source)
        for forbidden in ("runpodctl", "wrangler pages deploy", "cloudflare_api_token",
                          "service_role", "storeProductionVoice", "requests.post("):
            self.assertNotIn(forbidden, self.source)


if __name__ == "__main__":
    unittest.main()

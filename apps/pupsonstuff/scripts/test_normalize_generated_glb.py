"""CPU-only contract checks: never imports bpy or downloads model weights."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).with_name("normalize_generated_glb.py")
spec = importlib.util.spec_from_file_location("pupson_normalizer", SCRIPT)
normalizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalizer)


class NormalizationContractTests(unittest.TestCase):
    def test_three_verified_positive_dimensions(self):
        self.assertEqual(normalizer.parse_measurements("500,700,120"), (500, 700, 120))
        for bad in ("500,700", "-500,700,120", "500,nan,120", "500,inf,120", "0,700,120"):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    normalizer.parse_measurements(bad)

    def test_one_uniform_scale_yields_expected_dimensions(self):
        scale, bounds = normalizer.uniform_scale_plan((5, 7, 1.2), (500, 700, 120))
        self.assertAlmostEqual(scale, 0.1)
        for got, expected in zip(bounds, (0.5, 0.7, 0.12)):
            self.assertAlmostEqual(got, expected)

    def test_does_not_stretch_thin_hoodie_or_oval_mug(self):
        with self.assertRaisesRegex(ValueError, "NONUNIFORM_PROPORTIONS_REFUSE_DISTORTION"):
            normalizer.uniform_scale_plan((5, 7, 0.25), (500, 700, 120))
        with self.assertRaisesRegex(ValueError, "NONUNIFORM_PROPORTIONS_REFUSE_DISTORTION"):
            normalizer.uniform_scale_plan((1, 2, 1.5), (100, 200, 100))

    def test_rejects_zero_or_nonfinite_mesh_bounds(self):
        for dims in ((0, 7, 1.2), (5, float("inf"), 1.2), (5, -7, 1.2)):
            with self.subTest(dims=dims):
                with self.assertRaises(ValueError):
                    normalizer.uniform_scale_plan(dims, (500, 700, 120))

    def test_material_profiles_are_physically_distinct(self):
        fabric_metal, fabric_rough = normalizer.PROFILE["textile"]
        ceramic_metal, ceramic_rough = normalizer.PROFILE["ceramic"]
        self.assertEqual(fabric_metal, 0.0)
        self.assertEqual(ceramic_metal, 0.0)
        self.assertGreater(fabric_rough, ceramic_rough)


if __name__ == "__main__":
    unittest.main()

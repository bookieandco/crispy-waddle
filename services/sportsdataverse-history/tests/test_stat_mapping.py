from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from stat_mapping import decode_stat_value, normalize_name, resolve_stat


class SportHistoryESPNMetadataTests(unittest.TestCase):
    def test_points_and_threes_resolve_by_names_not_position(self):
        names = ["minutes", "threePointsMade", "points"]
        self.assertEqual(resolve_stat("stat_2", names), "points")
        self.assertEqual(resolve_stat("stat_1", names), "three_point_field_goals_made")
        self.assertEqual(decode_stat_value("32", "points"), 32.0)
        self.assertEqual(decode_stat_value("4-9", "three_point_field_goals_made"), 4.0)

    def test_reordered_columns_do_not_change_meaning(self):
        names = ["points", "fieldGoalsMade", "threePointFieldGoals"]
        self.assertEqual(resolve_stat("stat_0", names), "points")
        self.assertEqual(resolve_stat("stat_2", names), "three_point_field_goals_made")
        self.assertEqual(decode_stat_value("5-10", "three_point_field_goals_made"), 5.0)

    def test_unknown_stat_indexes_are_not_guessed(self):
        self.assertIsNone(resolve_stat("stat_13", None))
        self.assertIsNone(resolve_stat("stat_13", ["points"]))
        self.assertIsNone(resolve_stat("stat_0", [""]))
        self.assertIsNone(resolve_stat("stat_0", ["stat_0"]))
        self.assertEqual(resolve_stat("stat_0", ["points"]), "points")

    def test_fail_closed_on_invalid_stat_numbers(self):
        self.assertIsNone(decode_stat_value("not-a-number", "points"))
        self.assertIsNone(decode_stat_value("12-9", "three_point_field_goals_made"))
        self.assertIsNone(decode_stat_value("4-9", "points"))
        self.assertIsNone(decode_stat_value(float("nan"), "points"))
        self.assertIsNone(decode_stat_value(True, "points"))

    def test_known_aliases(self):
        self.assertEqual(normalize_name("threePointsMade"), "three_point_field_goals_made")
        self.assertEqual(normalize_name("threePointFieldGoalsMade"), "three_point_field_goals_made")
        self.assertEqual(normalize_name("3PT"), "three_point_field_goals_made")
        self.assertEqual(normalize_name("PTS"), "points")


if __name__ == "__main__":
    unittest.main()

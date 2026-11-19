"""Exercise year-specific replacement identities without the local licensed data."""
import csv
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_period_admin import read_atlas


class AtlasIdentityTest(unittest.TestCase):
    def test_competing_coordinates_are_withheld_only_for_their_year_and_id(self):
        fields = ['year', 'id', 'name', 'lon', 'lat', 'chgis_id']
        candidates = [
            [2, 1, '甲县', 110, 32, 10],
            [742, 2, '甲县', 111, 32, 10],
            [742, 3, '甲县', 112, 32, 10],
            [742, 4, '甲县', 113, 32, 10],
            [742, 5, '甲县', 114, 32, 11],
            [742, 6, '甲县', 115, 32, 12],
            [1102, 7, '甲县', 113, 32, 10],
            [1820, 8, '甲县', 113, 32, 10],
        ]
        with TemporaryDirectory() as temp:
            path = Path(temp) / 'candidates.csv'
            for order in (candidates, reversed(candidates)):
                with path.open('w', newline='', encoding='utf-8') as handle:
                    writer = csv.writer(handle)
                    writer.writerow(fields)
                    writer.writerows(order)
                rows, skipped = read_atlas(path)
                self.assertEqual({(row[0], row[10]) for row in rows}, {
                    ('atlas:2:1', 'chgis:1:10'),
                    ('atlas:742:5', 'chgis:1:11'), ('atlas:742:6', 'chgis:1:12'),
                    ('atlas:1102:7', 'chgis:1:10'), ('atlas:1820:8', 'chgis:1:10'),
                })
                self.assertEqual(skipped['ambiguous CHGIS identity'], 3)


if __name__ == '__main__':
    unittest.main()

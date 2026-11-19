"""Exercise year-specific replacement identities without the local licensed data."""
import csv
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_period_admin import read_atlas, render


class AtlasIdentityTest(unittest.TestCase):
    def test_generated_index_respects_dates_and_year_specific_replacements(self):
        def row(identifier, start, end, source=1, replaces=None):
            return [identifier, identifier, 110, 32, start, end, 1, source, '', '', replaces]

        rows = [row('early', -500, -64), row('town', 63, 192),
                row('override', 128, 128, 2, 'town'),
                row('late', 1900, 11911), row('republic', 1931, 1931, 4)]
        years = [-404, -403, -65, -64, -63, 0, 62, 63, 64, 127, 128, 129,
                 191, 192, 193, 1911, 1912, 1931, 1932]
        program = ('global.window = {};\n' + render(rows, [], {}) +
                   '\nconsole.log(JSON.stringify(' + json.dumps(years) +
                   '.map(y => window.ATLAS_PERIOD_ADMIN.placesForYear(y).map(p => p.id))));')
        output = subprocess.check_output(['node', '-'], input=program, text=True, encoding='utf-8')
        self.assertEqual(json.loads(output), [
            [], ['early'], ['early'], ['early'], [], [], [], ['town'], ['town'], ['town'],
            ['override'], ['town'], ['town'], ['town'], [], ['late'], [], ['republic'], []])

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

"""Normalize the CHGIS 1911 county and prefecture point archives (DOI 10.7910/DVN/HHVVHX)."""
from argparse import ArgumentParser
from collections import Counter
from csv import DictWriter
from hashlib import md5
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZipFile

from period_admin_geometry import dbf_rows, from_grid, shp_points

DEFAULT_SOURCE_DIR = Path(__file__).resolve().parents[1] / 'data' / 'tiles' / 'period-admin-sources'
ARCHIVES = (
    ('county', 'chgis-v6-1911-county.zip', '4736644a5a3a9df6f56e7ed737aff13b', 2154),
    ('prefecture', 'chgis-v6-1911-prefecture.zip', '209dedcb88b7af80efb03596724e8b7d', 355),
)
FIELDS = ('year', 'id', 'name', 'lon', 'lat', 'parent', 'level', 'historical_type')


def read_member(archive, extension):
    names = [name for name in archive.namelist() if name.lower().endswith(extension)]
    if len(names) != 1:
        raise ValueError(f'{archive.filename}: expected one {extension} file')
    return archive.read(names[0])


def normalize(source_dir):
    rows = []
    seen = set()
    excluded = Counter()
    max_axis_difference = 0.0
    for level, filename, checksum, expected in ARCHIVES:
        path = source_dir / filename
        if md5(path.read_bytes()).hexdigest() != checksum:
            raise ValueError(f'{filename}: source checksum differs from the published archive')
        with ZipFile(path) as archive:
            projection = read_member(archive, '.prj').decode()
            if not all(tag in projection for tag in ('Xian_1980', '19500000.0', 'Central_Meridian",111.0', 'Gauss_Kruger')):
                raise ValueError(f'{filename}: unsupported coordinate reference system')
            attrs = list(dbf_rows(read_member(archive, '.dbf')))
            points = list(shp_points(read_member(archive, '.shp')))
        if len(attrs) != expected or len(points) != expected or len({r['SYS_ID'] for r in attrs}) != expected:
            raise ValueError(f'{filename}: inconsistent feature count or IDs')
        for record, (x, y) in zip(attrs, points, strict=True):
            if float(record['BEG_YR']) != 1911 or float(record['END_YR']) != 1911:
                raise ValueError(f'{filename}: unexpected record year')
            unit_type = record['TYPE_CH']
            if level == 'county' and float(record['LEV_RANK']) != 6:
                excluded[(level, unit_type)] += 1
                continue
            if level == 'prefecture' and unit_type not in {'府', '直隶州', '直隶厅'}:
                excluded[(level, unit_type)] += 1
                continue
            lon, lat = from_grid(x, y)
            if not (40 < lon < 165 and -10 < lat < 70):
                raise ValueError(f"{filename}: unusable position for {record['SYS_ID']}")
            max_axis_difference = max(max_axis_difference, abs(lon - float(record['X_COORD'])),
                                      abs(lat - float(record['Y_COORD'])))
            name = record['NAME_CH']
            parent = record['LEV2_CH'] if level == 'county' else record['LEV1_CH']
            if not name or not parent:
                raise ValueError(f"{filename}: missing name or parent for {record['SYS_ID']}")
            lon, lat = round(lon, 2), round(lat, 2)
            location = (level, name, parent, lon, lat)
            if location in seen:
                excluded[(level, 'same name, parent and point')] += 1
                continue
            seen.add(location)
            rows.append(dict(year=1911, id=f"{level}-{record['SYS_ID']}", name=name, lon=lon,
                             lat=lat, parent=parent, level=level, historical_type=unit_type))

    counts = Counter(row['level'] for row in rows)
    if counts != {'county': 2139, 'prefecture': 351}:
        raise ValueError(f'Unexpected accepted counts: {counts}')
    target = source_dir / 'chgis-1911-wgs84.csv'
    with NamedTemporaryFile('w', encoding='utf-8', newline='', dir=source_dir, delete=False) as stream:
        temporary = Path(stream.name)
        try:
            writer = DictWriter(stream, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows(sorted(rows, key=lambda row: row['id']))
        except BaseException:
            stream.close()
            temporary.unlink(missing_ok=True)
            raise
    try:
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    print('Accepted:', counts)
    print('Excluded:', dict(excluded))
    print('Max unrounded axis difference vs source DBF geographic fields:', max_axis_difference)


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=DEFAULT_SOURCE_DIR)
    normalize(parser.parse_args().source_dir)

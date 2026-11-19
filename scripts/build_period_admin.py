#!/usr/bin/env python3
"""Build the local administrative-seat layer using official point datasets."""
from argparse import ArgumentParser
from collections import Counter
import csv
from hashlib import sha256
import json
from pathlib import Path
from struct import unpack_from
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'data' / 'tiles' / 'period-admin-sources'
OUTPUT = ROOT / 'data' / 'tiles' / 'period-admin.js'
SOURCES = [
    ('CHGIS V6 · 历代府级治所', 'https://doi.org/10.7910/DVN/WW1PD6'),
    ('CHGIS V6 · 历代县级治所', 'https://doi.org/10.7910/DVN/Q9VOF5'),
    ('郑伊辰、武廷海 · 《中国历史地图集》县治数字化', 'https://doi.org/10.6084/m9.figshare.30518417.v2'),
    ('郑伊辰、武廷海 · 清代县治（校核 CHGIS 1820 年层）', 'https://doi.org/10.6084/m9.figshare.30518417.v2'),
    ('Christian Henriot · 民国中国历史地名库（1931 年层）', 'https://doi.org/10.5281/zenodo.5721459'),
    ('CHGIS V6 · 清末 1911 年治所年层', 'https://doi.org/10.7910/DVN/HHVVHX'),
]
CHGIS_CREDIT = ('CHGIS, Version: 6. (c) Fairbank Center for Chinese Studies of Harvard University '
                'and the Center for Historical Geographical Studies at Fudan University, 2016.')

ATLAS_INDEX_DOI = 'https://doi.org/10.7910/DVN/3KAHBT'
ATLAS_GROUPS = {
    '战国':'zhanguo', '秦朝':'qin', '西汉':'xihan', '东汉':'donghan',
    '三国':'sanguo', '西晋':'xijin', '东晋十六国':'dongjin',
    '南北朝':'nanbei', '隋朝':'sui', '唐朝':'tang', '五代十国':'wudai',
    '辽北宋':'beisong', '金南宋':'nansong', '元朝':'yuan', '明朝':'ming', '清朝':'qing',
}


def read_tan_index(path, names):
    from urllib.parse import urljoin
    catalogue = json.loads((ROOT / 'data' / 'historical-map-references.json').read_text(encoding='utf-8'))
    groups = {group['key']: group for group in catalogue['groups']}
    index = {}
    with ZipFile(path) as archive:
        for member in archive.namelist():
            if not member.endswith('.txt'):
                continue
            for row in csv.DictReader(archive.read(member).decode('gb18030').splitlines(), delimiter='\t'):
                name = row['地名'].strip()
                key = ATLAS_GROUPS.get(row['朝代'].strip())
                volume, page = row['册号'].strip(), row['页号'].strip()
                if (name not in names or not key or row['属性'] != '地名' or
                    not volume.isdecimal() or not page.isdecimal() or int(volume) != groups[key]['volume']):
                    continue
                index.setdefault(key, {}).setdefault(name, set()).add(int(page))
    result = {}
    for key, entries in index.items():
        group = groups[key]
        result[key] = [group['volume'], urljoin(catalogue['indexUrl'], group['page']),
                       {name: sorted(pages) for name, pages in sorted(entries.items())}]
    return result


def read_dbf(archive: Path):
    with ZipFile(archive) as source:
        dbfs = [name for name in source.namelist() if name.lower().endswith('.dbf')]
        if len(dbfs) != 1:
            raise ValueError(f'{archive.name}: expected exactly one DBF')
        raw = source.read(dbfs[0])
    row_count, header_length, row_length = unpack_from('<IHH', raw, 4)
    if len(raw) < header_length + row_count * row_length or raw[header_length-1] != 13:
        raise ValueError(f'{archive.name}: invalid DBF header')
    fields = {}
    offset = 1
    for field in range(32, header_length - 1, 32):
        name = raw[field:field+11].split(b'\0', 1)[0].decode('ascii')
        width = raw[field+16]
        fields[name] = slice(offset, offset + width)
        offset += width
    needed = {'SYS_ID', 'NAME_CH', 'PRES_LOC', 'X_COOR', 'Y_COOR', 'BEG_YR', 'END_YR', 'LEV_RANK'}
    if offset != row_length or not needed <= fields.keys():
        raise ValueError(f'{archive.name}: unexpected DBF fields')
    for start in range(header_length, header_length+row_count*row_length, row_length):
        if raw[start] != 42:  # deleted record
            record = raw[start:start+row_length]
            yield {name: record[fields[name]].strip(b' \0').decode('utf-8') for name in needed}


def usable_point(lon, lat):
    return 65 <= lon <= 145 and 10 <= lat <= 60


def read_chgis(path, kind):
    stats = Counter()
    rows = {}
    for item in read_dbf(path):
        name = item['NAME_CH'].strip()
        try:
            begin, end = int(item['BEG_YR']), int(item['END_YR'])
            lon, lat = float(item['X_COOR']), float(item['Y_COOR'])
            identifier = int(item['SYS_ID'])
        except ValueError:
            stats['missing fields'] += 1
            continue
        # The official point-series coverage ends in 1911. Retain earlier
        # entries only where the source itself provides a dated interval.
        if (not name or begin > end or end < -403 or begin > 1911 or
                not usable_point(lon, lat)):
            stats['outside scope or invalid'] += 1
            continue
        row = [f'chgis:{kind}:{identifier}', name, round(lon, 4), round(lat, 4),
               begin, end, kind, kind, '', item['PRES_LOC'], '']
        if row[0] in rows:
            if rows[row[0]] != row:
                raise ValueError(f'{path.name}: conflicting source id {identifier}')
            stats['identical duplicate'] += 1
        rows[row[0]] = row
    return list(rows.values()), stats


def read_atlas(path):
    """Publish a correction only if its CHGIS record has one candidate that year."""
    candidates = []
    stats = Counter()
    with path.open(encoding='utf-8-sig', newline='') as stream:
        for number, item in enumerate(csv.DictReader(stream), 1):
            year = int(item['year'])
            lon, lat = float(item['lon']), float(item['lat'])
            name = item['name'].strip()
            if year not in (2, 742, 1102, 1820):
                raise ValueError(f'{path.name} row {number}: unexpected benchmark year')
            target_id = item['chgis_id'].strip()
            if not target_id.isdecimal():
                raise ValueError(f'{path.name} row {number}: invalid CHGIS identity')
            if not name or not usable_point(lon, lat):
                stats['outside scope or invalid'] += 1
                continue
            candidates.append([f'atlas:{year}:{item.get("id") or number}', name, round(lon, 4), round(lat, 4),
                               year, year, 1, 3 if year == 1820 else 2, item.get('parent', '').strip(), '',
                               f'chgis:1:{int(target_id)}'])
    counts = Counter((row[4], row[10]) for row in candidates)
    rows = [row for row in candidates if counts[(row[4], row[10])] == 1]
    stats['ambiguous CHGIS identity'] = len(candidates) - len(rows)
    return rows, stats


def read_slice(path, expected_year, source):
    rows = []
    stats = Counter()
    with path.open(encoding='utf-8-sig', newline='') as stream:
        for number, item in enumerate(csv.DictReader(stream), 1):
            year = int(item['year'])
            if year != expected_year:
                raise ValueError(f'{path.name} row {number}: unexpected year')
            rank = {'县': 1, 'county': 1, 'prefecture': 0}.get(item['level'])
            name = item['name'].strip()
            lon, lat = float(item['lon']), float(item['lat'])
            if rank is None or not name or not usable_point(lon, lat):
                stats['outside scope or invalid'] += 1
                continue
            replaced = f'chgis:{rank}:{item["chgis_id"]}' if item.get('chgis_id') else ''
            rows.append([f'slice:{year}:{rank}:{item["id"]}', name, round(lon, 4), round(lat, 4),
                         year, year, rank, source, item.get('parent', '').strip(), '', replaced])
    return rows, stats


def link_1911_records(rows):
    """Avoid double marks only for a unique nearby, contemporaneous CHGIS match."""
    from math import cos, hypot, radians
    by_name = {}
    slices = []
    for row in rows:
        if row[7] == 5:
            slices.append(row)
        elif row[7] < 2 and row[4] <= 1911 <= row[5]:
            by_name.setdefault((row[6], row[1]), []).append(row)
    candidates = []
    for row in slices:
        lon, lat = row[2:4]
        matches = [record for record in by_name.get((row[6], row[1]), ())
                   if hypot((lon-record[2])*cos(radians((lat+record[3])/2)), lat-record[3])*111.32 <= 10]
        if len(matches) == 1:
            candidates.append((row, matches[0][0]))
    counts = Counter(identifier for _, identifier in candidates)
    for row, identifier in candidates:
        if counts[identifier] == 1:
            row[10] = identifier


def render(rows, inputs, atlas_index):
    rows.sort(key=lambda row: (row[4], row[6], row[1], row[0]))
    if len({row[0] for row in rows}) != len(rows):
        raise ValueError('Duplicate source record id')
    encoded = json.dumps(rows, ensure_ascii=False, separators=(',', ':'))
    links = json.dumps(SOURCES, ensure_ascii=False, separators=(',', ':'))
    entries = json.dumps(inputs, ensure_ascii=False, separators=(',', ':'))
    index = json.dumps(atlas_index, ensure_ascii=False, separators=(',', ':'))
    return """/* Generated by scripts/build_period_admin.py. Local-use source data. */
(() => {
  'use strict';
  const rows = %%ROWS%%;
  const sources = %%SOURCES%%;
  const inputFiles = %%INPUTS%%;
  const atlasIndex = %%ATLAS_INDEX%%;
  const atlasDoi = 'https://doi.org/10.7910/DVN/3KAHBT';
  const cache = new Map();
  const yearText = year => year < 0 ? '公元前' + -year + '年' : year + '年';

  function placesForYear(year) {
    if (!Number.isInteger(year) || !year || year < -403) return [];
    if (cache.has(year)) return cache.get(year);
    const found = new Map();
    const superseded = new Set();
    for (const row of rows) {
      if (row[4] > year) break;
      if (row[4] === year && row[10]) superseded.add(row[10]);
    }
    for (const row of rows) {
      const [id, ancient, lon, lat, from, through, rank, source, parent, modern] = row;
      if (from > year) break;
      if (through < year || (source < 2 && year > 1911) || superseded.has(id)) continue;
      const level = rank === 1 ? 'county' : 'prefecture';
      const key = [level, ancient, lon, lat].join('|');
      const first = found.get(key);
      if (first && first.source > source) continue;
      const dates = from === through ? yearText(from) : yearText(from) + '至' + yearText(through);
      const precision = (source < 2 ? '中国历史地理信息系统时间序列' :
        ['《中国历史地图集》数字化年层','校核后的清代县治年层','民国历史地名库','中国历史地理信息系统清末年层'][source-2])
        + '治所点，记录年份 ' + dates + '。坐标用于约略定位。'
        + (modern ? '今址参考：' + modern + '。' : '')
        + (parent ? '' : '点位数据未附行政隶属。');
      found.set(key, {id, ancient, coord:[lon,lat], level, from, through,
        tier:2, parent, modern, precision, source, sources:[sources[source]]});
    }
    const result = [...found.values()];
    const dynasty = window.DYNASTY_DATA?.findLast(d => year >= d.fromYear && year <= d.toYear)?.key;
    const atlas = atlasIndex[dynasty];
    if (atlas) {
      const [volume, directory, entries] = atlas;
      const counts = new Map();
      for (const item of result) counts.set(item.ancient, (counts.get(item.ancient) || 0) + 1);
      for (const item of result) {
        const pages = Object.hasOwn(entries, item.ancient) ? entries[item.ancient] : [];
        if (!pages.length || counts.get(item.ancient) !== 1) continue;
        const shown = pages.slice(0, 6).join('、') + (pages.length > 6 ? '等' : '');
        item.sources.push(['《中国历史地图集》同名索引 · 第' + volume + '册第' + shown + '页', atlasDoi],
          ['国学导航 · 本时期图幅目录', directory]);
      }
    }
    cache.set(year,result);
    if (cache.size > 5) cache.delete(cache.keys().next().value);
    return result;
  }

  window.ATLAS_PERIOD_ADMIN = { placesForYear, inputFiles };
})();
""".replace('%%ROWS%%', encoded).replace('%%SOURCES%%', links).replace('%%INPUTS%%', entries).replace('%%ATLAS_INDEX%%', index)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='compare generated output without writing')
    args = parser.parse_args()
    rows, inputs = [], []
    for path, reader in [
        (INPUT / 'chgis-v6-prefecture-wgs84.zip', lambda p: read_chgis(p, 0)),
        (INPUT / 'chgis-v6-county-wgs84.zip', lambda p: read_chgis(p, 1)),
        (INPUT / 'figshare-county-wgs84.csv', read_atlas),
        (INPUT / 'mcgd-republic-county-wgs84.csv', lambda p: read_slice(p, 1931, 4)),
        (INPUT / 'chgis-1911-wgs84.csv', lambda p: read_slice(p, 1911, 5)),
    ]:
        if not path.is_file():
            continue
        loaded, skipped = reader(path)
        inputs.append({'file': path.name, 'sha256': sha256(path.read_bytes()).hexdigest(),
                       'rows': len(loaded), 'skipped': dict(skipped)})
        rows.extend(loaded)
    if not rows:
        parser.error(f'No local point data found under {INPUT}')
    index_path = INPUT / 'tan-atlas-toponym-index-gbk.zip'
    atlas_index = read_tan_index(index_path, {row[1] for row in rows}) if index_path.is_file() else {}
    if index_path.is_file():
        inputs.append({'file': index_path.name, 'sha256': sha256(index_path.read_bytes()).hexdigest(),
                       'index names': sum(len(group[2]) for group in atlas_index.values())})
    link_1911_records(rows)
    result = render(rows, inputs, atlas_index)
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding='utf-8') != result:
            parser.error('Local administrative data is stale; rebuild without --check')
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        temporary = OUTPUT.with_suffix('.js.tmp')
        temporary.write_text(result, encoding='utf-8', newline='\n')
        temporary.replace(OUTPUT)
    print(CHGIS_CREDIT)
    print(json.dumps(inputs, ensure_ascii=True))
    print(f'{len(rows)} dated administrative records; {OUTPUT.stat().st_size} bytes')


if __name__ == '__main__':
    main()

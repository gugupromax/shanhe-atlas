# Local, reproducible normalization of Figshare DOI 30518417.v2, point layer only.
from argparse import ArgumentParser
from collections import Counter, defaultdict
from csv import DictWriter, DictReader
from pathlib import Path
from zipfile import ZipFile
import io
import json
import math
import unicodedata

from period_admin_geometry import dbf_rows, from_grid, shp_points

DEFAULT_SOURCE_DIR = Path(__file__).resolve().parents[1] / 'data' / 'tiles' / 'period-admin-sources'
counts = Counter({2: 1294, 742: 1560, 1102: 1287, 1820: 1948})

def romanize_key(name):
    text=unicodedata.normalize('NFKD',name.casefold())
    # Blank and punctuation insignificant; no edits to spelling or place type.
    return ''.join(letter for letter in text if 'a'<=letter<='z')

def lookup(root, layer):
    path=root/f'chgis-v6-{layer}-wgs84.zip'
    with ZipFile(path) as archive:
        content=archive.read(next(name for name in archive.namelist() if name.endswith('.dbf')))
        geometry=archive.read(next(name for name in archive.namelist() if name.endswith('.shp')))
    result=defaultdict(list)
    for row,(lon,lat) in zip(dbf_rows(content),shp_points(geometry),strict=True):
        if not all(row[x] for x in ('NAME_CH','BEG_YR','END_YR','SYS_ID')):
            continue
        if not(60<lon<150 and 5<lat<60):
            continue
        result[romanize_key(row['NAME_PY'])].append((
            int(row['BEG_YR']),int(row['END_YR']),row['NAME_CH'],lon,lat,row['SYS_ID'],
        ))
    return result

def distance(x,y,x2,y2):
    # Locally sufficient for the deliberately small co-location cutoff.
    return 111.2 * math.hypot((x2-x)*math.cos(math.radians((y+y2)/2)),y2-y)

def match(registry, romanized, year, lon, lat):
    candidates=[]
    for begin,end,name,x,y,ident in registry.get(romanize_key(romanized),[]):
        if begin <= year <= end:
            separation=distance(lon,lat,x,y)
            if separation <= 25:
                candidates.append((separation,name,ident))
    # Homophones mapped to more than one Chinese name are not accepted.
    return min(candidates) if len({row[1] for row in candidates})==1 else None

def atlas_lookup(root):
    result=defaultdict(set)
    with ZipFile(root/'tan-atlas-toponym-index-gbk.zip') as archive:
        for name in archive.namelist():
            rows=DictReader(io.StringIO(archive.read(name).decode('gb18030',errors='replace')),delimiter='\t')
            for row in rows:
                if row['属性']!='地名':
                    continue
                vol=(row['册号'] or '').strip()
                page=(row['页号'] or '').strip()
                if vol.isdecimal() and page.isdecimal():
                    result[(int(vol),row['地名'].strip())].add(int(page))
    return result

def normalize(root):
    source = root / 'figshare-county-points-v2' / 'CountyPointsWithPopulation'
    assert all(marker in source.with_suffix('.prj').read_text() for marker in
        ['Xian_1980','19500000.0','Central_Meridian",111.0','Gauss_Kruger'])
    counties,prefectures=lookup(root, 'county'),lookup(root, 'prefecture')
    atlas=atlas_lookup(root)
    raw=defaultdict(list)
    confirmed=[]
    total=Counter()
    missed=Counter()
    parents=Counter()
    indexed=Counter()
    max_residual=0
    for record,(x,y) in zip(dbf_rows(source.with_suffix('.dbf').read_bytes()),
                            shp_points(source.with_suffix('.shp').read_bytes()),strict=True):
        year=int(record['YEAR'].removesuffix('AD'))
        ident=int(record['CountyID'])
        total[year]+=1
        lon,lat=from_grid(x,y)
        assert 60 < lon < 150 and 5 < lat < 60, (lon,lat)
        rounded=(round(lon,2),round(lat,2))
        raw[year].append([ident, record['ProvNAM'],record['PrefNAM'],record['CountyNAM'],record['TYPE'],*rounded])
        county=match(counties,record['CountyNAM'],year,lon,lat)
        if county is None:
            missed[year]+=1
            continue
        residual,name,matched_id=county
        max_residual=max(max_residual,residual)
        parent=''
        # A named prefecture is only confirmed at a co-located prefectural seat,
        # where both independent point datasets refer to the same locality.
        if record['TYPE'] in ('Prefecture Seat','Capital Seat'):
            m=match(prefectures,record['PrefNAM'],year,lon,lat)
            if m is not None and m[1]!=name:
                parent=m[1]
                parents[year]+=1
        v={2:2,742:5,1102:6,1820:8}[year]
        pages=';'.join(map(str,sorted(atlas.get((v,name),set()))))
        if pages:
            indexed[year]+=1
        confirmed.append(dict(year=year,id=ident,name=name,lon=rounded[0],lat=rounded[1],
                              parent=parent,atlas_volume=v if pages else '',atlas_pages=pages,
                              chgis_id=matched_id,distance_km=round(residual,2)))
    assert total==counts
    assert len({(row['year'],row['id']) for row in confirmed})==len(confirmed)
    with (root/'figshare-county-wgs84.csv').open('w',encoding='utf-8',newline='') as handle:
        writer=DictWriter(handle,fieldnames=tuple(confirmed[0]))
        writer.writeheader()
        writer.writerows(sorted(confirmed,key=lambda row:(row['year'],row['id'])))
    (root/'figshare-county-points-geo.json').write_text(json.dumps(raw,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print('total',dict(total))
    print('confirmed',dict(total-missed))
    print('unmatched',dict(missed))
    print('confirmed co-located prefecture parents',dict(parents))
    print('exact-name atlas index page matches (volume, not exact map sheet)',dict(indexed))
    print('largest CHGIS-vs-Figshare distance of accepted matches',round(max_residual,2),'km')
    print('Zunyi 742 projection check:',next(x for x in raw[742] if x[3]=='Zunyi Xian'))


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=DEFAULT_SOURCE_DIR)
    normalize(parser.parse_args().source_dir)

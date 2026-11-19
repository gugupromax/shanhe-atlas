# Normalize the explicit 1931 county-level rows in MCGD_Rep_V2.csv.
from collections import Counter
from csv import DictReader, DictWriter
from ctypes import POINTER, c_int, c_void_p, c_wchar, create_unicode_buffer, windll
from ctypes.wintypes import DWORD, LPARAM, LPCWSTR
from hashlib import md5
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'data' / 'tiles' / 'period-admin-sources'
source = root / 'MCGD_Rep_V2.csv'
assert md5(source.read_bytes()).hexdigest() == '77b3f7d962c563575f05e73b66432a49'

# Windows NLS simplified Chinese mapping for atlas display. Keep both source
# labels verbatim in the two original_* columns for reproducibility.
map_string = windll.kernel32.LCMapStringEx
map_string.argtypes = [LPCWSTR,DWORD,LPCWSTR,c_int,POINTER(c_wchar),c_int,c_void_p,c_void_p,LPARAM]
map_string.restype = c_int
def simplified(value):
    value=value.strip()
    if not value:
        return ''
    flags=0x02000000
    size=map_string('zh-CN',flags,value,len(value),None,0,None,None,0)
    assert size>0
    buffer=create_unicode_buffer(size+1)
    written=map_string('zh-CN',flags,value,len(value),buffer,size,None,None,0)
    assert written==size
    return buffer[:written]

with source.open(encoding='utf-8-sig',newline='') as handle:
    rows=list(DictReader(handle))
assert len(rows)==1977
assert {row['Year'] for row in rows}=={'1931'}
accepted=[]
for row in rows:
    if row['Level']!='縣':
        continue
    lon,lat=float(row['LONG']),float(row['LAT'])
    assert 60<lon<150 and 5<lat<60
    assert row['NameID'] and row['Name_Full'] and row['Province_ZhT']
    accepted.append({
        'year':1931,'id':row['NameID'],'name':simplified(row['Name_Full']),
        'lon':round(lon,2),'lat':round(lat,2),'parent':simplified(row['Province_ZhT']),
        'level':'县','original_name':row['Name_Full'],'original_parent':row['Province_ZhT'],
    })
assert len(accepted)==1956
assert len({r['id'] for r in accepted})==len(accepted)
with (root/'mcgd-republic-county-wgs84.csv').open('w',encoding='utf-8',newline='') as handle:
    writer=DictWriter(handle,fieldnames=tuple(accepted[0]))
    writer.writeheader()
    writer.writerows(sorted(accepted,key=lambda record: record['id']))
print('raw',len(rows),'levels',Counter(row['Level'] for row in rows),'accepted',len(accepted))
print('year(s)',{row['year'] for row in accepted},'province values',len({row['parent'] for row in accepted}))
print(next(row for row in accepted if row['name']=='三原县'))

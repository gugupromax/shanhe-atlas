"""DBF and point SHP readers, and inverse projection for Xian 1980 zone 19."""
import math
import struct


def dbf_rows(data):
    n, head, size = struct.unpack_from('<IHH', data, 4)
    fields, start = [], 1
    for cursor in range(32, head - 1, 32):
        f = data[cursor:cursor + 32]
        key = f[:11].split(b'\0')[0].decode('ascii')
        width = f[16]
        fields.append((key, start, start + width))
        start += width
    assert start == size
    for idx in range(n):
        row = data[head + idx * size:head + (idx + 1) * size]
        assert len(row) == size and row[0] == 32
        yield {key: row[begin:end].decode('utf-8').strip() for key, begin, end in fields}

def shp_points(data):
    assert struct.unpack_from('>I', data, 0)[0] == 9994
    assert struct.unpack_from('<I', data, 32)[0] == 1
    assert len(data) == struct.unpack_from('>I',data,24)[0]*2
    cursor, ident = 100, 1
    while cursor < len(data):
        number, length = struct.unpack_from('>II', data, cursor)
        assert number == ident and length == 10
        shape, x, y = struct.unpack_from('<Idd', data, cursor + 8)
        assert shape == 1
        yield x,y
        ident += 1
        cursor += 8 + length * 2

# Krüger inverse series through the sixth order (PROJ / Karney).
# The PRJ is Xian_1980_GK_Zone_19 on the Xian 1980 ellipsoid with longitude
# origin 111°, easting offset 19,500,000 m, and central scale 1.
# Coordinates are reported to 0.01° as approximate lon/lat; no local datum
# grid shift is assumed or claimed.
a, f = 6378140.0, 1/298.257
n = f / (2 - f)
ecc = math.sqrt(f * (2 - f))
radius = a/(1+n)*(1+n*n/4+n**4/64+n**6/256)
beta = (
    n/2-2*n*n/3+37*n**3/96-n**4/360-81*n**5/512+96199*n**6/604800,
    n*n/48+n**3/15-437*n**4/1440+46*n**5/105-1118711*n**6/3870720,
    17*n**3/480-37*n**4/840-209*n**5/4480+5569*n**6/90720,
    4397*n**4/161280-11*n**5/504-830251*n**6/7257600,
    4583*n**5/161280-108847*n**6/3991680,
    20648693*n**6/638668800,
)
def from_grid(x,y):
    xi, eta = y/radius, (x-19500000)/radius
    u = xi - sum(v * math.sin(2*j*xi) * math.cosh(2*j*eta) for j,v in enumerate(beta,1))
    v = eta - sum(v * math.cos(2*j*xi) * math.sinh(2*j*eta) for j,v in enumerate(beta,1))
    sigma = math.sinh(v)
    expected = math.sin(u)/math.hypot(sigma,math.cos(u))
    left,right=-1.57,1.57
    for _ in range(40):
        middle=(left+right)/2
        actual=math.sinh(math.asinh(math.tan(middle))-ecc*math.atanh(ecc*math.sin(middle)))
        if actual < expected:
            left=middle
        else:
            right=middle
    return 111 + math.degrees(math.atan2(sigma,math.cos(u))),math.degrees((left+right)/2)

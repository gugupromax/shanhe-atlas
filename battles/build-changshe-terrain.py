from pathlib import Path
import base64, io, json, math, struct
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen
from PIL import Image

def main():
    west,south,east,north=111.6,32.45,115,34.65
    width,height=241,181
    zoom=9
    limit=(1<<zoom)*256
    def pixel(lon,lat):
        return int((lon+180)/360*limit),int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*limit)
    points=[pixel(west+(east-west)*x/(width-1),north-(north-south)*y/(height-1))
            for y in range(height) for x in range(width)]
    tiles=sorted({(x//256,y//256) for x,y in points})
    template='https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{}/{}/{}.png'
    def load(coords):
        with urlopen(template.format(zoom,*coords),timeout=18) as data:
            return coords,Image.open(io.BytesIO(data.read())).convert('RGB')
    with ThreadPoolExecutor(max_workers=8) as pool:
        images=dict(pool.map(load,tiles))
    values=[]
    for x,y in points:
        r,g,b=images[x//256,y//256].getpixel((x%256,y%256))
        values.append(round(r*256+g+b/256-32768))
    grid={'bounds':[west,south,east,north],'width':width,'height':height,'tileZoom':zoom,
          'source':template, 'tiles':tiles,'data':base64.b64encode(struct.pack('<'+'h'*len(values),*values)).decode('ascii')}
    Path(__file__).with_name('changshe-terrain-data.js').write_text('window.changsheTerrainGrid='+json.dumps(grid,separators=(',',':'))+';\n',encoding='utf-8')
    print('Sampled',len(values),'values across',len(tiles),'DEM tiles',min(values),max(values))

if __name__=='__main__':
    main()

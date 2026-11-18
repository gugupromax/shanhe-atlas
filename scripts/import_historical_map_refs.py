"""Read Guoxue Navigation's atlas index and print map metadata as UTF-8 JSON."""

from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
import re
import sys
from urllib.parse import urljoin
from urllib.request import urlopen


INDEX_URL = "http://www.guoxue123.com/other/map/zgmap/"
GROUPS = (
    ("000", "early", 1, "史前、夏、商、西周"),
    ("001", "zhanguo", 1, "春秋、战国"),
    ("002", "qin", 2, "秦"),
    ("003", "xihan", 2, "西汉"),
    ("004", "donghan", 2, "东汉"),
    ("005", "sanguo", 3, "三国"),
    ("006", "xijin", 3, "西晋"),
    ("007", "dongjin", 4, "东晋十六国"),
    ("008", "nanbei", 4, "南北朝"),
    ("091", "sui", 5, "隋"),
    ("009", "tang", 5, "唐"),
    ("010", "wudai", 5, "五代十国"),
    ("011", "beisong", 6, "辽、北宋"),
    ("012", "nansong", 6, "金、南宋"),
    ("013", "yuan", 7, "元"),
    ("014", "ming", 7, "明"),
    ("015", "qing", 8, "清"),
)
IMAGE_PATH = re.compile(r"\.\./pic/[\w-]+/[\w.-]+\.(?:jpg|jpeg|png|gif)", re.I | re.ASCII)
TITLE_OVERRIDES = {"../pic/02/15.jpg": "战国形势图"}

# Full-map dates from the reference pages' editorial notes. For Ming, use the
# PKU map record (ID 414) for the Xuande date because Guoxue misprints it.
COMPARISON_YEARS = {
    "zhanguo": [-350],
    "donghan": [140],
    "sanguo": [262],
    "xijin": [281],
    "sui": [612],
    "tang": [669, 741, 820],
    "beisong": [1111],
    "nansong": [1142, 1208],
    "yuan": [1280, 1330],
    "ming": [1433, 1582],
    "qing": [1820, 1908],
}


class MapLinks(HTMLParser):
    """The title is the last text line before each [图] anchor."""

    def __init__(self):
        super().__init__()
        self.maps = []
        self.line = []
        self.last_line = ""
        self.in_map_link = False

    def finish_line(self):
        label = " ".join("".join(self.line).split())
        if label:
            self.last_line = label
        self.line.clear()

    def handle_starttag(self, tag, attrs):
        if tag in {"br", "p", "td", "tr", "div"}:
            self.finish_line()
        if tag != "a":
            return
        target = dict(attrs).get("href") or ""
        if IMAGE_PATH.fullmatch(target):
            self.finish_line()
            if not self.last_line or len(self.last_line) > 100:
                raise ValueError(f"No short map title for {target}")
            self.maps.append({"title": TITLE_OVERRIDES.get(target, self.last_line), "path": target})
            self.last_line = ""
            self.in_map_link = True

    def handle_endtag(self, tag):
        if tag == "a":
            self.in_map_link = False
        if tag in {"p", "td", "tr", "div"}:
            self.finish_line()

    def handle_data(self, data):
        if not self.in_map_link:
            self.line.append(data)


def read_group(group):
    number, key, volume, label = group
    page = f"{number}.htm"
    url = urljoin(INDEX_URL, page)
    with urlopen(url, timeout=20) as response:
        if response.geturl() != url:
            raise ValueError(f"Unexpected redirect for {url}")
        html = response.read(1_000_001)
    if len(html) > 1_000_000:
        raise ValueError(f"Unexpectedly large atlas index page: {url}")
    parser = MapLinks()
    parser.feed(html.decode("gb18030"))
    parser.close()
    if not parser.maps:
        raise ValueError(f"No map references on {url}")
    return {
        "key": key,
        "volume": volume,
        "label": label,
        "page": page,
        "comparisonYears": COMPARISON_YEARS.get(key, []),
        "maps": parser.maps,
    }


def main():
    with ThreadPoolExecutor(max_workers=3) as pool:
        groups = list(pool.map(read_group, GROUPS))
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps({"indexUrl": INDEX_URL, "groups": groups}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

'use strict';

const groupSelect = document.getElementById('map-group');
const search = document.getElementById('map-query');
const resultCount = document.getElementById('result-count');
const catalog = document.getElementById('map-catalog');

function link(label, href, external = false) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.textContent = label;
  if (external) {
    anchor.target = '_blank';
    anchor.rel = 'noopener';
  }
  return anchor;
}

function yearLabel(year) {
  return year < 0 ? `前${-year}年` : `${year}年`;
}

function renderGroup(group, maps, indexUrl) {
  const section = document.createElement('section');
  section.id = group.key;
  const header = document.createElement('div');
  header.className = 'group-heading';
  const title = document.createElement('h2');
  title.textContent = `第${group.volume}册 · ${group.label}`;
  const sourcePage = new URL(group.page, indexUrl);
  header.append(title, link('原站图目及编例', sourcePage, true));
  section.append(header);

  if (group.comparisonYears.length) {
    const comparison = document.createElement('p');
    comparison.className = 'compare-years';
    comparison.append('到山河图集对照');
    for (const year of group.comparisonYears) {
      comparison.append(link(yearLabel(year), `./?year=${year}`));
    }
    section.append(comparison);
  }
  if (group.key === 'ming') {
    const note = document.createElement('p');
    note.className = 'notice';
    note.append('原站编例把宣德八年误写为 1443 年，此处按 1433 年对照。');
    note.append(link('北京大学图幅记录', 'https://geodata.pku.edu.cn/index.php?a=show&c=content&id=414', true));
    section.append(note);
  }

  const list = document.createElement('ol');
  for (const map of maps) {
    const row = document.createElement('li');
    row.className = 'map-entry';
    const mapTitle = document.createElement('span');
    mapTitle.textContent = map.title;
    const original = link('查看原图', new URL(map.path, sourcePage), true);
    original.setAttribute('aria-label', `查看${map.title}的原图`);
    row.append(mapTitle, original);
    list.append(row);
  }
  section.append(list);
  return section;
}

const normalizeQuery = (value) => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();

async function loadCatalog() {
  const response = await fetch('data/historical-map-references.json');
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const { groups, indexUrl } = await response.json();
  for (const group of groups) {
    groupSelect.add(new Option(`第${group.volume}册 · ${group.label}`, group.key));
  }

  function refresh() {
    const query = normalizeQuery(search.value);
    const selected = groupSelect.value;
    let total = 0;
    const sections = [];
    for (const group of groups) {
      if (selected && group.key !== selected) continue;
      const maps = query
        ? group.maps.filter((map) => normalizeQuery(map.title).includes(query))
        : group.maps;
      if (!maps.length) continue;
      total += maps.length;
      sections.push(renderGroup(group, maps, indexUrl));
    }
    resultCount.textContent = total
      ? `${sections.length} 个图组 · ${total} 条图件`
      : '没有匹配的图件。可切换图组，或换一个图名。';
    catalog.replaceChildren(...sections);
  }

  function applyHash() {
    const key = location.hash.slice(1);
    groupSelect.value = groups.some((group) => group.key === key) ? key : '';
    refresh();
  }

  groupSelect.addEventListener('change', () => {
    history.replaceState(null, '', groupSelect.value ? `#${groupSelect.value}` : location.pathname);
    refresh();
  });
  search.addEventListener('input', refresh);
  window.addEventListener('hashchange', applyHash);
  groupSelect.disabled = false;
  search.disabled = false;
  applyHash();
}

loadCatalog().catch(() => {
  resultCount.textContent = '图目载入失败。请通过山河图集的本地服务打开此页，或查阅国学导航总目录。';
});

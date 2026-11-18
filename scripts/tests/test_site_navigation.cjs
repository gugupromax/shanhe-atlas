'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { deploymentUrl, materializeHtml, materializeSitemap } = require('../stage_site_metadata.cjs');

const root = path.resolve(__dirname, '../..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const localLinks = (html) => [...html.matchAll(/<a\b[^>]*\bhref="(\.\.?\/[^"]*)"/gi)]
  .map((match) => match[1].replaceAll('&amp;', '&'));

test('topic navigation returns to the same project at the root and under a repository prefix', () => {
  for (const address of ['https://atlas.example/', 'https://atlas.example/maps/shanhe']) {
    const base = deploymentUrl(address);
    const generatedTopics = fs.readdirSync(path.join(root, 'topics')).filter((name) => name.endsWith('.html'));
    for (const name of generatedTopics) {
      const html = read('topics/' + name);
      const topicUrl = new URL('topics/' + name, base);
      assert.ok(localLinks(html).length > 20, name);
      assert.doesNotMatch(html, /deanchen\.me/);
      for (const link of localLinks(html)) {
        const parsed = new URL(link, topicUrl);
        assert.ok(parsed.href.startsWith(base.href), link);
        const relative = decodeURIComponent(parsed.pathname.slice(base.pathname.length));
        assert.ok(fs.existsSync(path.join(root, relative || 'index.html')), link);
      }
      const staged = materializeHtml(html, topicUrl);
      assert.ok(staged.includes('rel="canonical" href="' + topicUrl.href + '"'), name);
      assert.ok(staged.includes('href="../">进入交互式主地图') || name === 'index.html');
      assert.ok(staged.includes('content="' + new URL('assets/terrain_relief.webp', base).href + '"'));
    }
  }
});

test('publishing metadata uses the supplied origin and path without changing interactive links', () => {
  const local = read('index.html');
  const base = deploymentUrl('https://atlas.example/maps/shanhe');
  const staged = materializeHtml(local, new URL('index.html', base));
  assert.ok(staged.includes('id="lnk-canonical" href="' + base.href + '"'));
  assert.ok(staged.includes('"target": "' + base.href + '?q={search_term_string}"'));
  assert.deepEqual(localLinks(staged), localLinks(local));
  const sitemap = materializeSitemap(read('sitemap.xml'), base);
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(locations.includes(base.href));
  assert.ok(locations.includes(new URL('topics/tang.html', base).href));
  assert.equal(new Set(locations).size, locations.length);
  assert.ok(locations.every((loc) => loc.startsWith(base.href)));
  assert.equal(materializeSitemap(sitemap, base), sitemap);
  assert.throws(() => materializeSitemap('<loc>./../other</loc>', base));
  assert.throws(() => deploymentUrl('file:///home/atlas'));
  assert.ok(local.includes('href="map-sources.html"'));
  assert.match(read('map-sources.html'), /CHGIS/);
});

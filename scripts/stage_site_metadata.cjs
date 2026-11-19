'use strict';

const fs = require('node:fs');
const path = require('node:path');

function deploymentUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username ||
      url.password || url.search || url.hash) {
    throw new Error('Use an HTTP(S) Pages base URL with no credentials, query or hash');
  }
  url.pathname = url.pathname.replace(/\/+$/, '') + '/';
  return url;
}

function materializeHtml(html, documentUrl) {
  return html.replace(/<head>[\s\S]*?<\/head>/i, (head) => {
    const resolve = (value) => new URL(value, documentUrl).href;
    const localHref = /(<link rel="(?:canonical|alternate)"[^>]*\bhref=")(\.\.?\/[^"]*)(")/g;
    const localMeta = /(<meta (?:property="og:(?:url|image)"|name="twitter:image")[^>]*\bcontent=")(\.\.?\/[^"]*)(")/g;
    const localMobile = /(<meta name="mobile-agent" content="format=html5;url=)(\.\.?\/[^"]*)(")/g;
    return [localHref, localMeta, localMobile].reduce(
      (text, pattern) => text.replace(pattern, (_, prefix, value, suffix) => prefix + resolve(value) + suffix),
      head,
    ).replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g,
      (_, begin, json, end) => begin + json.replace(/("\s*:\s*")(\.\.?\/[^"]*)(")/g,
        (_, prefix, value, suffix) => prefix + resolve(value)
          .replace(/%7B/g, '{').replace(/%7D/g, '}') + suffix) + end);
  });
}

function materializeSitemap(xml, siteUrl) {
  return xml.replace(/<loc>([^<]+)<\/loc>/g, (_, entry) => {
    if (entry.startsWith(siteUrl.href)) return '<loc>' + entry + '</loc>';
    if (!entry.startsWith('./')) throw new Error('Unexpected sitemap path: ' + entry);
    const url = new URL(entry, siteUrl);
    if (!url.href.startsWith(siteUrl.href)) throw new Error('Sitemap path escapes the site: ' + entry);
    return '<loc>' + url.href + '</loc>';
  });
}

function stageMetadata(stageDir, siteAddress) {
  const stage = fs.realpathSync(stageDir);
  const project = fs.realpathSync(path.resolve(__dirname, '..'));
  if (stage.toLowerCase() === project.toLowerCase()) {
    throw new Error('Specify a staging copy of the runtime files');
  }
  const siteUrl = deploymentUrl(siteAddress);
  const read = (name) => fs.readFileSync(path.join(stage, name), 'utf8');
  const write = (name, content) => fs.writeFileSync(path.join(stage, name), content, 'utf8');
  const files = ['index.html', 'map-sources.html',
    ...fs.readdirSync(path.join(stage, 'topics')).filter((name) => name.endsWith('.html'))
      .map((name) => 'topics/' + name)];
  const sitemap = materializeSitemap(read('sitemap.xml'), siteUrl);
  for (const file of files) {
    let html = materializeHtml(read(file), new URL(file, siteUrl));
    if (file === 'index.html') {
      const optionalFiles = [
        ['period-admin', 'data/tiles/period-admin.js'],
        ['tang-tiles', 'assets/tang-741-tiles/manifest.json'],
      ];
      html = html.replace(/<script\b[^>]*\bid="atlas-app-script"[^>]*>/, tag => {
        for (const [name, relative] of optionalFiles) {
          const flag = ` data-${name}="absent"`;
          tag = tag.replace(flag, '');
          if (!fs.existsSync(path.join(stage, relative))) tag = tag.replace(/>$/, flag + '>');
        }
        return tag;
      });
    }
    write(file, html);
  }
  write('sitemap.xml', sitemap);
  write('robots.txt', read('robots.txt').replace(/^[ \t]*Sitemap:.*(?:\r?\n|$)/gim, '').trimEnd()
    + '\n\nSitemap: ' + new URL('sitemap.xml', siteUrl).href + '\n');
}

if (require.main === module) {
  if (process.argv.length !== 4) throw new Error('Usage: node scripts/stage_site_metadata.cjs <site copy> <site URL>');
  stageMetadata(process.argv[2], process.argv[3]);
}

module.exports = { deploymentUrl, materializeHtml, materializeSitemap, stageMetadata };

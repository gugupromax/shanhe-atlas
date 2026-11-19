'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
// Revision of the upstream polity and chronology sources used in this export.
const metadata = {
  source: 'https://github.com/DeanChensj/jiangshan-map',
  commit: '1a73bee6c94e1eae93ceee44dcc1ac60cebc429b',
  license: 'GPL-3.0',
  layers: ['polity'],
  excludedLayers: ['prefecture', 'region', 'modern-province'],
  historicalBorders: 'schematic, not survey boundaries',
  from: -403,
  to: 1948,
  importedAt: '2026-11-19T02:07:52Z',
};

function buildHistory() {
  const context = vm.createContext({window: {}});
  for (const file of ['js/map_data.js', 'js/atlas_snapshots.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
  }
  const {DYNASTY_DATA: dynasties, ATLAS_SNAPSHOTS: atlas} = context.window;
  const periods = [];
  const events = [];
  const snapshots = new Map();
  for (let i = 0; i < dynasties.length; i++) {
    const d = dynasties[i];
    for (const e of d.milestones || []) {
      if (e.year !== 0 && Array.isArray(e.coord)) {
        events.push({year: e.year, title: e.headline, site: e.site, coord: e.coord, dynasty: d.title});
      }
    }
    if (d.fromYear > metadata.to) continue;
    const to = Math.min(dynasties[i + 1] ? dynasties[i + 1].fromYear - 1 : d.toYear, metadata.to);
    const sequence = d.phases?.length ? d.phases : [{until: d.toYear, snap: 's_' + d.key}];
    const phases = [];
    for (let j = 0; j < sequence.length; j++) {
      const {snap, until, overview = ''} = sequence[j];
      const start = j ? sequence[j - 1].until : d.fromYear;
      const end = j === sequence.length - 1 ? to : Math.min(until - 1, to);
      if (start > end) continue;
      const src = atlas[snap];
      if (!src || !Array.isArray(src.polities) || !/^s_[a-z0-9_]+$/.test(snap)) {
        throw Error('Invalid polity snapshot ' + snap);
      }
      if (!snapshots.has(snap)) {
        const polities = src.polities.map(p => ({
          title: p.title, tint: p.tint || d.tint, category: p.category, anchor: p.anchor, shape: p.shape,
        }));
        snapshots.set(snap, {caption: src.caption || '', note: src.note || '', polities});
      }
      phases.push({from: start, to: end, snapshot: snap, overview});
    }
    if (phases.length) periods.push({key: d.key, title: d.title, from: d.fromYear, to, phases});
  }
  events.sort((a, b) => a.year - b.year);
  const files = new Map();
  for (const [key, snapshot] of snapshots) {
    files.set('data/history/' + key + '.js', 'window.JIANGSHAN_SNAPSHOTS=window.JIANGSHAN_SNAPSHOTS||{};window.JIANGSHAN_SNAPSHOTS[' +
      JSON.stringify(key) + ']=' + JSON.stringify(snapshot) + ';');
  }
  const history = {metadata, periods, events, snapshotKeys: [...snapshots.keys()]};
  files.set('data/history.js', 'window.JIANGSHAN_HISTORY=' + JSON.stringify(history) + ';');
  files.set('data/history_manifest.json', JSON.stringify({
    ...metadata, snapshotCount: snapshots.size, periodCount: periods.length, eventCount: events.length,
  }, null, 2));
  return files;
}

function syncHistory(checkOnly) {
  const changed = [];
  for (const [rel, contents] of buildHistory()) {
    const output = path.join(root, rel);
    if (fs.existsSync(output) && fs.readFileSync(output, 'utf8').replace(/\r\n/g, '\n') === contents) continue;
    changed.push(rel);
    if (!checkOnly) fs.writeFileSync(output, contents);
  }
  if (checkOnly && changed.length) throw Error('Rebuild standalone historical data: ' + changed.join(', '));
  return changed;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const changed = syncHistory(check);
  console.log(check ? 'Standalone historical data matches the atlas sources.' : 'Updated: ' + (changed.join(', ') || 'already current'));
}
module.exports = {syncHistory};

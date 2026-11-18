'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { checkOutputs } = require('../build_atlas.js');

const root = path.resolve(__dirname, '../..');

test('polygon build treats checkout line endings equally and detects stale content', (t) => {
  const read = fs.readFileSync;
  const boot = path.join(root, 'js/atlas_boot.js');
  let staleBoot = false;
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    const original = read(file, ...args);
    const relative = path.relative(root, String(file)).split(path.sep).join('/');
    if (typeof original !== 'string' ||
      !(relative.startsWith('data/atlas/') || /^js\/atlas_(boot|snapshots)\.js$/.test(relative))) {
      return original;
    }
    const content = original.replace(/\r?\n/g, '\r\n');
    return staleBoot && file === boot ? content + '// stale build\r\n' : content;
  });

  assert.deepEqual(checkOutputs(root), []);
  staleBoot = true;
  assert.deepEqual(checkOutputs(root), ['js/atlas_boot.js is out of date with data/atlas/']);
});

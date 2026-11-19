'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {verifyProvider, verify1911} = require('../verify_period_admin.cjs');

function sourceInventory() {
  return [
    ['chgis-v6-prefecture-wgs84.zip', 5214], ['chgis-v6-county-wgs84.zip', 10493],
    ['figshare-county-wgs84.csv', 4257], ['mcgd-republic-county-wgs84.csv', 1956],
    ['chgis-1911-wgs84.csv', 2490], ['tan-atlas-toponym-index-gbk.zip', null],
  ].map(([file, rows]) => ({file, sha256:'0'.repeat(64), rows, 'index names':1,
    skipped:file === 'figshare-county-wgs84.csv' ? {'ambiguous CHGIS identity':43} : {}}));
}

test('strict acceptance rejects missing data, omitted required inputs and silent empty years', () => {
  const empty = () => [];
  assert.throws(() => verifyProvider({inputFiles:[], placesForYear:empty}), /requires a source inventory/);
  assert.throws(() => verifyProvider({
    inputFiles:sourceInventory().filter(item=>item.file!=='chgis-1911-wgs84.csv'), placesForYear:empty,
  }), /missing required source: chgis-1911-wgs84.csv/);
  assert.throws(() => verifyProvider({inputFiles:sourceInventory(), placesForYear:empty}), /empty historical coverage at -403/);
  const missingCandidates = sourceInventory();
  missingCandidates.find(item => item.file === 'figshare-county-wgs84.csv').skipped = {};
  assert.throws(() => verifyProvider({inputFiles:missingCandidates, placesForYear:empty}), /Figshare candidate accounting/);
});

test('1911 completeness counts the single-year slice separately from time-series supplements', () => {
  const records = [];
  for (const [level,count] of [['county',2139],['prefecture',351]]) {
    for (let i=0; i<count; i++) {
      records.push({id:'slice:1911:'+level+':'+i,level,source:5,from:1911,through:1911,
        parent:'淮安府',ancient:i===0 && level==='county'?'盐城县':'测试点'});
    }
  }
  verify1911(records);
  records[0] = {...records[0], id:'chgis:1:replacement'};
  assert.throws(() => verify1911(records), /1911 county slice/);
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const boot = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('window.ATLAS_SCRIPTS_READY'));

async function load(failed, persistent = []) {
  const calls = [];
  const status = {};
  const events = {};
  const window = {addEventListener:(type, callback) => { events[type] = callback; }};
  const origin = 'https://atlas.example';
  const document = {
    body:{}, scripts:[], getElementById:() => status,
    addEventListener:(type, callback) => { events[type] = callback; },
    removeEventListener:type => { delete events[type]; },
    createElement:() => ({setAttribute(name,value) { this[name] = value; }}),
  };
  for (const name of ['js/map_data.js', 'js/app.js', 'js/atlas_search.js', 'integration.js']) {
    document.scripts.push({
      tagName:'SCRIPT', parentElement:document.body, src:new URL(name,origin).href,
      attributes:[{name:'src',value:name}], getAttribute:() => name,
      replaceWith(node) {
        calls.push(node.src);
        queueMicrotask(persistent.includes(node.src) ? node.onerror : node.onload);
      },
    });
  }
  vm.runInNewContext(boot,{window,document,URL,URLSearchParams,location:{origin,search:''}});
  for (const name of failed) events.error({target:document.scripts.find(el => el.getAttribute()===name)});
  await events.DOMContentLoaded();
  return {ready:await window.ATLAS_SCRIPTS_READY,calls,message:status.textContent};
}

test('only failed initial scripts are retried once in document order', async () => {
  assert.deepEqual((await load([])).calls, []);
  const run = await load(['js/atlas_search.js','js/map_data.js','js/atlas_search.js']);
  assert.equal(run.ready,true);
  assert.deepEqual(run.calls,['js/map_data.js','js/atlas_search.js']);
});

test('a persistent core failure has readable feedback; a 3D extension failure still allows 2D', async () => {
  const bad = await load(['js/map_data.js'],['js/map_data.js']);
  assert.equal(bad.ready,false);
  assert.match(bad.message,/请刷新/);
  assert.deepEqual(bad.calls,['js/map_data.js']);
  assert.equal((await load(['integration.js'],['integration.js'])).ready,true);
});

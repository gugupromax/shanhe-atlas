#!/usr/bin/env node
/**
 * benchmark_terrain_cold_start.cjs — measure the 741 fusion 3D cold start.
 *
 * Splits the wait into the segments that actually matter:
 *   renderer  : WebGL context + renderer construction
 *   grid-fetch: download/parse of the elevation grid
 *   decode    : elevation decoding and sea mask
 *   positions : vertex position/colour/uv arrays
 *   normals   : grid normals (or index + computeVertexNormals)
 *   mesh      : BufferGeometry upload, material, scene.add
 *   build     : the whole build() call
 *   paint     : from navigation start to the first rendered frame
 *
 * Usage:
 *   node scripts/benchmark_terrain_cold_start.cjs              # 3 cold runs, real GPU
 *   node scripts/benchmark_terrain_cold_start.cjs --runs=5
 *   node scripts/benchmark_terrain_cold_start.cjs --software    # SwiftShader, reproduces the 41-48s case
 *   node scripts/benchmark_terrain_cold_start.cjs --json        # machine-readable summary
 *
 * The script starts and stops its own static server, so it can never leave a
 * foreground server blocking the shell.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RECORD = path.join(ROOT, '.runtime', 'server.json');
const VIEWPORT = { width: 1440, height: 900 };
const FIRST_DRAW_TIMEOUT_MS = 180_000;

function playwright() {
  if (process.env.TERRAIN_TEST_PLAYWRIGHT) return require(process.env.TERRAIN_TEST_PLAYWRIGHT);
  try {
    return require('playwright');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
      'dependencies', 'node', 'node_modules', 'playwright'));
  }
}

function pythonBin() {
  for (const candidate of [process.env.PYTHON, 'python', 'py'].filter(Boolean)) {
    const probe = spawnSync(candidate, ['-c', 'print(1)'], { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  throw new Error('Python 3 is required to start the static server');
}

function post(url, token) {
  return new Promise((resolve) => {
    const req = http.request(url, { method: 'POST', headers: { 'X-Jiangshan-Token': token } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(0));
    req.end();
  });
}

async function startServer() {
  fs.rmSync(RECORD, { force: true });
  spawn(pythonBin(), [path.join(ROOT, 'scripts', 'launch_map.pyw'), '--spawn-hidden', '--no-browser'],
    { cwd: ROOT, stdio: 'ignore', detached: true }).unref();
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (fs.existsSync(RECORD)) {
      const record = JSON.parse(fs.readFileSync(RECORD, 'utf8'));
      if (record.url) return record;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('launcher did not publish a runtime record');
}

async function stopServer(record) {
  if (!record) return;
  const status = await post(`${record.url}/__jiangshan_stop__`, record.token);
  fs.rmSync(RECORD, { force: true });
  return status;
}

function summarize(marks, spans) {
  const at = Object.fromEntries(marks.map((m) => [m.name, m.at]));
  const pick = (from, to) => (at[from] != null && at[to] != null ? at[to] - at[from] : null);
  return {
    renderer: pick('renderer-start', 'renderer-ready'),
    gridFetch: spans['grid-fetch'] ?? null,
    decode: spans.decode ?? null,
    positions: spans.positions ?? null,
    normals: spans.normals ?? null,
    mesh: spans.mesh ?? null,
    build: spans['build-total'] ?? null,
    firstDrawAt: at['first-draw'] ?? null,
    tilesComplete: at['draw-complete'] ?? null,
  };
}

async function coldRun(browser, baseUrl, software, noAA) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.addInitScript(() => {
    try { localStorage.setItem('atlasPerf', '1'); } catch (error) { /* ignore */ }
  });
  const url = new URL(baseUrl);
  url.search = '?year=741&zoom=8&center=109,34' + (noAA ? '&aa=0' : '');
  try {
    const began = Date.now();
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.atlasApp?.year === 741, null, { timeout: 120_000 });
    const clickedAt = Date.now();
    await page.click('#fusion-3d');
    await page.waitForSelector('#viewport-frame.fusion-is-3d', { timeout: 120_000 });
    let frame = null;
    for (let attempt = 0; attempt < 200 && !frame; attempt += 1) {
      frame = page.frames().find((child) => child.url().includes('terrain.html'));
      if (!frame) await page.waitForTimeout(100);
    }
    assert.ok(frame, 'terrain.html frame never appeared');
    await frame.waitForFunction(
      () => performance.getEntriesByName('atlas-3d:first-draw', 'mark').length > 0,
      null,
      { polling: 100, timeout: FIRST_DRAW_TIMEOUT_MS },
    );
    const collected = await frame.evaluate(() => ({
      report: window.__atlasPerf ? window.__atlasPerf.report() : null,
      entries: Object.fromEntries(performance.getEntries()
        .filter((entry) => entry.name.startsWith('atlas-3d:'))
        .map((entry) => [entry.name.slice('atlas-3d:'.length),
          Math.round(entry.entryType === 'mark' ? entry.startTime : entry.duration)])),
    }));
    const report = collected.report || { spans: {}, marks: [] };
    const summary = summarize(report.marks, report.spans || {});
    return {
      software,
      clickToFirstDrawMs: Date.now() - clickedAt,
      navToFirstDrawMs: Date.now() - began,
      ...summary,
      marks: collected.entries,
    };
  } finally {
    await page.close();
  }
}

function median(values) {
  const clean = values.filter((value) => typeof value === 'number');
  if (!clean.length) return null;
  const sorted = [...clean].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function main() {
  const runsArg = process.argv.find((arg) => arg.startsWith('--runs='));
  const runs = Math.max(1, Number(runsArg ? runsArg.split('=')[1] : 3));
  const software = process.argv.includes('--software');
  const noAA = process.argv.includes('--aa=0');
  const asJson = process.argv.includes('--json');

  const { chromium } = playwright();
  const executablePath = process.env.TERRAIN_TEST_CHROME ||
    (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
  const record = await startServer();
  const browser = await chromium.launch({
    executablePath,
    args: software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
  });

  const results = [];
  try {
    for (let index = 0; index < runs; index += 1) {
      const result = await coldRun(browser, record.url, software, noAA);
      results.push(result);
      if (!asJson) {
        console.log(`run ${index + 1}/${runs}  click→first-draw ${(result.clickToFirstDrawMs / 1000).toFixed(1)}s  `
          + `renderer ${result.renderer ?? '?'}ms  build ${result.build ?? '?'}ms  `
          + `(decode ${result.decode ?? '?'} / positions ${result.positions ?? '?'} / `
          + `normals ${result.normals ?? '?'} / mesh ${result.mesh ?? '?'})`);
      }
    }
  } finally {
    await browser.close();
    await stopServer(record);
  }

  const keys = ['renderer', 'gridFetch', 'decode', 'positions', 'normals', 'mesh', 'build', 'firstDrawAt', 'clickToFirstDrawMs'];
  const summary = Object.fromEntries(keys.map((key) => [key, median(results.map((r) => r[key]))]));
  summary.runs = runs;
  summary.software = software;

  if (asJson) {
    console.log(JSON.stringify({ summary, results }, null, 2));
    return;
  }

  console.log('\nsegment                     median');
  console.log('------------------------------------');
  for (const key of keys) {
    const value = summary[key];
    console.log(`${key.padEnd(26)} ${value == null ? 'n/a' : `${value} ms`}`);
  }
  console.log('\n冷启动中位数：', summary.clickToFirstDrawMs == null ? 'n/a'
    : `${(summary.clickToFirstDrawMs / 1000).toFixed(1)} s（点击 3D 到首帧）`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


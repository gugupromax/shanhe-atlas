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
const {loadPlaywright} = require('./load_playwright.cjs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const VIEWPORT = { width: 1440, height: 900 };
const FIRST_DRAW_TIMEOUT_MS = 180_000;
const SERVER_START_TIMEOUT_MS = 20_000;
const SERVER_STOP_TIMEOUT_MS = 2_000;

function pythonBin() {
  for (const candidate of [process.env.PYTHON, 'python', 'py'].filter(Boolean)) {
    const probe = spawnSync(candidate, ['-c', 'import sys; print(sys.executable)'], {
      encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: SERVER_START_TIMEOUT_MS,
      windowsHide: true,
    });
    const executable = probe.stdout?.trim();
    if (probe.status === 0 && executable) return executable;
  }
  throw new Error('Python 3 is required to start the static server');
}

function startServer() {
  const child = spawn(pythonBin(), [path.join(ROOT, 'scripts', 'launch_map.pyw'), '--benchmark'], {
    cwd: ROOT, stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true,
  });
  const closed = new Promise((resolve) => child.once('close', resolve));
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Benchmark server did not report its address')),
      SERVER_START_TIMEOUT_MS);
    const fail = (error) => { clearTimeout(timer); reject(error); };
    child.on('error', fail);
    child.stdin.on('error', fail);
    child.once('close', (code, signal) => fail(new Error(`Benchmark server closed (${code ?? signal})`)));
    let output = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      output += chunk;
      const end = output.indexOf('\n');
      if (end === -1) return;
      clearTimeout(timer);
      try {
        const { url } = JSON.parse(output.slice(0, end));
        if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(url)) {
          throw new Error('Benchmark server reported an invalid loopback address');
        }
        resolve(url);
      } catch (error) {
        fail(error);
      }
    });
  });
  return {
    ready,
    async stop() {
      child.stdin.end();
      const timer = setTimeout(() => child.kill('SIGKILL'), SERVER_STOP_TIMEOUT_MS);
      try {
        await closed;
      } finally {
        clearTimeout(timer);
      }
    },
  };
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
    const collected = await frame.evaluate(() => {
      const canvas = document.querySelector('#canvas-host canvas');
      const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
      return {
        aa: new URLSearchParams(location.search).get('aa'),
        contextAntialias: gl?.getContextAttributes()?.antialias ?? null,
        report: window.__atlasPerf ? window.__atlasPerf.report() : null,
        entries: Object.fromEntries(performance.getEntries()
          .filter((entry) => entry.name.startsWith('atlas-3d:'))
          .map((entry) => [entry.name.slice('atlas-3d:'.length),
            Math.round(entry.entryType === 'mark' ? entry.startTime : entry.duration)])),
      };
    });
    assert.equal(collected.aa, noAA ? '0' : null, 'unexpected antialiasing option in terrain iframe');
    if (noAA) assert.equal(collected.contextAntialias, false, 'terrain WebGL context must disable antialiasing');
    const report = collected.report || { spans: {}, marks: [] };
    const summary = summarize(report.marks, report.spans || {});
    return {
      software,
      contextAntialias: collected.contextAntialias,
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

  const { chromium } = loadPlaywright();
  const executablePath = process.env.TERRAIN_TEST_CHROME ||
    (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
  const results = [];
  let server;
  let browser;
  try {
    server = startServer();
    const url = await server.ready;
    browser = await chromium.launch({
      executablePath,
      args: software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
    });
    for (let index = 0; index < runs; index += 1) {
      const result = await coldRun(browser, url, software, noAA);
      results.push(result);
      if (!asJson) {
        console.log(`run ${index + 1}/${runs}  click→first-draw ${(result.clickToFirstDrawMs / 1000).toFixed(1)}s  `
          + `renderer ${result.renderer ?? '?'}ms  build ${result.build ?? '?'}ms  `
          + `(decode ${result.decode ?? '?'} / positions ${result.positions ?? '?'} / `
          + `normals ${result.normals ?? '?'} / mesh ${result.mesh ?? '?'})`);
      }
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      await server?.stop();
    }
  }

  const keys = ['renderer', 'gridFetch', 'decode', 'positions', 'normals', 'mesh', 'build', 'firstDrawAt', 'clickToFirstDrawMs'];
  const summary = Object.fromEntries(keys.map((key) => [key, median(results.map((r) => r[key]))]));
  summary.runs = runs;
  summary.software = software;
  summary.antialiasRequested = !noAA;

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


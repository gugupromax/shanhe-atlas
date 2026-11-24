#!/usr/bin/env node
/**
 * verify_all.cjs — one-command gate for the non-browser regression suite.
 *
 * Usage:
 *   node scripts/verify_all.cjs            # run everything
 *   node scripts/verify_all.cjs --only=fusion,history
 *   node scripts/verify_all.cjs --quiet
 *
 * Exit code 1 if any check fails. Every check gets a hard timeout so a hung
 * check can never block the pipeline the way a foreground static server would.
 */
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PER_CHECK_TIMEOUT_MS = 180_000;
const TAIL_LINES = 2;

const CHECKS = [
  { id: 'command', title: '战役指挥与兵种表', file: 'battles/verify-command.cjs' },
  { id: 'campaign', title: '多战场时钟与战果联动', file: 'battles/verify-campaign.cjs' },
  { id: 'fusion', title: '平面/3D 融合与状态同步', file: 'scripts/verify_fusion.cjs' },
  { id: 'fusion-layers', title: '融合图层与投影', file: 'scripts/verify_fusion_layers.cjs' },
  { id: 'history', title: '逐年阶段覆盖与事件', file: 'scripts/verify_history.cjs' },
  { id: 'map-surface', title: '地图贴面与资源', file: 'scripts/verify_map_surface.cjs' },
  { id: 'routes', title: '八陉通道示意与裁剪', file: 'scripts/verify_routes.cjs' },
  { id: 'viewport', title: '墨卡托与视角约束', file: 'scripts/verify_viewport.cjs' },
  { id: 'surface-races', title: '贴面竞态与重入', file: 'scripts/verify_surface_races.cjs' },
  { id: 'surface-registration', title: '贴面与地形坐标注册', file: 'scripts/verify_surface_registration.cjs' },
  { id: 'period-admin', title: '历代治所数据完整性', file: 'scripts/verify_period_admin.cjs' },
  { id: 'atlas', title: '图集内容与 CUJ', file: 'scripts/validate_atlas.js' },
  { id: 'perf-budget', title: '首屏体积预算', file: 'scripts/perf_budget.js' },
];

const argv = process.argv.slice(2);
const quiet = argv.includes('--quiet');
const onlyArg = argv.find((a) => a.startsWith('--only='));
const wanted = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;
const selected = wanted ? CHECKS.filter((c) => wanted.includes(c.id)) : CHECKS;

if (selected.length === 0) {
  console.error(`No checks matched. Known ids: ${CHECKS.map((c) => c.id).join(', ')}`);
  process.exit(2);
}

function tail(text, lines) {
  const rows = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  return rows.slice(-lines).join(' / ').slice(0, 400);
}

const results = [];
const startedAll = Date.now();

for (const check of selected) {
  const began = Date.now();
  let status = 'PASS';
  let detail = '';
  try {
    const stdout = execFileSync(process.execPath, [path.join(ROOT, check.file)], {
      cwd: ROOT,
      timeout: PER_CHECK_TIMEOUT_MS,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    detail = tail(stdout, TAIL_LINES);
  } catch (error) {
    const timedOut = error.killed || error.signal === 'SIGTERM';
    status = timedOut ? 'TIMEOUT' : 'FAIL';
    detail = tail(error.stdout || error.stderr || error.message, TAIL_LINES + 1);
  }
  const ms = Date.now() - began;
  results.push({ ...check, status, ms, detail });
  if (!quiet) {
    console.log(`[${status.padEnd(7)}] ${check.id.padEnd(22)} ${String(ms).padStart(7)} ms  ${detail}`);
  }
}

const failed = results.filter((r) => r.status !== 'PASS');
const totalMs = Date.now() - startedAll;

console.log('');
console.log(`checks   : ${results.length} (${results.length - failed.length} passed, ${failed.length} failed)`);
console.log(`duration : ${(totalMs / 1000).toFixed(1)} s`);

if (failed.length) {
  console.log('');
  console.log('failed checks:');
  for (const f of failed) console.log(`  - ${f.id} (${f.file}) [${f.status}] ${f.detail}`);
  process.exit(1);
}

console.log('PASS: 全部非浏览器回归通过。浏览器/真机性能验收另跑 scripts/verify_terrain_browser.cjs。');

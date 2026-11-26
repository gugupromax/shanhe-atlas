#!/usr/bin/env node
/**
 * verify_all.cjs — one-command gate for the non-browser regression suite.
 *
 * Usage:
 *   node scripts/verify_all.cjs            # run everything
 *   node scripts/verify_all.cjs --only=fusion,history
 *   node scripts/verify_all.cjs --quiet
 *   node scripts/verify_all.cjs --allow-unbuilt  # CI checkout without the local period-admin bundle
 *
 * Exit code 1 if any check fails. Every check gets a hard timeout so a hung
 * check can never block the pipeline the way a foreground static server would.
 * A failed check keeps its complete output in .runtime/verify-<id>.log.
 */
'use strict';

const { spawnSync } = require('child_process');
const { randomUUID } = require('crypto');
const {
  appendFileSync, closeSync, fstatSync, mkdirSync, openSync, readSync,
  readdirSync, renameSync, unlinkSync,
} = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, '.runtime');
const PER_CHECK_TIMEOUT_MS = 180_000;
const TAIL_BYTES = 4096;
const argv = process.argv.slice(2);
const unitTests = readdirSync(path.join(ROOT, 'scripts/tests'))
  .filter((name) => /^test_.*\.cjs$/.test(name))
  .sort()
  .map((name) => path.join('scripts/tests', name));

const CHECKS = [
  { id: 'unit', title: '仓库单元与回归测试', args: ['--test', ...unitTests] },
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
  {
    id: 'period-admin', title: '历代治所数据完整性',
    args: ['scripts/verify_period_admin.cjs', ...argv.filter((arg) => arg === '--allow-unbuilt')],
  },
  { id: 'atlas', title: '图集内容与 CUJ', file: 'scripts/validate_atlas.js' },
  { id: 'perf-budget', title: '首屏体积预算', args: ['scripts/perf_budget.js', '--check'] },
];

const quiet = argv.includes('--quiet');
const onlyArg = argv.find((a) => a.startsWith('--only='));
const wanted = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;
const selected = wanted ? CHECKS.filter((c) => wanted.includes(c.id)) : CHECKS;

if (selected.length === 0) {
  console.error(`No checks matched. Known ids: ${CHECKS.map((c) => c.id).join(', ')}`);
  process.exit(2);
}

function tail(fd) {
  const { size } = fstatSync(fd);
  const buffer = Buffer.alloc(Math.min(size, TAIL_BYTES));
  const bytesRead = readSync(fd, buffer, 0, buffer.length, size - buffer.length);
  const rows = buffer.toString('utf8', 0, bytesRead).trim().split(/\r?\n/).filter(Boolean);
  return rows.slice(-2).join(' / ').slice(0, 400);
}

mkdirSync(LOG_DIR, { recursive: true });
const results = [];
const startedAll = Date.now();

for (const check of selected) {
  const began = Date.now();
  const tempPath = path.join(LOG_DIR, `verify-${check.id}-${randomUUID()}.tmp`);
  const fd = openSync(tempPath, 'wx+');
  let result;
  let detail = '';
  try {
    result = spawnSync(process.execPath, check.args ?? [check.file], {
      cwd: ROOT,
      timeout: PER_CHECK_TIMEOUT_MS,
      stdio: ['ignore', fd, fd],
    });
    if (!quiet && result.status === 0 && !result.error) detail = tail(fd);
  } finally {
    closeSync(fd);
  }

  let status = 'PASS';
  if (result.status === 0 && !result.error) {
    unlinkSync(tempPath);
  } else {
    status = result.error?.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'FAIL';
    const logPath = path.join(LOG_DIR, `verify-${check.id}.log`);
    const diagnostics = [status, `Exit code: ${result.status}`, `Signal: ${result.signal}`];
    if (result.error) diagnostics.push(result.error.stack || result.error.message);
    appendFileSync(tempPath, '\n\n' + diagnostics.join('\n') + '\n');
    renameSync(tempPath, logPath);
    detail = `log: .runtime/verify-${check.id}.log`;
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
  for (const f of failed) console.log(`  - ${f.id} (${f.file ?? f.args.slice(0, 1).join(' ')}) [${f.status}] ${f.detail}`);
  process.exit(1);
}

console.log('PASS: 全部非浏览器回归通过。浏览器/真机性能验收另跑 scripts/verify_terrain_browser.cjs。');

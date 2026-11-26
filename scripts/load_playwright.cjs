'use strict';

const os = require('node:os');
const path = require('node:path');

function loadPlaywright() {
  if (process.env.TERRAIN_TEST_PLAYWRIGHT) return require(process.env.TERRAIN_TEST_PLAYWRIGHT);
  try {
    return require('playwright');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
      'dependencies', 'node', 'node_modules', 'playwright'));
  }
}

module.exports = {loadPlaywright};

// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { _electron } from 'playwright-core';
import { settingsView } from './settings-view.mjs';
const root = process.cwd(),
  parent = path.join(root, '.runtime/overnight-ui');
mkdirSync(parent, { recursive: true });
const folder = mkdtempSync(path.join(parent, 'run-')),
  require = createRequire(import.meta.url),
  report = { checks: [], errors: [] };
const entry = path.join(folder, 'main.mjs');
writeFileSync(
  entry,
  `import {app} from 'electron';try{await import(${JSON.stringify(pathToFileURL(path.join(root, 'apps/desktop/main.mjs')).href)});}catch(error){console.error(error);app.exit(1);}`,
);
const server = createServer((_req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end('{"data":[]}');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const env = {
  ...process.env,
  CAPRI_DESKTOP_VERIFICATION_DIR: folder,
  CAPRI_DESKTOP_VERIFICATION_PORT: String(server.address().port),
  CAPRI_DESKTOP_VERIFICATION_SKIP_START: '1',
};
delete env.ELECTRON_RUN_AS_NODE;
let application;
const passed = (name) => {
  report.checks.push(name);
  console.log('PASS ' + name);
};
try {
  application = await _electron.launch({
    executablePath: require('electron'),
    args: [entry, '--verification'],
    env,
    timeout: 60000,
  });
  application.on('window', (page) =>
    page.on('pageerror', (error) => report.errors.push(error.message)),
  );
  const page = await application.firstWindow();
  await page.waitForFunction(() => document.body.dataset.phase === 'ready', null, {
    timeout: 60000,
  });
  assert.equal(await page.locator('#coding-toggle').count(), 0);
  const models = await settingsView(application, 'models');
  await models.locator('[data-npu="backend"]').scrollIntoViewIfNeeded();
  await models.screenshot({ path: path.join(folder, 'native-npu-settings.png') });
  assert.equal(await models.locator('[data-npu="use"]').isDisabled(), true);
  assert.equal(await models.locator('[data-npu="backend"] option').count(), 3);
  passed(
    'Native NPU controls load through the protected resource protocol; activation requires a model test',
  );
  assert.deepEqual(report.errors, []);
} finally {
  writeFileSync(path.join(folder, 'report.json'), JSON.stringify(report, null, 2));
  await application?.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log('Report: ' + path.join(folder, 'report.json'));

// SPDX-License-Identifier: GPL-3.0-only
// Real Electron UI and IPC; isolated profile, synthetic GitHub bytes. No update is executed.
import { saveSettings } from './settings-view.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { _electron as electron } from 'playwright-core';
import { root, runtime, initialize, environment } from '../../packages/runtime/src/index.mjs';
const parent = path.join(root, '.runtime/update-ui-verification');
mkdirSync(parent, { recursive: true });
const folder = mkdtempSync(path.join(parent, 'fixture-'));
const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end('{"data":[]}');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const rt = runtime({
  stateDir: path.join(folder, 'openclaw'),
  workspace: path.join(folder, 'workspace'),
  gatewayPort: port,
  logPrefix: 'update-verification',
});
initialize(rt);
const env = {
  ...environment(rt),
  CAPRI_DESKTOP_VERIFICATION_DIR: folder,
  CAPRI_DESKTOP_VERIFICATION_PORT: String(port),
  CAPRI_DESKTOP_VERIFICATION_SKIP_START: '1',
};
delete env.ELECTRON_RUN_AS_NODE;
let application;
const fixtureToken = 'ghp_' + 'f'.repeat(40);
try {
  application = await electron.launch({
    executablePath: createRequire(import.meta.url)('electron'),
    args: [path.join(root, 'apps/desktop/main.mjs'), '--verification'],
    env,
    timeout: 30000,
  });
  const page = await application.firstWindow(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForFunction(() => document.body.dataset.phase === 'ready');
  await application.evaluate(
    async ({ BrowserWindow, shell }, { token }) => {
      const window = BrowserWindow.getAllWindows().find(
        (item) => item.webContents.getURL() === 'capri://desktop/index.html',
      );
      window.webContents.setBackgroundThrottling(false);
      window.showInactive();
      shell.openExternal = async (url) => {
        globalThis.fixtureReleasePage = url;
      };
      const original = globalThis.fetch;
      // Release-list requests in order, so each check can assert what was sent.
      globalThis.fixtureListAuthorizations = [];
      globalThis.fetch = async (url, options) => {
        const address = String(url);
        const authorization = new Headers(options.headers).get('authorization');
        if (authorization && authorization !== 'Bearer ' + token)
          throw Error('Unexpected fixture credential');
        if (
          address.startsWith(
            'https://api.github.com/repos/OleksandrKukotin/CapriCore-Linux/releases?',
          )
        )
          globalThis.fixtureListAuthorizations.push(authorization);
        if (
          address.startsWith(
            'https://api.github.com/repos/OleksandrKukotin/CapriCore-Linux/releases?',
          )
        )
          return new Response(
            JSON.stringify([
              {
                tag_name: 'v1.0.4',
                prerelease: false,
                draft: false,
                body: 'Stable release notes',
                assets: [],
              },
              {
                tag_name: 'v99.0.0',
                prerelease: true,
                draft: false,
                body: 'Preview release notes',
                assets: [],
              },
            ]),
          );
        return original(url, options);
      };
    },
    { token: fixtureToken },
  );
  await page.evaluate(() => window.capri.openSettings('updates'));
  const settings = application
    .windows()
    .find((candidate) => candidate.url().endsWith('/settings.html'));
  assert(settings, 'Settings window was not opened.');
  settings.on('pageerror', (error) => errors.push(error.message));
  await settings.locator('#updates-panel').waitFor({ state: 'visible' });
  const listAuthorizations = () =>
    application.evaluate(() => globalThis.fixtureListAuthorizations.splice(0));
  await settings.locator('#updates-versions').click();
  await settings.waitForFunction(() => !document.getElementById('updates-versions').disabled);
  assert.equal(await settings.locator('#settings-notice').textContent(), '');
  assert.deepEqual(await settings.locator('#updates-version option').allTextContents(), ['v1.0.4']);
  assert.equal(await settings.locator('#updates-changelog').textContent(), 'Stable release notes');
  await settings.locator('#updates-release-page').click();
  assert.equal(
    await application.evaluate(() => globalThis.fixtureReleasePage),
    'https://github.com/OleksandrKukotin/CapriCore-Linux/releases/tag/v1.0.4',
  );
  await settings.locator('#updates-check').click();
  await settings.waitForFunction(
    async () => (await window.capri.updateStatus()).phase === 'current',
  );
  assert.equal((await settings.evaluate(() => window.capri.githubStatus())).connected, false);
  const anonymous = await listAuthorizations();
  assert(anonymous.length > 0, 'No release list was requested.');
  assert.deepEqual(new Set(anonymous), new Set([null]), 'A token was sent before one was saved.');
  // Linux without a keyring service falls back to Electron's basic_text backend,
  // which Capri rightly refuses as secure storage. Only then, replace safeStorage
  // in this verification process with a reversible fixture that reports a real
  // backend; with a keyring, the OS backend is exercised unchanged.
  const fixtureStorage = await application.evaluate(async ({ safeStorage }) => {
    const available = await safeStorage.isAsyncEncryptionAvailable();
    if (
      available &&
      !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
    )
      return false;
    const prefix = Buffer.from('capri-verification-storage:');
    Object.assign(safeStorage, {
      isAsyncEncryptionAvailable: async () => true,
      getSelectedStorageBackend: () => 'gnome_libsecret',
      encryptStringAsync: async (value) => Buffer.concat([prefix, Buffer.from(value)]),
      decryptStringAsync: async (value) => {
        if (!value.subarray(0, prefix.length).equals(prefix))
          throw Error('Not a fixture ciphertext');
        return { result: value.subarray(prefix.length).toString(), shouldReEncrypt: false };
      },
    });
    return true;
  });
  // Auth IPC is deliberately disabled in verification. Seed only this isolated
  // profile with an encrypted synthetic credential.
  const ciphertext = await application.evaluate(
    async ({ safeStorage }, token) =>
      (await safeStorage.encryptStringAsync(token)).toString('base64'),
    fixtureToken,
  );
  const secrets = path.join(folder, 'data', 'secrets');
  mkdirSync(secrets, { recursive: true });
  writeFileSync(
    path.join(secrets, 'github-updates.json'),
    JSON.stringify({ schemaVersion: 1, ciphertext }),
  );
  await settings.locator('#updates-check').click();
  await settings.waitForFunction(
    async () => (await window.capri.updateStatus()).phase === 'current',
  );
  assert.equal((await settings.evaluate(() => window.capri.githubStatus())).connected, true);
  const saved = await listAuthorizations();
  assert(saved.length > 0, 'No release list was requested after saving a token.');
  assert.deepEqual(
    new Set(saved),
    new Set(['Bearer ' + fixtureToken]),
    'The saved token was not sent with the update check.',
  );
  await settings.locator('#updates-experimental').check();
  assert.equal((await settings.evaluate(() => window.capri.updateStatus())).experimental, false);
  await settings.locator('#updates-versions').click();
  await settings
    .locator('#updates-version')
    .selectOption('OleksandrKukotin/CapriCore-Linux@v99.0.0');
  assert.equal(await settings.locator('#updates-changelog').textContent(), 'Preview release notes');
  await settings.locator('#updates-select').click();
  await settings.waitForFunction(
    async () => (await window.capri.updateStatus()).release?.tag === 'v99.0.0',
  );
  // A source checkout updates with git pull: no download, no installer.
  assert.equal((await settings.evaluate(() => window.capri.updateStatus())).mode, 'checkout');
  assert.equal(await settings.locator('#updates-checkout').isVisible(), true);
  assert.equal(await settings.locator('#updates-download').isVisible(), false);
  assert.equal(await settings.locator('#updates-install').isVisible(), false);
  assert.equal(await settings.locator('#settings-notice').textContent(), '');
  await saveSettings(settings);
  await settings.waitForFunction(async () => (await window.capri.updateStatus()).experimental);
  assert.equal(
    await settings.evaluate(() =>
      window.capri.installUpdate().then(
        () => true,
        () => false,
      ),
    ),
    false,
  );
  await settings.screenshot({ path: path.join(folder, 'available-en.png') });
  await settings.locator('[data-section="languages"]').click();
  await settings.locator('#language-interface').selectOption('uk');
  await saveSettings(settings);
  await settings.waitForFunction(() => document.documentElement.lang === 'uk');
  await settings.locator('[data-section="updates"]').click();
  await settings.waitForFunction(
    () =>
      document.getElementById('updates-status').textContent.includes('Доступна нова версія') &&
      document.getElementById('updates-checkout').textContent.includes('git pull'),
  );
  assert.notEqual(
    await settings.locator('#updates-checkout').textContent(),
    'This is a source checkout. Update it with git pull, then restart Capri.',
  );
  await settings.screenshot({ path: path.join(folder, 'available-uk.png') });
  assert.equal(await settings.locator('#updates-experimental').isChecked(), true);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        'public update checks send no GitHub token',
        'release history and changelog without a GitHub token',
        'selecting an update and opening its GitHub release page from Settings',
        'a saved GitHub credential is sent with update checks',
        'stable and experimental channel selection',
        'a source checkout offers git pull, with no download or installer',
        'Ukrainian interface',
        'persistent experimental setting',
        'installer execution refused for a checkout',
      ],
      secureStorage: fixtureStorage ? 'verification fixture (no OS keyring)' : 'operating system',
      screenshots: folder,
      ownerDataAccessed: false,
    }),
  );
} finally {
  if (application) {
    await application.evaluate(({ app }) => app.quit()).catch(() => {});
    await application.close().catch(() => {});
  }
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

// SPDX-License-Identifier: GPL-3.0-only
const messages = {
  idle: 'Check GitHub for a newer version of Capri.',
  checking: 'Checking for updates...',
  available: 'A new version is available.',
  current: 'No newer version is available on this channel.',
  downloading: 'Downloading update...',
  verifying: 'Verifying update...',
  ready: 'The update is ready to install.',
  installing: 'Preparing to restart Capri...',
  error: 'The update could not be completed.',
};
export class UpdatesPanel {
  constructor({ api, ui, onOpen, onError, deferDrafts = false }) {
    Object.assign(this, { api, ui, onOpen, onError, deferDrafts });
    this.panel = document.createElement('section');
    Object.assign(this.panel, {
      id: 'updates-panel',
      className: 'preferences-panel',
      hidden: true,
    });
    this.panel.dataset.panelCut = '12';
    this.panel.dataset.hitRegion = '';
    this.panel.setAttribute('aria-label', 'Updates');
    this.panel.innerHTML = `
      <div class="settings-heading"><h2>Updates</h2><button type="button" id="updates-close" aria-label="Close settings">×</button></div>
      <div class="preferences-content">
        <section class="settings-card" aria-labelledby="updates-installed-title">
          <div class="update-version"><h3 id="updates-installed-title">Installed version</h3><strong id="updates-current" data-untranslated></strong></div>
          <div class="update-status" role="status" aria-live="polite"><p id="updates-status"></p><strong id="updates-release" data-untranslated></strong><progress id="updates-progress" max="100" hidden></progress><p id="updates-transfer" data-untranslated></p><p id="updates-error"></p></div>
          <label class="update-channel"><input id="updates-automatic" type="checkbox" checked>Automatically check for updates</label>
          <div class="settings-actions"><button type="button" id="updates-check">Check for updates</button><button type="button" id="updates-download" hidden>Download update</button><button type="button" id="updates-cancel" hidden>Cancel download</button></div>
          <div class="settings-actions"><button type="button" id="updates-install" class="update-install" hidden>Restart and update</button></div>
          <p class="settings-help" id="updates-preserve">Your history, memory, models and personal settings are kept. Capri restarts only when you choose to install.</p>
          <p class="settings-help" id="updates-source" hidden>This is a development checkout. The downloaded installer creates or updates a separate managed installation.</p>
          <p class="settings-help" id="updates-full" hidden>The full installer will open; select your current installation folder to keep your data.</p>
          <p class="settings-help" id="updates-checkout" hidden>This is a source checkout. Update it with git pull, then restart Capri.</p>
          <p class="settings-help">Updates come from the CapriCore-Linux releases on GitHub.</p>
        </section>
        <section class="settings-card">
          <label class="update-channel"><input id="updates-experimental" type="checkbox">Include experimental updates</label>
          <p class="settings-help">Experimental versions may contain unfinished features and bugs. Stable updates are selected by default.</p>
        </section>
        <section class="settings-card">
          <h3>Release history</h3>
          <button id="updates-versions" type="button">Load versions</button>
          <label for="updates-version">Version</label><select id="updates-version" disabled></select>
          <pre id="updates-changelog" data-untranslated hidden></pre>
          <p id="updates-history-status" role="status"></p>
          <div class="settings-actions">
            <button id="updates-select" type="button" hidden>Choose this update</button>
            <button id="updates-release-page" type="button" hidden>Open on GitHub</button>
          </div>
        </section>
      </div>`;
    document.getElementById('companion').append(this.panel);
    this.get = (id) => this.panel.querySelector('#updates-' + id);
    let history = [];
    const selectedVersion = () => history.find(({ id }) => id === this.get('version').value);
    const showVersion = () => {
      const selected = selectedVersion();
      this.get('changelog').hidden = !selected;
      this.get('changelog').textContent = selected?.notes || this.ui.text('No release notes.');
      this.get('select').hidden = !selected?.update;
      this.get('release-page').hidden = !selected;
    };
    this.get('version').onchange = showVersion;
    this.get('versions').onclick = async () => {
      const load = this.get('versions');
      load.disabled = true;
      try {
        const result = await api.updateVersions(this.get('experimental').checked);
        history = result.releases;
        this.get('version').replaceChildren(
          ...history.map(({ id, tag, experimental }) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = experimental ? tag + ' · ' + this.ui.text('Experimental') : tag;
            return option;
          }),
        );
        this.get('version').disabled = !history.length;
        this.get('history-status').textContent = this.ui.text(
          history.length ? '' : 'No releases found.',
        );
        showVersion();
      } catch (error) {
        onError(error.message);
      } finally {
        load.disabled = false;
      }
    };
    this.get('select').onclick = async () => {
      try {
        this.show(await api.chooseUpdateVersion(selectedVersion()?.id));
      } catch (error) {
        onError(error.message);
      }
    };
    this.get('release-page').onclick = () =>
      api.openUpdateVersion(selectedVersion()?.id).catch((error) => onError(error.message));
    this.get('close').onclick = () => this.open(false);
    const changeSetting = async () => {
      if (this.deferDrafts) {
        this.show(this.value);
        return;
      }
      try {
        await this.saveSettings();
      } catch (error) {
        this.show(this.value, { resetSettings: true });
        onError(error.message);
      }
    };
    for (const id of ['automatic', 'experimental']) this.get(id).onchange = changeSetting;
    for (const [id, work] of [
      ['check', () => api.checkUpdates(this.settings())],
      ['download', () => api.downloadUpdate()],
      ['cancel', () => api.cancelUpdate()],
      ['install', () => api.installUpdate()],
    ])
      this.get(id).onclick = async () => {
        this.get(id).disabled = true;
        try {
          const result = await work();
          if (result && typeof result === 'object') this.show(result);
        } catch (error) {
          onError(error.message);
        } finally {
          if (this.value) this.show(this.value);
        }
      };
  }
  settings() {
    return {
      experimental: this.get('experimental').checked,
      automatic: this.get('automatic').checked,
    };
  }
  async saveSettings() {
    this.show(await this.api.setUpdateSettings(this.settings()), { resetSettings: true });
  }
  show(value, { resetSettings = false } = {}) {
    if (!value) return;
    for (const id of ['automatic', 'experimental']) {
      const input = this.get(id);
      const pending =
        this.deferDrafts && !resetSettings && this.value && input.checked !== this.value[id];
      if (!pending) input.checked = value[id];
    }
    this.value = value;
    const busy = ['checking', 'downloading', 'verifying', 'installing'].includes(value.phase);
    this.get('current').textContent = value.current;
    const currentChannel =
      value.checkedExperimental === undefined ||
      value.checkedExperimental === this.get('experimental').checked;
    this.get('status').textContent = this.ui.text(
      ((currentChannel || busy) && messages[value.phase]) || messages.idle,
    );
    this.get('release').textContent = currentChannel
      ? [value.release?.tag, value.release?.repository].filter(Boolean).join(' · ')
      : '';
    this.get('error').textContent = currentChannel && value.error ? this.ui.text(value.error) : '';
    this.get('check').disabled = busy;
    // A source checkout updates with git pull; Capri never replaces its files.
    this.get('download').hidden =
      value.mode === 'checkout' ||
      !currentChannel ||
      !value.release ||
      busy ||
      value.phase === 'ready';
    this.get('download').disabled = busy;
    this.get('cancel').hidden = !['checking', 'downloading'].includes(value.phase);
    this.get('cancel').disabled = false;
    this.get('install').hidden = !currentChannel || value.phase !== 'ready';
    this.get('install').disabled = busy;
    this.get('install').textContent = this.ui.text(
      value.mode === 'managed' && !value.installerRequired
        ? 'Restart and update'
        : 'Open installer',
    );
    this.get('source').hidden = value.mode !== 'installer';
    this.get('checkout').hidden = value.mode !== 'checkout';
    this.get('full').hidden = value.mode !== 'managed' || !value.installerRequired;
    this.get('preserve').hidden = value.mode !== 'managed';
    const progress = this.get('progress');
    progress.hidden = !busy;
    if (value.progress?.total)
      progress.value = (value.progress.received / value.progress.total) * 100;
    else progress.removeAttribute('value');
    this.get('transfer').textContent = value.progress
      ? `${(value.progress.received / 1048576).toFixed(1)} / ${(value.progress.total / 1048576).toFixed(1)} MB · ${(value.progress.bytesPerSecond / 1048576).toFixed(1)} MB/s`
      : '';
    this.syncAccessControls();
  }
  async open(open) {
    if ((await this.onOpen(open)) === false) return false;
    this.panel.hidden = !open;
    if (open) {
      this.show(await this.api.updateStatus());
      this.ui.apply(this.ui.language);
    }
    return true;
  }
  syncAccessControls() {
    const busy = ['checking', 'downloading', 'verifying', 'installing'].includes(this.value?.phase);
    for (const id of ['check', 'automatic', 'experimental', 'download', 'install'])
      this.get(id).disabled = busy;
  }
}

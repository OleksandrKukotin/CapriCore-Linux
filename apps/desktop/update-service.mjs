// SPDX-License-Identifier: GPL-3.0-only
import {
  existsSync,
  readFileSync,
  mkdirSync,
  mkdtempSync,
  copyFileSync,
  writeFileSync,
  appendFileSync,
  openSync,
  closeSync,
} from 'node:fs';
import path from 'node:path';
import { Preferences } from './preferences.mjs';
import { writeJsonAtomic } from './storage.mjs';
import { noLinks } from '../../packages/installer/src/policy.mjs';
import {
  installedUpdateVersion,
  managedInstallation,
} from '../../packages/updater/src/transaction.mjs';
import { listUpdateReleases, githubCredential } from '../../packages/updater/src/github.mjs';
import { gitlabReleaseUrl } from '../../packages/updater/src/gitlab.mjs';
import {
  EXPERIMENTAL_REPOSITORY,
  REPOSITORY,
  compareVersions,
  selectRelease,
  releaseAsset,
  releaseVersion,
  parseVersion,
} from '../../packages/updater/src/releases.mjs';
import { platformUnavailable } from '../../packages/runtime/src/host/platform.mjs';

function isExperimentalRelease(release) {
  // A private preview can be marked Latest on GitHub only as a regular release.
  try {
    return parseVersion(release.tag_name).pre.length > 0 || release.prerelease === true;
  } catch {
    return false;
  }
}

const privateAccessMessage =
  'GitHub access is unavailable for this private repository. Connect GitHub in Updates and check your Capri invitation and token approval.';
const automaticCheckInterval = 30 * 60_000;

export function validateUpdateSettings(value, automaticDefault = true) {
  if (
    !value ||
    typeof value.experimental !== 'boolean' ||
    (Object.hasOwn(value, 'automatic') && typeof value.automatic !== 'boolean') ||
    Object.keys(value).some((key) => key !== 'experimental' && key !== 'automatic')
  )
    throw new Error('Invalid update settings');
  return { experimental: value.experimental, automatic: value.automatic ?? automaticDefault };
}
/** Download work does not block inference. Only an explicit install request closes Capri. */
export class UpdateService {
  constructor({
    root,
    state,
    node,
    emit = () => {},
    credential = githubCredential,
    releases = listUpdateReleases,
    startupTimeoutMs = 15000,
  }) {
    Object.assign(this, {
      root,
      node,
      emit,
      credential,
      releases,
      startupTimeoutMs,
    });
    this.preferences = new Preferences(
      path.join(state, 'updates.json'),
      { experimental: false, automatic: true },
      validateUpdateSettings,
    );
    const metadata = JSON.parse(readFileSync(path.join(root, 'config/release.json'), 'utf8'));
    parseVersion(metadata.tag);
    this.current = installedUpdateVersion(root, metadata.tag);
    this.mode = 'installer';
    try {
      managedInstallation(root);
      this.mode = 'managed';
    } catch {
      /* A source checkout is never overwritten by the updater. */
    }
    this.value = {
      phase: 'idle',
      current: this.current,
      mode: this.mode,
      ...this.preferences.snapshot(),
      notification: null,
    };
    this.selected = null;
    this.prepared = null;
    this.controller = null;
    this.handoff = false;
    this.automaticController = null;
    this.automaticOperation = null;
    this.automaticChecksStarted = false;
    this.automaticTimer = null;
    this.startupAttempted = false;
    this.startupSuperseded = false;
    this.deferredTags = new Set();
    this.closed = false;
  }
  snapshot() {
    return structuredClone(this.value);
  }
  publish(patch) {
    Object.assign(this.value, patch);
    this.emit({ type: 'updates.status', ...this.snapshot() });
    return this.snapshot();
  }
  busy() {
    return (
      Boolean(this.installOperation) ||
      ['checking', 'downloading', 'verifying', 'installing'].includes(this.value.phase)
    );
  }
  cancelAutomaticCheck() {
    this.startupSuperseded = true;
    this.automaticController?.abort(new Error('Automatic update check cancelled'));
  }
  startAutomaticChecks() {
    if (this.closed || this.automaticChecksStarted) return;
    this.automaticChecksStarted = true;
    this.syncAutomaticCheckTimer();
    return this.checkOnStartup();
  }
  syncAutomaticCheckTimer() {
    if (this.closed || !this.preferences.value.automatic) {
      clearInterval(this.automaticTimer);
      this.automaticTimer = null;
    } else if (this.automaticChecksStarted && !this.automaticTimer) {
      this.automaticTimer = setInterval(
        () => void this.checkAutomatically(),
        automaticCheckInterval,
      );
      this.automaticTimer.unref?.();
    }
  }
  async optionalCredential() {
    try {
      const token = await this.credential(this.root);
      return typeof token === 'string' && token && !/[\x00-\x20\x7f]/.test(token) ? token : null;
    } catch {
      // Public updates still work if a saved private-preview credential cannot be decrypted.
      // Leave encrypted storage intact so its owner can reconnect or remove it in Settings.
      return null;
    }
  }
  async findRelease(experimental, signal, { reportPrivateFailure = false } = {}) {
    const token = await this.optionalCredential();
    signal.throwIfAborted();
    const selection = {
      current: this.current,
      experimental,
      kind: this.mode === 'managed' ? 'source' : 'installer',
    };
    const publicReleases = this.releases({ token, signal, allowAnonymousFallback: true });
    const selectPublic = (items) => {
      const release = selectRelease(items, selection);
      return release && { ...release, repository: REPOSITORY };
    };
    if (!experimental || !token) {
      const release = selectPublic(await publicReleases);
      if (experimental && !token && !release && reportPrivateFailure)
        throw Object.assign(new Error(privateAccessMessage), { code: 'GITHUB_ACCESS_REQUIRED' });
      return release;
    }

    const previewSignal = AbortSignal.any([signal, AbortSignal.timeout(8000)]);
    const [publicResult, previewResult] = await Promise.allSettled([
      publicReleases,
      this.releases({ token, signal: previewSignal, repository: EXPERIMENTAL_REPOSITORY }),
    ]);
    signal.throwIfAborted();
    const publicRelease =
      publicResult.status === 'fulfilled' ? selectPublic(publicResult.value) : null;
    const previewRelease =
      previewResult.status === 'fulfilled'
        ? selectRelease(previewResult.value.filter(isExperimentalRelease), {
            ...selection,
            repository: EXPERIMENTAL_REPOSITORY,
          })
        : null;
    if (
      previewRelease &&
      (!publicRelease ||
        compareVersions(
          releaseVersion(previewRelease, EXPERIMENTAL_REPOSITORY),
          publicRelease.tag_name,
        ) > 0)
    )
      return { ...previewRelease, repository: EXPERIMENTAL_REPOSITORY };
    if (publicResult.status === 'rejected') throw publicResult.reason;
    if (reportPrivateFailure && !publicRelease && previewResult.status === 'rejected') {
      if (previewResult.reason?.code === 'GITHUB_ACCESS_REQUIRED') throw previewResult.reason;
      throw new Error('GitHub update check failed. Try again.');
    }
    return publicRelease;
  }
  checkOnStartup() {
    if (this.startupAttempted) return this.automaticOperation ?? Promise.resolve(this.snapshot());
    this.startupAttempted = true;
    if (this.startupSuperseded || this.value.phase !== 'idle')
      return Promise.resolve(this.snapshot());
    return this.checkAutomatically();
  }
  checkAutomatically() {
    if (
      this.closed ||
      !this.preferences.value.automatic ||
      this.busy() ||
      this.value.phase === 'ready'
    )
      return Promise.resolve(this.snapshot());
    if (this.automaticOperation) return this.automaticOperation;
    const controller = new AbortController();
    this.automaticController = controller;
    const experimental = this.preferences.value.experimental;
    let onAbort;
    const cancelled = new Promise((_, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    const timer = setTimeout(
      () => controller.abort(new Error('Automatic update check timed out')),
      this.startupTimeoutMs,
    );
    timer.unref?.();
    const probe = async () => {
      const selected = await this.findRelease(experimental, controller.signal);
      controller.signal.throwIfAborted();
      if (!selected) return this.snapshot();
      if (
        this.selected &&
        this.value.checkedExperimental === experimental &&
        compareVersions(releaseVersion(selected), releaseVersion(this.selected)) <= 0
      )
        return this.snapshot();
      this.selected = selected;
      this.prepared = null;
      return this.publish({
        phase: 'available',
        release: this.describeRelease(selected),
        error: null,
        progress: null,
        installerRequired: false,
        installerReason: null,
        needsAccess: false,
        checkedExperimental: experimental,
        notification: this.deferredTags.has(selected.tag_name) ? null : { tag: selected.tag_name },
      });
    };
    this.automaticOperation = Promise.race([probe(), cancelled])
      .catch(() => this.snapshot())
      .finally(() => {
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', onAbort);
        this.automaticController = null;
        this.automaticOperation = null;
      });
    return this.automaticOperation;
  }
  describeRelease(selected) {
    return {
      tag: selected.tag_name,
      experimental: isExperimentalRelease(selected),
      bytes: releaseAsset(selected, this.mode === 'managed' ? 'source' : 'installer').bytes,
      ...(selected.repository === EXPERIMENTAL_REPOSITORY
        ? { repository: EXPERIMENTAL_REPOSITORY }
        : {}),
    };
  }
  async history(experimental = false) {
    if (typeof experimental !== 'boolean') throw new Error('Invalid update channel.');
    const token = await this.optionalCredential();
    const signal = AbortSignal.timeout(20000);
    const publicRequest = this.releases({ token, signal, allowAnonymousFallback: true });
    const previewRequest =
      experimental && token
        ? this.releases({ token, signal, repository: EXPERIMENTAL_REPOSITORY })
        : Promise.resolve(null);
    const [publicResult, previewResult] = await Promise.allSettled([publicRequest, previewRequest]);
    if (publicResult.status === 'rejected') throw publicResult.reason;
    const entries = new Map();
    const add = (items, repository) => {
      for (const release of items) {
        try {
          const prerelease = isExperimentalRelease(release);
          if (release.draft || (repository === EXPERIMENTAL_REPOSITORY && !prerelease)) continue;
          if (prerelease && !experimental) continue;
          const id = repository + '@' + release.tag_name;
          entries.set(id, {
            release: { ...release, repository },
            view: {
              id,
              tag: release.tag_name,
              experimental: prerelease,
              notes: typeof release.body === 'string' ? release.body.slice(0, 12000) : '',
              update:
                compareVersions(releaseVersion(release, repository), this.current) > 0 &&
                Boolean(releaseAsset(release, this.mode === 'managed' ? 'source' : 'installer')),
            },
          });
        } catch {
          // Ignore releases without a compatible version tag.
        }
      }
    };
    add(publicResult.value, REPOSITORY);
    if (previewResult.status === 'fulfilled' && previewResult.value)
      add(previewResult.value, EXPERIMENTAL_REPOSITORY);
    this.historyEntries = entries;
    this.historyExperimental = experimental;
    return {
      releases: [...entries.values()]
        .sort((a, b) => compareVersions(releaseVersion(b.release), releaseVersion(a.release)))
        .map(({ view }) => view),
      previewUnavailable:
        experimental && (previewResult.status === 'rejected' || !previewResult.value),
    };
  }
  historyUrl(id) {
    const entry = this.historyEntries?.get(id);
    if (!entry) throw new Error('Load release history and choose a version.');
    if (entry.release.downloadSource === 'gitlab') return gitlabReleaseUrl(entry.release.tag_name);
    return (
      'https://github.com/' +
      entry.release.repository +
      '/releases/tag/' +
      encodeURIComponent(entry.release.tag_name)
    );
  }
  async chooseHistory(id) {
    const entry = this.historyEntries?.get(id);
    if (!entry?.view.update) throw new Error('This version is not available as an in-app update.');
    if (this.busy()) throw new Error('Wait for the update operation to finish.');
    if (entry.release.repository === EXPERIMENTAL_REPOSITORY && !(await this.optionalCredential()))
      throw new Error('Connect GitHub to access private preview versions.');
    if (this.busy()) throw new Error('Wait for the update operation to finish.');
    this.cancelAutomaticCheck();
    this.selected = entry.release;
    this.prepared = null;
    return this.publish({
      phase: 'available',
      release: this.describeRelease(entry.release),
      checkedExperimental: this.historyExperimental,
      error: null,
      progress: null,
      installerRequired: false,
      installerReason: null,
      needsAccess: false,
      notification: null,
    });
  }
  remindLater() {
    if (this.value.notification) this.deferredTags.add(this.value.notification.tag);
    this.cancelAutomaticCheck();
    return this.publish({ notification: null });
  }
  setSettings(value) {
    if (this.busy()) throw new Error('Wait for the update operation to finish.');
    const previous = this.preferences.value;
    const settings = this.preferences.set(validateUpdateSettings(value, previous.automatic));
    const channelChanged = settings.experimental !== previous.experimental;
    const automaticChanged = settings.automatic !== previous.automatic;
    if (channelChanged || automaticChanged) this.cancelAutomaticCheck();
    this.syncAutomaticCheckTimer();
    const patch = { ...settings };
    if (!settings.automatic) patch.notification = null;
    if (channelChanged && settings.experimental !== this.value.checkedExperimental) {
      this.selected = null;
      this.prepared = null;
      Object.assign(patch, {
        phase: 'idle',
        release: null,
        progress: null,
        error: null,
        installerRequired: false,
        installerReason: null,
        needsAccess: false,
        checkedExperimental: undefined,
        notification: null,
      });
    }
    const snapshot = this.publish(patch);
    if (automaticChanged && settings.automatic && this.automaticChecksStarted)
      void Promise.resolve(this.automaticOperation).then(() => this.checkAutomatically());
    return snapshot;
  }
  async check(value) {
    this.cancelAutomaticCheck();
    const experimental =
      value === undefined
        ? this.preferences.value.experimental
        : validateUpdateSettings(value).experimental;
    if (this.busy()) return this.snapshot();
    this.controller = new AbortController();
    this.publish({
      phase: 'checking',
      error: null,
      release: null,
      progress: null,
      installerRequired: false,
      installerReason: null,
      needsAccess: false,
      checkedExperimental: experimental,
      notification: null,
    });
    this.prepared = null;
    this.selected = null;
    try {
      const selected = await this.findRelease(experimental, this.controller.signal, {
        reportPrivateFailure: true,
      });
      this.controller.signal.throwIfAborted();
      this.selected = selected;
      return this.publish({
        phase: this.selected ? 'available' : 'current',
        release: this.selected ? this.describeRelease(this.selected) : null,
      });
    } catch (error) {
      return this.publish({
        phase: this.controller.signal.aborted ? 'idle' : 'error',
        error: this.controller.signal.aborted ? null : error.message,
        needsAccess: !this.controller.signal.aborted && error.code === 'GITHUB_ACCESS_REQUIRED',
      });
    } finally {
      this.controller = null;
    }
  }
  async prepare() {
    this.cancelAutomaticCheck();
    if (!this.selected) throw new Error('Check for updates first.');
    // Windows releases were staged and applied by a separate update host. A Linux
    // source checkout updates with `git pull`; packaged builds will use their channel.
    throw platformUnavailable('In-app update installation');
  }
  cancel() {
    this.cancelAutomaticCheck();
    this.controller?.abort(new Error('Update cancelled'));
    return this.snapshot();
  }
  async install({ parentPid, language, shutdown }) {
    this.cancelAutomaticCheck();
    if (this.busy() || this.installOperation) return false;
    if (!this.prepared || this.value.phase !== 'ready')
      throw new Error('Download the update first.');
    this.installOperation = true;
    this.publish({ phase: 'installing', error: null });
    try {
      return await this.performInstall({ parentPid, language, shutdown });
    } catch (error) {
      this.publish({ phase: 'ready', error: error.message });
      throw error;
    } finally {
      this.installOperation = false;
      if (!this.handoff) this.publish({ phase: 'ready' });
    }
  }
  async performInstall({ parentPid, language, shutdown }) {
    throw platformUnavailable('In-app update installation');
  }
  close() {
    this.closed = true;
    this.syncAutomaticCheckTimer();
    this.cancelAutomaticCheck();
    if (!this.handoff) this.cancel();
  }
}

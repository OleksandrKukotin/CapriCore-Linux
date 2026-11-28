// SPDX-License-Identifier: GPL-3.0-only

/** Electron safeStorage behind a promise API; Linux's plain-text fallback counts as unavailable. */
export function credentialStorage(safeStorage, platform = process.platform) {
  return {
    available: async () => {
      const available = safeStorage.isAsyncEncryptionAvailable
        ? await safeStorage.isAsyncEncryptionAvailable()
        : safeStorage.isEncryptionAvailable();
      return (
        available &&
        !(platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text')
      );
    },
    encrypt: (value) =>
      safeStorage.encryptStringAsync
        ? safeStorage.encryptStringAsync(value)
        : Promise.resolve(safeStorage.encryptString(value)),
    decrypt: (value) =>
      safeStorage.decryptStringAsync
        ? safeStorage.decryptStringAsync(value)
        : Promise.resolve(safeStorage.decryptString(value)),
  };
}

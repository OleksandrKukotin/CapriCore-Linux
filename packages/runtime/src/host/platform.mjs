// SPDX-License-Identifier: GPL-3.0-only
// Features whose only backend was a Windows helper. Each keeps its platform-neutral
// JS; the native side reports this error until a Linux backend exists. See
// docs/linux/windows-heritage.md for the replacement mechanism of each feature.

export const PLATFORM_UNAVAILABLE = 'CAPRI_PLATFORM_UNAVAILABLE';

export function platformUnavailable(feature) {
  return Object.assign(new Error(`${feature} is not available on Linux yet.`), {
    code: PLATFORM_UNAVAILABLE,
    feature,
  });
}

export const isPlatformUnavailable = (error) => error?.code === PLATFORM_UNAVAILABLE;

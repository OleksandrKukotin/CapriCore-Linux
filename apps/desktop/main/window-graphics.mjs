// SPDX-License-Identifier: GPL-3.0-only
import { readFileSync } from 'node:fs';
import { writeJsonAtomic } from '../../../packages/runtime/src/atomic-json.mjs';

export function softwareRenderingRequested(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))?.softwareRendering === true;
  } catch {
    return false;
  }
}

export function saveSoftwareRendering(file, softwareRendering) {
  writeJsonAtomic(file, { softwareRendering });
}

export function configureWindowGraphics(app, file) {
  const softwareRendering = softwareRenderingRequested(file);
  if (softwareRendering) app.disableHardwareAcceleration();
  return { softwareRendering };
}

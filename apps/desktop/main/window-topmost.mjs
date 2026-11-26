// SPDX-License-Identifier: GPL-3.0-only
/** Ordinary pinned UI. Special avatar/indicator layers keep their own policies.
 * This never changes focus or position. */
export function setWindowAlwaysOnTop(view, value) {
  view.setAlwaysOnTop(value);
}

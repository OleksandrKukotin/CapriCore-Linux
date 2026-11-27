// SPDX-License-Identifier: GPL-3.0-only
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PROJECT = 'https://github.com/OleksandrKukotin/CapriCore-Linux';

// Renderer requests identifiers, never arbitrary URLs. Discord presence uses the
// same table, so a changed destination cannot leave an old button behind.
export const COMMUNITY_LINKS = Object.freeze({
  github: PROJECT,
  releases: PROJECT + '/releases/latest',
  issues: PROJECT + '/issues/new/choose',
  'issue-list': PROJECT + '/issues',
});

export function loadCommunityLinks(root) {
  try {
    const value = JSON.parse(readFileSync(path.join(root, 'config/community.json'), 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return COMMUNITY_LINKS;
    const links = Object.fromEntries(
      Object.entries(COMMUNITY_LINKS).map(([id, fallback]) => [
        id,
        Object.hasOwn(value, id) ? value[id] : fallback,
      ]),
    );
    for (const destination of Object.values(links)) {
      if (typeof destination !== 'string') return COMMUNITY_LINKS;
      const url = new URL(destination);
      // A maintainer may move the project, but only within GitHub over HTTPS.
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.origin !== 'https://github.com'
      )
        return COMMUNITY_LINKS;
    }
    return Object.freeze(links);
  } catch {
    // A missing or malformed configuration keeps the built-in links.
    return COMMUNITY_LINKS;
  }
}

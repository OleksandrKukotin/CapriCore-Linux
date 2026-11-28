// SPDX-License-Identifier: GPL-3.0-only

function step(target, title, text, help, spotlight) {
  return [
    target,
    [title, text],
    ...(help || spotlight
      ? [{ ...(help ? { help } : {}), ...(spotlight ? { spotlight } : {}) }]
      : []),
  ];
}

export const advancedGuides = {
  computer: [
    step(
      '#computer-access-toggle',
      'Grant or revoke full access',
      'Full access lets Capri open apps, enter text in inspected fields and use extra folders without asking each time. Revoking it returns Capri to your individual app and folder grants.',
    ),
    step(
      '#computer-access-resume',
      'Resume access to applications',
      'A paused Application access setting also blocks app actions. Resume it here. Full computer access still requires separate confirmation.',
    ),
  ],
  files: [
    step(
      '#file-access-add',
      'Share the folder you need',
      'Additional folders start read-only. Capri can list files, find them by name and read text. Protected system folders, network shares and linked paths are outside the supported scope.',
    ),
    step(
      '#file-access-list .file-scope input[type="checkbox"]',
      'Enable writing for a specific folder',
      'Allow file changes to create, copy, move or rename files in that folder. The Capri installation folder starts with write access. Replacing text or sending a file to the Recycle Bin needs separate confirmation.',
    ),
    step(
      '#file-access-clear',
      'Revoke folder permissions',
      'Use the button beside a folder to revoke that grant. Revoke all access clears every shared folder.',
      '#file-access-list .file-scope button.danger-action',
    ),
    step(
      '#file-recovery-refresh',
      'Find and restore a recovery copy',
      'Refresh lists available copies. Restoring needs current write access to the original folder and an unused target name. Delete permanently removes the recovery copy.',
      '#file-access-panel details:has(#file-recovery-refresh) > summary, #file-recovery-list .settings-actions button',
    ),
  ],
  knowledge: [
    step(
      '#brain-folder',
      'Add documents to the Brain folder',
      'Add TXT, Markdown, DOCX, ODT or text-based PDF files. For scans, recognize the text first. Refresh the index after adding or editing files.',
      '#brain-refresh',
    ),
    step(
      '#brain-enabled',
      'Use local knowledge in replies',
      'Capri searches the index on this computer and uses relevant excerpts when answering.',
    ),
    step(
      '#brain-api',
      'Allow excerpts to go to an external provider',
      'Turn this on if the selected external model may receive relevant Brain excerpts with a request. Keep it off for documents that should stay local.',
    ),
    step(
      '#brain-query',
      'Test the search',
      'Enter a term, title or question. Results show the source, page and excerpt. If a document is missing, refresh the index and check whether you can select text in the original.',
      '#brain-search',
    ),
  ],
  'private-memory': [
    step(
      '#private-password',
      'Create or unlock the encrypted store',
      'The first password creates an encrypted store on this PC. Use at least eight characters. Enter the same password to unlock it later. A forgotten password cannot be recovered.',
      '#private-unlock',
    ),
    step(
      '#private-lock',
      'Lock private memory',
      'Lock when you finish. Capri also locks after five minutes of inactivity or when Settings closes. Private replies clear when it locks.',
    ),
    step(
      '#private-note',
      'Save or remove a private note',
      'Saved notes are available in private conversation. Use Remove beside a note when it is no longer needed.',
      '#private-save, #private-notes li button',
    ),
    step(
      '#private-message',
      'Send a private message',
      'This conversation bypasses ordinary history and tools. The reply appears only in this window.',
      '#private-send',
    ),
    step(
      '#private-api',
      'Allow the selected external API',
      'With an external model selected, this permits the provider to receive the message, saved private notes and recent messages from this private session.',
    ),
    step(
      '#private-new-password',
      'Change your password',
      'Unlock the store, enter the current password and a new password of at least eight characters, then select Change password.',
      '#private-current-password, #private-change-password',
    ),
  ],
  'user-tools': [
    step(
      '#user-tools-folder',
      'Add or discover a tool',
      'Put each tool in its own subfolder with manifest.json and its code. Refresh tools to discover it. Discovery reads definitions without running code.',
      '#user-tools-refresh',
    ),
    step(
      '#user-tools-example',
      'Create a sample tool',
      'This adds a disabled Node example to the tools folder. Inspect it there before enabling or testing it.',
    ),
    step(
      '#user-tools-list .settings-card button[aria-pressed]',
      'Review and enable a tool',
      'Review its code, network and file permissions, and timeout. On Windows, enabled tools run in an AppContainer with restricted access. Changed code requires approval again. Use the same button to disable a tool.',
    ),
    step(
      '#user-tools-list .settings-card .settings-actions button',
      'Open or remove an individual tool',
      'Open tool folder to inspect its files. Delete removes the tool from the list and its managed files.',
    ),
    step(
      '#user-tools-list .settings-card details summary',
      'Change the tool name or description',
      'Open Edit tool details, enter a name and description, then save.',
      '#user-tools-list .settings-card details :is(input, textarea, button)',
    ),
    step(
      '#user-tools-list .settings-card input[type="password"]',
      'Store private tool settings',
      'Enter a JSON object with string values and encrypt it. These values stay out of model context but are available to the approved tool.',
      '#user-tools-list [data-guide-user-tool="secrets"]',
    ),
    step(
      '#user-tools-list .settings-card textarea:not(details textarea)',
      'Test an enabled tool',
      'Set parameters that match the manifest. Choose input files when the option is available. It grants temporary copies of the selected files. The test shows the returned JSON.',
      '#user-tools-list :is([data-guide-user-tool="inputs"], [data-guide-user-tool="test"])',
    ),
    step(
      '#user-tools-stop',
      'Stop running tools',
      'This cancels active tool runs. Enabled tools can be called by a model with tool support. Context scripts can also run on their configured keywords. Disable a tool to prevent future runs.',
    ),
  ],
  updates: [
    step(
      '#updates-automatic',
      'Automatically check for updates',
      'Capri checks every 30 minutes while it is running and notifies you when an update is available.',
    ),
    step(
      '#updates-check',
      'Check for a release',
      'Check compares the installed version with the selected update channel. Capri restarts only when you choose to install.',
    ),
    step(
      '#updates-download',
      'Download the selected update',
      'Download prepares the update for installation. Cancel stops the download.',
      '#updates-cancel',
    ),
    step(
      '#updates-install',
      'Install the downloaded update',
      'This restarts Capri and keeps history, memory, models and personal settings. If the full installer opens, choose the current installation folder. From source, the installer updates a separate managed installation.',
    ),
    step(
      '#updates-versions',
      'Load the list of releases',
      'Load versions lists the releases available to your update channel.',
    ),
    step(
      '#updates-version',
      'Read release notes or select an update',
      'Select a version to see its notes. Open on GitHub shows the release page. If Choose this update is available, it puts that release in the download card.',
      '#updates-select, #updates-release-page',
    ),
    step(
      '#updates-experimental',
      'Include experimental builds',
      'Stable builds are selected by default. Experimental builds can contain unfinished features; they are GitHub pre-releases of this project. Save Settings to keep the channel.',
    ),
  ],
  bug: [
    step(
      '#bug-category',
      'Choose the relevant problem area',
      'Report one issue at a time. Choose the area where it occurs so the maintainer can route it.',
    ),
    step(
      '#bug-title',
      'Use a clear title and description',
      'Use a short title. In the description, include the Capri version, the exact error and how often it happens. Leave out passwords and keys.',
      '#bug-description',
    ),
    step(
      '#bug-steps',
      'Show how to reproduce the issue',
      'List the clicks or prompts in order. Say what should have happened under Expected result and what actually appeared under Actual result.',
      '#bug-expected, #bug-actual',
    ),
    step(
      '#bug-logs',
      'Choose whether to include diagnostic logs',
      'Recent logs contain technical context. The report excludes chat history files, memory, recordings and screenshots. Known secrets and common personal paths are redacted.',
    ),
    step(
      '#bug-save',
      'Save a local report for review',
      'The report is saved as a ZIP on this computer. You can review it before sharing. Open GitHub issues to look for public reports of the same problem.',
      '[data-companion-tab="bug"] [data-community="issues"]',
    ),
  ],
  credits: [
    step(
      '#credits-panel .credits-hero h3',
      'Meet the team and contributors',
      'These cards recognize the team, major supporters and community helpers.',
      undefined,
      '#credits-panel .credits-hero',
    ),
    step(
      '#credits-team-title',
      'Meet the Capri team',
      'This card introduces the people who develop and support Capri.',
      undefined,
      '#credits-panel .credits-team-section',
    ),
    step(
      '#credits-major-title',
      'Meet the major supporters',
      'This card recognizes people who have given major support to Capri.',
      undefined,
      '#credits-panel [aria-labelledby="credits-major-title"]',
    ),
    step(
      '#credits-helpers-title',
      'Meet the community helpers',
      'This card recognizes people who help the Capri community.',
      undefined,
      '#credits-panel [aria-labelledby="credits-helpers-title"]',
    ),
    step(
      '#credits-supporters-title',
      'Find an early access supporter',
      'Search by part or all of a nickname. Clear the field to show the full list. If it failed to load, use Try again.',
      '#credits-search, #credits-retry',
      '#credits-panel .credits-supporters-section',
    ),
  ],
  developer: [
    step(
      '#developer-refresh-card',
      'Collect a recent timing sample',
      'Send a message, then refresh this tab. Live refresh updates the counters while this tab is visible. Turn it off to inspect a fixed sample.',
      '#developer-refresh, #developer-live',
      '#developer-refresh-card',
    ),
    step(
      '#developer-panel [aria-labelledby="developer-timing-title"]',
      'Inspect response timing',
      'Choose a recent request to compare the first reply text, its appearance on screen and completion. Stages can overlap, and a dash means data is unavailable. Model calls show available provider timings. Copy the summary without chat content or keys, or expand All timing events to inspect their order.',
      '#developer-turn, #developer-copy-turn, #developer-turn-details details summary',
      '#developer-panel [aria-labelledby="developer-timing-title"]',
    ),
    step(
      '#developer-panel [aria-labelledby="developer-logs-title"]',
      'Read a technical log',
      'Select a file to see its most recent entries. The view filters private text and unknown fields. Original log files may contain information to review before sharing.',
      '#developer-log, #developer-folder',
      '#developer-panel [aria-labelledby="developer-logs-title"]',
    ),
  ],
};

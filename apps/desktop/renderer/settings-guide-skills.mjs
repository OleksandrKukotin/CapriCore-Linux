// SPDX-License-Identifier: GPL-3.0-only

function step(target, title, text, help) {
  const copy = [target, [title, text]];
  return help ? [...copy, { help }] : copy;
}

export const skillGuides = {
  dialogue: [
    step(
      '#memory-view',
      'Open saved memories',
      'Find the facts you have saved by asking Capri to remember something or by adding a note here. Private memory is a separate vault.',
    ),
    step(
      '#saved-memory-new',
      'Save a useful fact',
      'Write one specific fact. For example, “I prefer short answers.” Save it so Capri can recall it in later chats.',
      '#saved-memory-add, #saved-memory-cancel',
    ),
    step(
      '#saved-memory-search',
      'Find or update a saved fact',
      'Search the list, then edit or delete the matching entry. Refresh reloads the list.',
      '#saved-memory-refresh, #saved-memory-list button',
    ),
    step(
      '#memory-automatic',
      'Choose what Capri remembers on her own',
      'With automatic saving on, the active model can extract preferences after replying. Turn it off to keep saving deliberate.',
    ),
    step(
      '#context-clear',
      'Start a fresh conversation',
      'Confirm to clear the current conversation. Capri can still recall saved facts.',
    ),
    step(
      '#memory-clear',
      'Erase long-term memory',
      'Confirm to remove all saved facts. The current conversation remains available. To delete one fact, use the saved memories list.',
    ),
  ],
  attachments: [
    step(
      '#attachments-panel h3',
      'Check which formats the current model can read',
      'Attach a file with the paperclip, drag it into the message box or paste it. The list below reflects the active model’s capabilities.',
    ),
    step(
      '#attachments-panel dt:first-of-type',
      'Choose a readable document',
      'Capri extracts document text. If the PDF is an image-only scan, attach the relevant page as an image or paste a text excerpt.',
    ),
    step(
      '#attachment-format-images',
      'Use a model that can see images',
      'A vision-capable model is required. The parts used in a cloud request go to the active provider.',
    ),
    step(
      '#attachment-format-frames',
      'Share relevant frames',
      'Capri samples visual frames from supported GIFs and videos. For exact detail, attach the individual frame.',
    ),
  ],
  time: [
    step(
      '#time-kind',
      'Pick a timer, reminder or stopwatch',
      'A timer counts down. A reminder displays your message when it is due. A stopwatch starts at zero and counts up.',
    ),
    step(
      '#time-duration',
      'Set the duration',
      'Scroll or drag the wheels, use the arrow keys or type a value. A quick preset fills all three fields at once.',
      '#time-hours, #time-minutes, #time-seconds, #time-presets',
    ),
    step(
      '#time-title',
      'Name the timer or write the reminder',
      'The title identifies the timer in the active list. For a reminder, enter the message you want to receive.',
    ),
    step(
      '#time-create',
      'Start the selected item',
      'Start adds the item to Active. You can also ask Capri to remind you, for example in 15 minutes.',
    ),
    step(
      '#active-timers-title',
      'Manage active items',
      'Pause or resume a countdown or stopwatch, pin a stopwatch, or snooze a due alert for five minutes. Items survive restart. Keep Capri running for timely alerts.',
      '#time-list',
    ),
    step(
      '#companion-reminder-wake',
      'Let an alert wake Capri',
      'Capri can wake and prepare her voice while the app is running. Windows and the microphone stay as they are. A muted voice keeps the reminder text-only.',
    ),
  ],
  screen: [
    step(
      '#screen-source',
      'Choose what to share',
      'Select a specific window, a monitor or all monitors. A single window limits what Capri can see. Refresh the list if the source is missing.',
      '#screen-refresh',
    ),
    step(
      '#screen-capture',
      'Take one screenshot',
      'Capture the chosen view and check the preview. Only the selected area is included.',
      '#screen-preview',
    ),
    step(
      '#screen-question',
      'Ask about the captured view',
      'Start a normal chat first, then ask about the screenshot. A local vision model processes the image and discards it. The question and text answer remain in history.',
      '#screen-ask',
    ),
    step(
      '#screen-watch-start',
      'Start observing the selected view',
      'Observation can continue after you close Settings. Hiding Capri, locking Windows or reaching the time limit ends the session.',
      '#screen-observation-title',
    ),
    step(
      '#screen-watch-stop',
      'End observation',
      'Use this button or the OBS indicator to revoke sharing. Start a new session yourself when you want to share again.',
      '#screen-watch-unlock',
    ),
    step(
      '#screen-watch-interval',
      'Set the minimum time between analyses',
      'Use 15–300 seconds. Capri checks changed views while idle. A recent description can join your next message. Increase the interval if analysis slows replies.',
    ),
    step(
      '#screen-watch-duration',
      'Set when sharing expires',
      'Observation lasts 0.5–120 minutes. Stop the active session before changing either timing setting.',
    ),
  ],
  applications: [
    step(
      '#installed-app-query',
      'Search for an installed application',
      'Enter the application’s name and search. A launch permission lets Capri open that application by the name shown in the results.',
      '#installed-app-search, #installed-app-results button',
    ),
    step(
      '#application-notepad',
      'Grant limited access to Notepad',
      'This grant opens or focuses a Notepad window and lets Capri inspect accessible controls. Editing and saving require separate capabilities.',
      '#application-notepad-label',
    ),
    step(
      '#catalog-add',
      'Add a custom application',
      'If search misses an app, choose its local executable. The app’s card appears below with separate permissions for launch, inspection and text entry.',
      '#catalog-heading',
    ),
    step(
      '#catalog-list input[type="checkbox"]',
      'Review or revoke individual permissions',
      'Inspection can expose private text in window controls. Confirmed text entry needs a fresh inspection and your approval. Clear a permission or remove an app to revoke access.',
      '#catalog-list button',
    ),
    step(
      '#catalog-journal-refresh',
      'Review recent application actions',
      'Refresh the action journal to see what ran. Stopping a task cancels remaining steps, while completed actions stay in effect.',
      '#catalog-journal',
    ),
  ],
  calculator: [
    step(
      '#skill-settings-title',
      'Calculate an expression in chat',
      'Enable the skill and ask “Calculate (3 + 5) × 2”. Parentheses help make the order explicit.',
    ),
    step(
      '#calculator-show-window',
      'Show calculations in Windows Calculator',
      'For supported operations, Capri opens the Windows app and enters the calculation. The exact support depends on your Calculator app.',
    ),
  ],
  spotify: [
    step(
      '#spotify-access',
      'Connect the Spotify desktop app',
      'Sign in to Spotify itself first. Connect or disconnect locally here. Changing access restarts Capri.',
      '#spotify-title',
    ),
    step(
      '#spotify-check',
      'Verify the Spotify connection',
      'Open Spotify and check the connection. Capri can search music and control Spotify’s playback, queue and app volume.',
    ),
    step(
      '#spotify-repair',
      'Repair a missing connection',
      'If offered, use Repair Spotify, reopen Spotify and check the connection again.',
    ),
  ],
  'youtube-music': [
    step(
      '#youtube-music-open',
      'Open and sign in to YouTube Music',
      'Open the service in your browser and sign in there. Capri uses that YouTube Music tab.',
    ),
    step(
      '#youtube-music-preferred',
      'Choose YouTube Music for music requests',
      'Turn this on to send general music requests to YouTube Music. You can still name a specific service when asking Capri.',
    ),
    step(
      '#youtube-music-check',
      'Check that Capri can reach the music tab',
      'Leave YouTube Music open and verify the connection. If playback fails, try starting a track manually once and check again.',
    ),
  ],
  music: [
    step(
      '#music-listening-status',
      'Check the music signal',
      'The skill analyzes the selected sound source locally. Choose a system output or virtual cable under Audio if the monitor hears the wrong source.',
    ),
    step(
      '#music-listening-auto-bpm',
      'Match motion to the beat',
      'Turn on automatic BPM matching to let animations follow tempo when the music signal is clear.',
    ),
    step(
      '#music-listening-enabled',
      'Enable music animations',
      'The animation switch controls visual reactions while listening is active.',
    ),
    step(
      '#music-listening-notes',
      'Show floating notes',
      'Display notes near Capri while music is detected.',
    ),
    step(
      '#music-listening-motion',
      'Move with the track',
      'Let the avatar move along with the music. Use this separately from floating notes.',
    ),
  ],
  'avatar-skill': [
    step(
      '#avatar-roaming',
      'Let Capri roam',
      'Capri can change her position independently. Roaming pauses while you speak, type or interact with her.',
    ),
    step(
      '#avatar-roam-monitors',
      'Choose where Capri can roam',
      'Limit movement to the current or observed monitor, allow any display, or follow the display with the pointer.',
    ),
    step(
      '#avatar-roam-interval',
      'Set the time between moves',
      'A larger interval leaves Capri in one place longer.',
    ),
    step(
      '#teleport-style',
      'Choose a teleport animation',
      'Lightning strikes between the two points. Sandevistan leaves colored copies as Capri flies.',
    ),
    step(
      '#teleport-preview-play',
      'Preview a teleport effect',
      'Replay the effect without moving the desktop avatar.',
    ),
    step(
      '#teleport-color',
      'Style teleport lightning',
      'Choose its color, strength and shape. Branches, thickness and glow control how visible the lightning is.',
      '#teleport-intensity, #teleport-jaggedness, #teleport-branches, #teleport-thickness, #teleport-glow',
    ),
    step(
      '#teleport-spark-amount',
      'Tune teleport sparks',
      'Spark amount sets how many particles appear. Spark travel changes how far they move from the bolt.',
      '#teleport-spark-travel',
    ),
    step(
      '#sandevistan-hold',
      'Tune the Sandevistan trail',
      'Copies stay where they appeared. Set their lifetime and count, then adjust their tint strength, starting hue and hue step.',
      '#sandevistan-copies, #sandevistan-hue, #sandevistan-hue-step, #sandevistan-tint',
    ),
    step(
      '#teleport-reduced-flash',
      'Reduce bright teleport flashes',
      'Use reduced flashes for a calmer transition.',
    ),
    step(
      '#teleport-sound',
      'Choose a teleport sound',
      'Select a sound or Off to move silently. Use Preview to try the effect.',
    ),
    step(
      '#avatar-drag-tether',
      'Show lightning when you drag Capri',
      'The drag effect follows pointer movement on the desktop. It can be enabled separately from teleport lightning.',
    ),
    step(
      '#avatar-drag-tether-intensity',
      'Adjust drag lightning and its dead zone',
      'Intensity adds sparks and branches. Chaos spreads them out. The dead zone sets how far the pointer moves before the effect starts.',
      '#avatar-drag-tether-chaos, #avatar-drag-tether-dead-zone',
    ),
    step(
      '#avatar-snap-radius',
      'Set how close to an edge Capri attaches',
      'A larger distance makes attaching to window or monitor edges easier. The preview shows the active zones.',
    ),
    step(
      '#avatar-tap-gap',
      'Set the maximum pause between taps',
      'Ten taps on the same part can trigger a reaction. This setting controls how long each pause in the sequence can be.',
    ),
  ],
  initiative: [
    step(
      '#initiative-level',
      'Choose how often Capri can start a conversation',
      'The presets allow up to 10 or 30 starts per hour. Capri waits for a suitable moment and can speak less often.',
      '#initiative-frequency-label',
    ),
    step(
      '#initiative-hourly-limit',
      'Set your own hourly limit',
      'Enter a whole number from 1 to 120. Leave it empty to keep the preset limit.',
    ),
    step(
      '#initiative-return',
      'React after you return',
      'Capri can greet you when you come back after a period of inactivity.',
    ),
    step(
      '#initiative-apps',
      'React to supported media apps',
      'Capri can use a change in the active media application as a hint. Simply opening a player does not establish that anything is playing.',
    ),
    step(
      '#initiative-spontaneous',
      'Allow occasional spontaneous conversations',
      'Let Capri occasionally start a conversation while you are available, within the initiative limits.',
    ),
    step(
      '#initiative-screen-comments',
      'Allow comments on the screen you shared',
      'Start a session using Screen observation first. Capri can then comment on what the session shows.',
    ),
    step(
      '#initiative-watch-together',
      'Follow recent videos and gameplay',
      'Share the window itself and leave it in front. A local model can comment on a recent moment and may take time from the next response.',
    ),
    step(
      '#initiative-quiet-enabled',
      'Set quiet hours',
      'Enable quiet hours and enter a start and end hour from 0 to 23.',
      '#initiative-quiet-start, #initiative-quiet-end',
    ),
    step(
      '#initiative-exclusions',
      'Keep specific applications quiet',
      'Separate process names with commas. Exclude the browser if you want silence in browser calls, which Capri may not detect.',
      '#initiative-exclusions-label',
    ),
    step(
      '#initiative-test',
      'Test your settings and check the status',
      'Save changes before testing. The status explains whether Capri is waiting or why comments are paused.',
      '#initiative-status-title, #initiative-apply',
    ),
    step(
      '#initiative-dismiss',
      'Reduce an unwanted conversation type',
      'This hides the latest comment type. Restore dismissed comment types makes them available again.',
      '#initiative-restore',
    ),
  ],
  calls: [
    step(
      '#call-camera-enabled',
      'Show Capri in your call',
      'Enable Camera, wait until it is ready and select Capri Camera in Discord, Zoom or OBS.',
      '#call-camera-preview-panel',
    ),
    step(
      '#call-camera-color',
      'Set the camera background',
      'Choose a color or a PNG or JPEG up to 12 MB. The image is cropped to fill the frame. Remove image returns to the color, and Reset restores the default.',
      '#call-camera-image-pick, #call-camera-image-remove, #call-camera-background-reset',
    ),
    step(
      '#call-setup-connect',
      'Connect the virtual microphone',
      'Set up automatically combines your microphone and Capri’s voice. Select the virtual recording device shown here as your call app’s input and keep your regular speakers or headphones.',
      '#call-output-disable',
    ),
    step(
      '#call-setup-consent',
      'Review the optional VB-CABLE installation',
      'If the installer is offered, review the vendor’s license before consenting to the Windows driver installation.',
      '#call-setup-website, #call-setup-license, #call-setup-install',
    ),
    step(
      '#call-output-device',
      'Select an existing virtual audio cable',
      'Choose the cable’s playback endpoint here. In the call app, use the matching recording endpoint as the microphone.',
      '#call-output-advanced > summary, #call-output-refresh, #call-output-enable',
    ),
    step(
      '#call-output-mix-mic',
      'Mix your microphone into the call',
      'Enable this to send your microphone together with Capri’s voice. Stop call output before changing a live route.',
    ),
    step(
      '#call-output-share-replies',
      'Send spoken replies to the call',
      'With call output active, this shares Capri’s spoken replies. Voice previews play locally.',
    ),
    step(
      '#call-voice-volume',
      'Adjust Capri’s call volume',
      'This slider changes Capri’s level in the call only. Set it to 0% to mute her there.',
    ),
    step(
      '#call-output-allow-model',
      'Choose where a single reply plays',
      'This allows the Ask Capri in call action. Capri can choose local speakers or speakers and the call for that request.',
    ),
    step(
      '#call-system-enable',
      'Include sound from the call',
      'Turn on Capri’s microphone first. Check that Audio includes the sound you want to share. Headphones help avoid feedback.',
      '#call-system-stop',
    ),
    step(
      '#call-system-wake',
      'Let callers wake Capri by name',
      'When system audio is active, callers can call Capri by name. If automatic sending is enabled, recognized wake requests can go to the selected model.',
    ),
  ],
};

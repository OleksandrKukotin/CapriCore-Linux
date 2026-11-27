// SPDX-License-Identifier: GPL-3.0-only
export const coreGuides = {
  general: [
    [
      '[data-window-action="hide"]',
      [
        'Hide Capri to the tray',
        'The window disappears while Capri keeps running. Use her Windows notification-area icon to bring it back.',
      ],
    ],
    [
      '[data-window-action="reset-avatar"]',
      [
        'Reset the portrait',
        'Fit Capri’s full sprite inside the portrait and restore the default zoom.',
      ],
    ],
    [
      '[data-window-action="reset-position"]',
      [
        'Return the window to its corner',
        'Move Capri’s window to the bottom-right corner of the primary display.',
      ],
    ],
    [
      '#general-on-top',
      ['Keep Capri on top', 'Enable this to keep her window above normal application windows.'],
    ],
    [
      '#general-portrait',
      [
        'Keep the portrait expanded',
        'Enable this to keep the portrait open. Turn it off to allow the compact view.',
      ],
    ],
    [
      '[data-window-action="focus-mode"]',
      [
        'Switch to focus mode',
        'Focus mode hides Capri and Settings. Restore Capri from her icon in the system tray.',
      ],
    ],
    [
      '#reply-auto-hide',
      [
        'Hide completed replies automatically',
        'Spoken replies hide after playback. You can find them again in Conversation.',
      ],
    ],
    [
      '#reply-auto-hide-seconds',
      [
        'Set the text reply delay',
        'With auto-hide on, this determines how long a text-only reply remains visible, from 2 to 60 seconds.',
      ],
    ],
    [
      '[data-window-action="reconnect"]',
      [
        'Reconnect or wake Capri',
        'Reconnect if Capri is offline or asleep. If she asks for a model, visit Language model or API connections.',
      ],
    ],
    [
      '[data-window-action="sleep"]',
      ['Put Capri to sleep', 'Sleep unloads local models. They load again when you wake Capri.'],
    ],
    [
      '[data-window-action="quit"]',
      [
        'Close Capri and unload the models',
        'Quit stops any current reply, closes Capri and unloads her local models.',
      ],
    ],
    [
      '#general-reset-settings',
      [
        'Restore default settings',
        'Reset restores preferences and keeps your conversations, memory, installed models, saved connections and permissions.',
      ],
    ],
  ],
  languages: [
    [
      '#language-interface',
      [
        'Choose the interface language',
        'This sets labels, menus and settings. The conversation language has its own selection.',
      ],
    ],
    [
      '#language-conversation',
      [
        'Choose the language of replies',
        'The selected model uses this language for subsequent replies. Choose Custom to enter another language. Voice input and spoken replies have their own controls.',
      ],
    ],
    [
      '#language-custom',
      [
        'Name the language',
        'Enter the name of the language you want Capri to use. The selected model must understand it.',
      ],
    ],
    [
      '#language-apply',
      [
        'Apply your language choices',
        'This saves your changes for future replies. Existing messages keep their original language.',
      ],
    ],
  ],
  audio: [
    [
      '#audio-routing-refresh',
      [
        'Refresh the audio devices',
        'Connect your headset or start a virtual mixer first. System default follows the device selected in Windows.',
      ],
    ],
    [
      '#audio-route-microphone',
      [
        'Choose Capri’s microphone',
        'Pick the input carrying your speech, including a virtual input from VoiceMeeter, Voicemod or NVIDIA Broadcast. Microphone settings has gain and a listening test.',
      ],
      {
        help: '[data-audio-settings="microphone"]',
      },
    ],
    [
      '#audio-route-speaker',
      [
        'Choose where Capri’s replies play',
        'Pick your speakers or headphones. Voice effects opens the controls for the sound of her voice.',
      ],
      {
        help: '[data-audio-settings="voice"]',
      },
    ],
    [
      '#audio-route-volume',
      [
        'Set the local voice volume',
        'This slider controls Capri’s spoken replies on the selected playback device.',
      ],
    ],
    [
      '#audio-route-music',
      [
        'Isolate the music signal',
        'Select a recording input or a playback device under Loopback. For a virtual cable, send the player into the cable and choose its recording end here.',
      ],
      {
        help: '[data-audio-settings="music"]',
      },
    ],
    [
      '#audio-route-system',
      [
        'Choose system audio in calls',
        'This is what Capri hears when system audio is enabled in a call. Pick the system playback device carrying the call sound.',
      ],
    ],
    [
      '#audio-route-call',
      [
        'Route the virtual microphone',
        'Choose the cable playback end for Capri’s mix. In Discord or another call app, select that cable’s recording input as the microphone. Use headphones if you hear echo.',
      ],
      {
        help: '[data-audio-settings="calls"]',
      },
    ],
  ],
  personality: [
    [
      '#communication-style',
      [
        'Choose Capri’s tone',
        'Neutral, Romantic, Business and Wild change the tone of the next reply. The Personality field provides character instructions.',
      ],
    ],
    [
      '#wild-close-ai-tabs',
      [
        'React to other AI tabs',
        'This works in every communication style. When a supported AI site is active in Chrome or Edge, Capri can make a short comment in her current style. Select Keep tab open within eight seconds to cancel the close.',
      ],
    ],
    [
      '#companion-conversation-mode',
      [
        'Use hands-free conversation',
        'While voice input is on, Capri can respond to transcribed speech or stay silent. Say her name at the start of a voice command to use a skill.',
      ],
    ],
    [
      '#companion-follow-up',
      [
        'Answer Capri’s follow-up question',
        'After a voice request, a question from Capri opens a listening window when she finishes speaking. The microphone needs to be on.',
      ],
    ],
    [
      '#companion-follow-up-seconds',
      [
        'Set the follow-up listening time',
        'Choose how long Capri waits for your reply after asking a question, from 5 to 30 seconds.',
      ],
    ],
    [
      '#companion-save',
      [
        'Apply conversation settings',
        'Save the communication style and conversation switches for the next reply.',
      ],
    ],
    [
      '#personality-text',
      [
        'Write a custom personality',
        'Describe how you want Capri to behave, ideally with an example. This shapes future replies within your current permissions and conversation. Save an empty field to restore the original character.',
      ],
      {
        help: '#personality-save',
      },
    ],
    [
      '#personality-open',
      [
        'Edit the personality file',
        'Open the folder with PERSONALITY.md and edit it in your preferred editor. Saved file changes apply to the next reply.',
      ],
    ],
    [
      '#personality-reset',
      [
        'Restore the original personality',
        'This restores Capri’s standard character for the next reply.',
      ],
    ],
  ],
  appearance: [
    [
      '#theme-preset',
      [
        'Choose an interface palette',
        'Pick a preset or choose Custom. The three swatches show the accent, background and panel colors.',
      ],
    ],
    [
      '#theme-hue',
      [
        'Tune the accent color',
        'In Custom, hue changes the color of highlights. Saturation changes its vividness.',
      ],
      {
        help: '#theme-saturation',
      },
    ],
    [
      '#theme-background-hue',
      [
        'Tune the background color',
        'Choose the background hue and saturation. Brightness changes how light the background appears.',
      ],
      {
        help: '#theme-background-saturation, #theme-background-brightness',
      },
    ],
    [
      '#theme-panel-linked',
      [
        'Link the panel color to the background',
        'Match background derives the panel palette from your background. Turn it off for independent panel colors.',
      ],
    ],
    [
      '#theme-panel-hue',
      [
        'Tune the panel color',
        'With Match background off, set the panel hue and saturation independently.',
      ],
      {
        help: '#theme-panel-saturation',
      },
    ],
    [
      '#companion-glitch-enabled',
      [
        'Enable visual glitches',
        'Glitches briefly split the colors of Capri’s avatar and the interface edges. Reduced motion disables moving glitches.',
      ],
    ],
    [
      '#companion-glitch-strength',
      [
        'Tune the visual glitch',
        'This sets the strength of the color split. At zero the effect is invisible. Preview glitch shows a sample.',
      ],
      {
        help: '#glitch-preview',
      },
    ],
    [
      '#companion-glitch-interval',
      [
        'Space out ambient glitches',
        'This interval controls how often ambient glitches appear while Capri is visible.',
      ],
    ],
    [
      '#companion-glitch-events',
      [
        'Use glitches on speech and poses',
        'Speech and pose changes can trigger larger glitches, at least six seconds apart.',
      ],
    ],
    [
      '#process-graphs',
      [
        'Show resource graphs',
        'Choose up to four metrics. The counter shows how many are selected. With fewer graphs, each graph has space for more seconds of history.',
      ],
      {
        help: '[data-resource-display="graphMetrics"]',
      },
    ],
    [
      '#memory-monitor',
      [
        'Show compact resource meters',
        'Turn on compact meters and choose up to four metrics. The selection is independent of the graphs.',
      ],
      {
        help: '[data-resource-display="meterMetrics"]',
      },
    ],
    [
      '#memory-style',
      ['Choose the meter shape', 'Choose Circles or Bars for the compact indicators.'],
    ],
    [
      '#memory-interval',
      [
        'Set the resource refresh interval',
        'Choose how often the graphs and meters refresh, from one to ten seconds. Temperature depends on which CPU sensors Windows or LibreHardwareMonitor can read.',
      ],
    ],
    [
      '#settings-portrait-zoom',
      [
        'Set the portrait size',
        'Zoom changes the size of the avatar inside the portrait. Use General to reset its size and position.',
      ],
    ],
    [
      '#companion-expand-reply',
      [
        'Expand Capri for replies',
        'Enable this to open the portrait for voice activation and replies. In compact view, use the diamond button on the top toolbar to open the portrait.',
      ],
    ],
    [
      '#minimized-chip',
      [
        'Show the restore chip',
        'The desktop chip gives you a quick way to bring Capri back when her window is minimized.',
      ],
    ],
    [
      '#detached-style',
      [
        'Choose the detached appearance',
        'Show the character sprite or dialogue only when the avatar is out of frame. Moving and attachment controls are under Avatar interaction.',
      ],
    ],
  ],
  window: [
    [
      '#companion-window-layout',
      [
        'Window layout',
        'Vertical stacks the reply, portrait and message box from top to bottom. Horizontal gives you a wider, shorter window with the portrait on the left and the reply and message box on the right.',
      ],
    ],
    [
      '#companion-float-enabled',
      [
        'Enable window motion',
        'This makes the interface drift inside Capri’s window. The preview shows the motion. Interaction pauses it, and reduced motion disables it.',
      ],
    ],
    [
      '#companion-float-amplitude',
      [
        'Set the motion distance',
        'Amplitude controls how far the interface moves. Zero keeps it still.',
      ],
    ],
    [
      '#companion-float-period',
      ['Set the motion cycle', 'A longer cycle makes each movement take more time.'],
    ],
    [
      '#dimming-enabled',
      ['Dim the desktop behind Capri', 'Enable dimming to make the area behind Capri darker.'],
    ],
    [
      '#dimming-level',
      ['Set dimming strength', 'Choose how dark the affected area should become.'],
    ],
    [
      '#dimming-softness',
      [
        'Soften the dimming edge',
        'A larger value blends the dark area with more of the surrounding desktop.',
      ],
    ],
  ],
  models: [
    [
      '#models-choice',
      [
        'Choose a local language model',
        'Start with a model recommended for your language and hardware. Disk size, system RAM and GPU memory are separate estimates.',
      ],
    ],
    [
      '#models-local',
      [
        'Switch to the selected local model',
        'Capri prepares the selected model if needed, then switches to it. Your conversation and saved memory are kept.',
      ],
    ],
    [
      '#models-refresh',
      [
        'Refresh model availability',
        'Refresh models updates which files are downloaded. Open models folder shows where files for the selected source are stored.',
      ],
      {
        help: '#models-folder',
      },
    ],
    [
      '#models-prepare',
      [
        'Prepare a model without switching',
        'Download and prepare leaves the current model active. Use Switch model and restart afterwards to activate the download.',
      ],
      {
        help: '#models-apply, #models-cancel',
      },
    ],
    [
      '#models-context',
      [
        'Choose the context window',
        '32K is the recommended starting point. 16K leaves less room for long chats and images. Larger contexts use more RAM and GPU memory. Apply and restart to save.',
      ],
      {
        help: '#models-context-apply',
      },
    ],
    [
      '#model-device-language',
      [
        'Choose where the language model runs',
        'Automatic picks a supported accelerator when possible. CPU mode uses system RAM and can be slower. An external API uses the provider’s hardware.',
      ],
    ],
    [
      '#model-device-voice',
      [
        'Choose where the voice model runs',
        'Voice and language model devices can differ. If both use one GPU, they share its memory.',
      ],
    ],
    [
      '#model-device-refresh',
      [
        'Read device availability',
        'Refresh the device list and read the status beside each selection. Save and restart Capri to apply changes.',
      ],
      {
        help: '#model-device-apply',
      },
    ],
    [
      '#model-device-npu-advanced > summary',
      [
        'Configure an NPU',
        'Use advanced NPU setup with compatible hardware and runtimes. If setup is needed, follow the installation guide for the device.',
      ],
      {
        help: '#model-device-npu-guide',
      },
    ],
    [
      '[data-npu="backend"]',
      [
        'Choose the NPU runtime',
        'Choose the runtime that matches your hardware and driver. Intel uses OpenVINO, AMD uses Ryzen AI, and Qualcomm uses QNN.',
      ],
    ],
    [
      '[data-npu="folder"]',
      [
        'Select a converted model folder',
        'Choose OpenVINO IR or ONNX GenAI files prepared for the selected NPU. GGUF is for a different runtime. AMD hybrid models also use GPU resources.',
      ],
      { help: '[data-npu="modelPath"]' },
    ],
    [
      '[data-npu="python"]',
      [
        'Choose the vendor Python environment',
        'Choose the Python installed by your NPU vendor. For Intel you can use the private OpenVINO runtime prepared by Capri.',
      ],
      { help: '[data-npu="install"]' },
    ],
    [
      '[data-npu="contextTokens"]',
      [
        'Set the NPU model context',
        'Set a limit the converted model supports. Larger contexts can increase memory use.',
      ],
    ],
    [
      '[data-npu="test"]',
      [
        'Test and activate the native model',
        'Test native model checks that the selected configuration runs. If the test passes, choose Use NPU and restart.',
      ],
      { help: '[data-npu="use"]' },
    ],
    [
      '#hf-query',
      [
        'Find a Hugging Face repository',
        'Enter a model name or a repository in owner/model format. Use Search to find matches or Open repository for an exact name.',
      ],
      {
        help: '#hf-search, #hf-inspect, #hf-results button',
      },
    ],
    [
      '#hf-task',
      [
        'Choose what kind of model to look for',
        'Language models search for GGUF. Voice results can require a separate engine. Open Spoken replies for voices Capri can install.',
      ],
      {
        help: '#hf-voices',
      },
    ],
    [
      '#hf-file',
      [
        'Choose a GGUF and quantization',
        'Smaller quantizations can save memory at the cost of answer quality. Check the repository license before downloading.',
      ],
    ],
    [
      '#hf-projector',
      [
        'Choose the vision projector',
        'A vision model may require a matching projector file before it can handle screenshots and image attachments.',
      ],
    ],
    [
      '#hf-plan',
      [
        'Check the download and prepare the model',
        'Check the size first, then download and prepare. After it completes, use the model selector to activate the import.',
      ],
      {
        help: '#hf-install, #hf-cancel',
      },
    ],
    [
      'section:has(> #hf-installed) h3',
      [
        'Review imported Hugging Face models',
        'Activate an imported model from the selector above. Repair replaces missing files, and Remove deletes the import from this PC.',
      ],
      { help: '#hf-installed button' },
    ],
    [
      'details:has(#hf-token) > summary',
      [
        'Use a token for restricted repositories',
        'Public repositories work without a token. For a private or gated model, obtain repository access and save a Hugging Face read token.',
      ],
      {
        help: '#hf-token, #hf-save-token, #hf-remove-token',
      },
    ],
  ],
  api: [
    [
      '#api-add',
      [
        'Create an API connection',
        'Open the form to enter a provider, base URL, model ID and API key. A saved connection can be activated from the list.',
      ],
    ],
    [
      '#api-name',
      [
        'Name the connection',
        'Use a label that helps you tell saved connections apart. You can also leave this field empty.',
      ],
    ],
    [
      '#api-provider',
      [
        'Choose the API provider',
        'A preset enters common defaults. Choose Custom for another OpenAI-compatible endpoint.',
      ],
    ],
    [
      '#api-url',
      [
        'Enter the provider’s API address',
        'Copy the API base URL from the provider’s developer settings. Local services use the address of their running local server.',
      ],
    ],
    [
      '#api-model',
      [
        'Enter the model ID',
        'Copy the exact model ID listed by your provider. An incorrect ID can make an otherwise valid connection fail.',
      ],
    ],
    [
      '#api-key',
      [
        'Enter the connection’s API key',
        'Create a key in the provider’s developer account and paste it here. Stored keys are encrypted and excluded from diagnostics.',
      ],
    ],
    [
      '#api-tools',
      [
        'Enable tool calls if supported',
        'Turn this on when the endpoint supports tool calling. The skills and permissions still control what Capri may do.',
      ],
    ],
    [
      '#api-vision',
      [
        'Enable image support if available',
        'Vision lets a compatible model work with screenshots and image attachments. Match this switch to the model’s capabilities.',
      ],
    ],
    [
      '#api-context',
      [
        'Match the provider’s context limit',
        'Enter the server’s supported maximum so that Capri can size requests appropriately.',
      ],
    ],
    [
      '#api-save',
      [
        'Save or cancel the connection draft',
        'Save connection adds or updates the row in the list. Cancel closes the form and discards the draft.',
      ],
      {
        help: '#api-cancel',
      },
    ],
    [
      '#api-test-all',
      [
        'Check saved connections',
        'Tests send short samples without conversation history and can use quota. The saved row offers individual testing, activation, editing and removal.',
      ],
      {
        help: '#api-connections button',
      },
    ],
    [
      '#api-mode',
      [
        'See the active model source',
        'External models receive your messages, relevant personality and memory, and authorized tool results. Images are sent when a vision feature is used. The provider’s terms and charges apply.',
      ],
    ],
    [
      '#api-skip-local-model',
      [
        'Skip the local model while using an API',
        'This saves local memory and skips warmup while your external connection is active. Voice input and speech output have separate settings.',
      ],
    ],
    [
      '#desktop-ai-details > summary',
      [
        'Find installed AI apps and local servers',
        'Scan reads application metadata and known local model lists. Results may include a local server you can use for a connection.',
      ],
      {
        help: '#desktop-ai-scan, #desktop-ai-installed button, #desktop-ai-servers button',
      },
    ],
    [
      '#chatgpt-plan-connect',
      [
        'Sign in with a ChatGPT account',
        'Continue with ChatGPT starts browser sign-in for an eligible account. Add account saves a second login.',
      ],
      {
        help: '#chatgpt-plan-add-account, #chatgpt-plan-cancel',
      },
    ],
    [
      '#chatgpt-plan-account',
      [
        'Choose a saved ChatGPT account',
        'Select the account for the model you want Capri to use. Sign out removes that stored sign-in.',
      ],
      {
        help: '#chatgpt-plan-signout',
      },
    ],
    [
      '#chatgpt-plan-model',
      [
        'Choose a model for this account',
        'Choose an available model, then select Use connection. Refresh models reloads the list, and Test connection sends a sample.',
      ],
      {
        help: '#chatgpt-plan-save, #chatgpt-plan-models, #chatgpt-plan-test',
      },
    ],
    [
      '#chatgpt-plan-usage',
      ['Review ChatGPT usage', 'Open account usage to check activity and plan limits.'],
    ],
  ],
  microphone: [
    [
      '#skill-show-button',
      [
        'Show the voice input shortcut',
        'Enable the skill in the sidebar. Its toolbar shortcut controls wake-phrase listening. The mic in the message bar captures speech on demand.',
      ],
    ],
    [
      '#settings-audio-device',
      [
        'Select the recording input',
        'Choose a physical mic or a virtual input carrying your voice. Refresh devices after connecting a new one.',
      ],
      {
        help: '#settings-device-refresh',
      },
    ],
    [
      '#settings-microphone-monitor',
      [
        'Listen to your microphone',
        'Listen to the selected input and watch the meter. Use headphones to avoid feedback.',
      ],
    ],
    [
      '#settings-microphone-gain',
      [
        'Amplify a quiet microphone',
        '100% keeps the original level. Raise it gradually and reduce it if speech clips or background noise becomes distracting.',
      ],
    ],
    [
      '#language-recognition',
      [
        'Choose the recognition language',
        'Automatic follows the conversation language when a recognition pack is available. Apply the change, then turn the microphone back on.',
      ],
      {
        help: '#language-recognition-controls > .settings-actions:last-child button',
      },
    ],
    [
      '#language-install-speech',
      [
        'Install missing recognition components',
        'Install and enable downloads the components needed for the selected recognition language. Keep Capri open while it runs.',
      ],
      {
        help: '#language-install-details > summary, #language-install-cancel, #language-install-report',
      },
    ],
    [
      '#speech-pause',
      [
        'Set the pause after speaking',
        'A short pause lets Capri answer sooner. Increase it if she interrupts your thought. Reset to 1 s restores the usual pause.',
      ],
      {
        help: '#speech-reset, #speech-apply',
      },
    ],
    [
      '#wake-restore-from-tray',
      [
        'Restore Capri at the wake phrase',
        'Enable this to show the window when voice activation hears her name while Capri is in the tray.',
      ],
    ],
    [
      '#wake-sound',
      [
        'Choose a wake sound',
        'Pick a tone, a short custom file, Capri’s voice, or silence. Custom audio can be up to ten seconds.',
      ],
      {
        help: '#wake-import',
      },
    ],
    [
      '#wake-phrase',
      [
        'Pick the spoken acknowledgement',
        'Choose a phrase and prepare it once with the current voice. Capri uses a signal tone while a prepared sample is unavailable.',
      ],
      {
        help: '#wake-prepare',
      },
    ],
    [
      '#wake-volume',
      [
        'Set the wake acknowledgement volume',
        'Set how loud the acknowledgement is and select Play to test it.',
      ],
      {
        help: '#wake-play',
      },
    ],
  ],
  voice: [
    [
      '#voice-source-local',
      [
        'Set up a local voice',
        'Local opens speech settings for this PC. The source status shows which voice Capri actually uses.',
      ],
    ],
    [
      '#voice-use-local',
      [
        'Switch back to local voice',
        'Use local voice turns off the external voice connection and returns to the selected local voice.',
      ],
    ],
    [
      '#language-speech',
      [
        'Choose the speech language',
        'Automatic follows the conversation language. Text replies only silences speech. Choose a specific language if your voice supports it, then apply.',
      ],
      {
        help: '#language-speech-controls > .settings-actions:last-child button',
      },
    ],
    [
      '#language-install-speech',
      [
        'Install the missing voice',
        'Install and enable downloads the voice for your chosen language. Keep Capri open while the download runs.',
      ],
      {
        help: '#language-install-details > summary, #language-install-cancel, #language-install-report',
      },
    ],
    [
      '#voice-model-language',
      [
        'Filter voices by language',
        'Choose the intended speech language to see the compatible Hugging Face voices.',
      ],
    ],
    [
      '#voice-model-choice',
      [
        'Choose a local voice model',
        'Choose a voice from the list for the selected language. Its source, disk size and installation status appear below.',
      ],
    ],
    [
      '#voice-model-details',
      [
        'Check voice hardware requirements',
        'Check CPU and GPU requirements for the selected voice. When available, install AMD acceleration or select the suggested CPU-compatible voice.',
      ],
      {
        help: '#voice-model-rocm, #voice-model-cpu-alternative',
      },
    ],
    [
      '#voice-model-install',
      [
        'Download a voice',
        'Download the chosen model first. Cancel download interrupts preparation of that model.',
      ],
      {
        help: '#voice-model-install-cancel',
      },
    ],
    [
      '#voice-model-select',
      [
        'Use a downloaded voice',
        'Use this voice model activates the downloaded voice. Try a short reply after selecting it.',
      ],
    ],
    [
      '#voice-model-breeze-import',
      [
        'Set up a Breeze voice',
        'Select Breeze for English or Mandarin. Read and accept the model license before downloading. Import a .breeze profile you have permission to use, then activate the downloaded model. Breeze uses Vulkan on compatible GPUs and can run on the CPU.',
      ],
      {
        help: '#voice-model-breeze-license, #voice-model-breeze-accept',
      },
    ],
    [
      '#voice-model-import',
      [
        'Choose recordings for voice training',
        'Choose recordings you have permission to use. Use separate takes and keep clips from the same scene together. Review transcripts before importing.',
      ],
    ],
    [
      '#voice-model-recording-reference',
      [
        'Review recordings and choose a reference',
        'Check each clip’s words and select a clear, neutral reference. Import reviewed recordings saves the set for later. Import and train starts training immediately.',
      ],
      {
        help: '#voice-model-recording-list :is(textarea, button), #voice-model-approve, #voice-model-approve-train, #voice-model-discard',
      },
    ],
    [
      '#voice-model-train',
      [
        'Train the local voice',
        'Start training on the reviewed recordings. It runs on this PC and can be stopped with Cancel training.',
      ],
      {
        help: '#voice-model-cancel',
      },
    ],
    [
      '#voice-model-preview',
      [
        'Check and apply the trained voice',
        'Listen to the result. Apply trained voice selects it for future speech.',
      ],
      {
        help: '#voice-model-apply',
      },
    ],
    [
      '#voice-source-api',
      [
        'Open the cloud voice settings',
        'Voice API opens the external speech settings. Cloud speech uses its own provider and connection.',
      ],
    ],
    [
      '#tts-api-provider',
      [
        'Choose the voice provider',
        'Choose your speech service. For another OpenAI-compatible provider, use its API endpoint and credentials.',
      ],
    ],
    [
      '#tts-api-key',
      [
        'Enter the provider’s voice API key',
        'Create a voice API key with the provider and paste it here. A ChatGPT sign-in and a voice API key are separate.',
      ],
    ],
    [
      '#tts-api-model',
      [
        'Enter the voice model ID',
        'Copy the exact model ID from the voice provider. The choice must support the selected voice.',
      ],
    ],
    [
      '#tts-api-voice',
      [
        'Enter the voice name or ID',
        'Use the name or ID listed by your provider. Try the connection to hear how this voice sounds.',
      ],
    ],
    [
      '#tts-api-url',
      [
        'Enter the server address',
        'For compatible services, enter the base API URL from the provider’s documentation.',
      ],
    ],
    [
      '#tts-api-save',
      [
        'Save and test the connection',
        'The test plays a short sample and may use provider credit. Check the key, model and voice if there is an error.',
      ],
    ],
    [
      '#tts-api-enabled',
      [
        'Enable cloud speech',
        'Enable Use cloud voice after a successful test. The voice request contains the text Capri will speak.',
      ],
    ],
    [
      '#tts-api-remove',
      [
        'Remove the voice connection',
        'Remove the saved service when you no longer want to use its voice.',
      ],
    ],
    [
      '#voice-effects-enabled',
      [
        'Turn on voice effects',
        'Voice effects change playback of Capri’s spoken replies. Enable them to hear the processing.',
      ],
    ],
    [
      '#voice-effects-preset',
      [
        'Choose an effect preset',
        'Choose a ready-made sound, then adjust individual sliders if you want to make it your own.',
      ],
    ],
    [
      '#fx-intensity',
      ['Set the effect strength', 'Intensity changes the overall strength of the processing.'],
    ],
    [
      '#fx-mix',
      [
        'Blend the original and processed voice',
        'Lower Effect mix to make the original voice clearer.',
      ],
    ],
    [
      '#fx-reverb',
      [
        'Add a room sound',
        'Reverb gives the voice a sense of space. Reduce it to keep words crisp.',
      ],
    ],
    ['#fx-delay', ['Add a short echo', 'Short delay adds a faint repeat after each sound.']],
    [
      '#fx-filter',
      ['Shape the radio sound', 'Radio filtering narrows the tone like a radio transmission.'],
    ],
    [
      '#fx-glitch',
      [
        'Control voice glitch frequency',
        'Raise this setting to hear more electronic interruptions in the voice.',
      ],
    ],
    [
      '#fx-electronicMix',
      [
        'Blend in a synthetic layer',
        'Raise the blend to make the electronic layer more prominent.',
      ],
    ],
    [
      '#fx-carrierHz',
      [
        'Tune the electronic layer',
        'The carrier frequency changes the pitch of the synthetic layer.',
      ],
    ],
    [
      '#voice-effects-reset',
      ['Reset the voice effects', 'Reset to clean restores the clean effect settings.'],
    ],
    [
      '#voice-effects-preview',
      [
        'Listen to the voice',
        'The preview uses the current voice and effect settings. If it is silent, check the source, language and Audio output.',
      ],
    ],
  ],
  reasoning: [
    [
      '#skill-show-composer',
      [
        'Use Deep thinking when you need it',
        'Enable the skill in the sidebar. Show its button in the message bar to turn it on for requests that need more reasoning.',
      ],
    ],
    [
      '#reasoning-effort',
      [
        'Balance depth and response time',
        'Low, Medium and High set how much effort a supported model spends thinking. Higher effort may take longer and use more API tokens.',
      ],
    ],
  ],
  'web-search': [
    [
      '#web-search-engine',
      [
        'Choose the search engine',
        'DuckDuckGo searches the broader web. Wikipedia searches encyclopedia articles. The search service receives the query.',
      ],
    ],
    [
      '#web-search-sort',
      [
        'Choose the result order',
        'Relevance puts likely matches first. Title (A–Z) sorts result titles alphabetically.',
      ],
    ],
    [
      '#web-search-domains',
      [
        'Filter the sites in search results',
        'Enter hostnames separated by commas. An empty list searches all sites. A narrow filter can produce no results.',
      ],
    ],
    [
      '#web-search-exclude',
      [
        'Exclude domains instead of keeping them',
        'Enable this to omit listed sites. With it off, only the listed sites are kept.',
      ],
    ],
    [
      '#web-search-save',
      [
        'Save and test the search settings',
        'Save the settings, then try a concrete query. If the result is empty, widen the filter or switch engines.',
      ],
    ],
  ],
};

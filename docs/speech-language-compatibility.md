# Recognition and spoken language

Speech recognition language controls input transcription. Conversation language
controls the reply text; the selected spoken voice must match that conversation
language. Ukrainian recognition with an English conversation/voice is supported:
Capri should understand the Ukrainian transcript and answer in English.

The trained Turbo voice is English-only. If a reply nevertheless contains a
substantial non-Latin passage, the desktop stops that audio turn and preserves the
text reply with an actionable language warning. The Python voice pool also checks
before preparing/generating speech. The guard adds no model load or translation
request. Accented Latin text and brief foreign proper names remain accepted.

This is a cheap script check, not a full language classifier or an assessment of
audio quality. It cannot detect every unsupported Latin-script language, incorrect
pronunciation, or hallucination produced from otherwise valid English text. A
recording and diagnostic report are needed to investigate those cases.

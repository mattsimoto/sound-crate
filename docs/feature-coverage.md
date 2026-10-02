# Explainer video coverage

Reviewed the supplied 44.7-second Upcycle explainer, including the slot-adjustment panel at approximately 36 seconds. Sound Crate implements its own student-friendly equivalents rather than reproducing Aria Labs branding or claiming equivalent analysis quality.

| Visible control or workflow | Sound Crate equivalent |
| --- | --- |
| Select folders, analyze files in the background | Choose folder/files, drag/drop, Add sounds, analysis progress |
| Tempo and key controls; random key | Speed, Key, Random key |
| Play/stop | Play button and Space |
| Chaos to Safe results | Wild → Safe; safe favors role matches, similar tempo, and favorites |
| Reset | Reset controls; preserves sounds, tempo, and key |
| Undo/redo | Buttons and Cmd/Ctrl-Z, Shift-Cmd/Ctrl-Z; up to 12 steps |
| Save and saved sets | Portable Save/Open Project files and named Saved sessions |
| Mini | Compact view |
| Multiple sound roles | Drums, Bass, Chords, Melody, Texture, Vocal, Wild card |
| Slot star, solo, mute, lock | Favorite, Solo, Mute, Lock |
| Waveform and source metadata | Animated waveform, filename, source/target BPM, key shift |
| Volume and pan | Volume and Left or right |
| Per-slot source selection | Choose sound searches imported sounds; folder selector restricts a slot's pool; Add sounds combines folders |
| Add slot | Add slot and Remove; 1–12 slots |
| Reroll slot/all | New sound and Shuffle everything |
| Reroll same material | New slice selects the next bar-aligned section; wraps when needed |
| Adjust role | Role selector; selected sounds retain automatic source-role detection |
| Adjust gain | -12 to +12 dB |
| Sixteenth-note pattern | 16-step gate applied to the fitted audio each bar |
| Repeat every four bars | Plays the selected pattern on the first of four bars |
| Half/double time | Half time, Normal, Double time; Normal uses detected source BPM |
| Octave | -12, 0, +12 semitones |
| Hype | Gentle bass/treble EQ with reduced master level; included in mix export |
| Export mix | Stereo PCM WAV, 4/8/16/32 bars |
| Export individual stems | Same-length WAVs, dry or audible mix with volume/pan/gain |
| Drag stems to DAW | Native OS file drag in Electron desktop app; individual or all fitted dry loops |

## Practical limits and validation

- Microphone recording is now available from the start screen and mixer, with laptop/USB input selection, level meter, two-minute takes, preview, raw WAV downloads, and insertion into a slot or the collection. Short recorded hits are supported even though short imported files are normally skipped.
- Recorder regression checks cover USB device constraints, denied permissions, cancelling an unanswered prompt, disconnected devices, one-shot fitting, and project persistence. The Mac build also runs a real Electron/MediaRecorder smoke test using a synthetic microphone and verifies the microphone usage description in both app bundles. Actual hardware capture requires a laptop/USB mic test on the user's Mac.

- Browser-only OS dragging is not reliable across DAWs. In the web app, export WAVs and drag them from Finder. The desktop implementation prepares real local WAV files and calls Electron's native drag API.
- Native dragging uses one fitted loop per occupied slot, without its mixer volume, pan, or gain. For longer files or mixer settings, use Export stems.
- Native dragged WAVs stay in the desktop app's user-data DAW Stems folder after exit so DAWs that reference files do not lose them. Each prepared revision has its own path.
- The sample finder uses filename hints and approximate analysis. Transposition aligns relative keys; it does not change a source recording's major/minor mode.
- The video does not establish the hidden behavior of Upcycle's settings, menus, or selection algorithm. The equivalents above describe Sound Crate's behavior.
- Saved sessions live in this browser/app profile; clearing its data removes them. Portable project files provide a backup and contain selected source sounds and fitted loops, not the entire imported collection.
- Project/UI tests use a simulated Web Audio graph. WAV header/length, restored sample data, session persistence, mixer history, validation, and reset behavior are checked. Real Safari/Chrome listening quality and native drops into GarageBand/Logic/Ableton require Mac acceptance testing.
- The Mac workflow produces unsigned Apple Silicon and Intel builds. Signing/notarization requires the owner's Apple Developer credentials and is not configured.

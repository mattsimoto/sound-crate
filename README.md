# Sound Crate

A student-friendly sample-flipping music app for Mac and the web.

Point it at a folder of sounds you forgot you had. Sound Crate listens to every file, works out its speed and key, then stretches and tunes six of them so they play together as a loop. Keep shuffling until something clicks.

![Sound Crate with six sounds playing](docs/screenshot.png)

## Use it

**Online:** open https://mattsimoto.github.io/sound-crate (once GitHub Pages is turned on, see below).

**Offline on a Mac:** download `index.html`, rename it `Sound Crate.html` if you like, and double-click it. It opens in Safari or Chrome. To keep it handy, drag the file onto the right side of the Dock.

Your sounds are never uploaded anywhere. Everything happens inside the browser on your Mac.

## What it does

- Choose a sound folder, choose some files, or drop a folder onto the window
- Try the built-in demo sounds if you don't have any files yet
- Six slots: Drums, Bass, Chords, Melody, Texture and Wild card
- Every sound is stretched to one speed and tuned to one key
- Each slot has New sound, Lock, Mute, Solo, volume and left-or-right
- Change the speed (70–160 bpm), the key, and the loop length (1, 2 or 4 bars)
- Save the mix as a WAV file, or save each sound on its own
- In the desktop app, drag individual or all fitted stem WAVs into a DAW

Shortcuts: **Space** plays or stops, **R** shuffles everything.

## Save a project and continue later

Click **Save project** to download a `.soundcrate` file. It includes the chosen source sounds, the exact fitted loops, tempo, key, loop length, locks, mute/solo states, volume, and pan. Click **Open project** on either screen to restore it, then press Play. The original sound folder is not needed.

Projects include only the chosen sounds, so shuffle draws from those sounds after reopening. Load the original folder to explore its full collection. WAV exports are separate listening/GarageBand files and cannot restore project settings. Keep the project file somewhere you can find it; there is no automatic save. Maximum project size is 200 MB.

Starting a new folder resets slot controls to their defaults while keeping your chosen speed, key, and loop length. Switching folders during analysis cancels the old work and processes the new folder.

## Development checks

Run `npm ci` then `npm test` for syntax, audio serialization, loading/reset regression checks, native file validation, project v1/v2 compatibility, dynamic-slot restoration, undo/redo, slot adjustments, IndexedDB saved sessions, and aligned WAV export lengths. UI tests simulate the audio graph; listening and native DAW acceptance tests need a Mac.

## Good to know

- Works best with music loops. File names that include the tempo and key, like `Bass_120bpm_Am.wav`, make it more accurate.
- Sounds shorter than 1.5 seconds are skipped.
- Reads .wav, .aif, .mp3, .m4a, .flac, .ogg and .caf files.
- Dragging sounds out of the app only works in Chrome. In Safari, use Save each sound instead.

## How it works

It's one HTML file with no dependencies, using the Web Audio API.

1. **Tempo:** finds the loud hits in each sound and looks for a repeating pattern. If the file is a clean loop, its length in bars is used to pin the exact tempo. A tempo in the file name wins over both.
2. **Key:** measures how much of each of the 12 notes is in the sound and compares that to typical major and minor key patterns.
3. **Role:** guesses drums, bass, chords and so on from the file name, or from how bright and how tuneful the sound is.
4. **Fitting:** cuts a bar-aligned chunk, time-stretches it with WSOLA so the speed matches, resamples it to shift the pitch into the chosen key, then evens out the volume.

## Credits

Inspired by [Upcycle](https://arialabs.io/upcycle) by Aria Labs. If you make music on a Mac and want the real thing, go get it. Sound Crate is an independent learning project and isn't affiliated with Aria Labs.

## Version history

- **1.3.0** — laptop/USB microphone recording, input selection and meter, take preview, short-hit support, raw WAV saving, and Mac microphone permissions
- **1.2.0** — named saved sessions, 1–12 configurable slots, source-folder selection, favorites, slice rerolls, safe/wild selection, slot adjustments, history, compact view, Hype EQ, aligned exports, and native Mac drag support
- **1.1.0** — reliable folder switching, complete slot reset, and portable Save/Open Project files
- **1.0.0** — first version

## Record from a laptop or USB microphone

Click **Record a sound** on the start screen or mixer. Plug in a USB microphone if needed, choose it from the **Microphone** menu, then click **Enable microphone** to allow access and check the input meter. If device names are hidden, enable microphone access first; use **Refresh** after connecting a new input.

Click **Record**, make your sound, then **Stop**. Preview the take, name it, choose its type and destination slot, and click **Add sound**. Recordings appear in the **Recordings** source folder and can be chosen for other slots. Short hits such as claps or taps are supported and repeat on the beat when fitted. Takes are limited to two minutes. Playback pauses for recording; the input is not sent to the speakers.

**Save original WAV** keeps a separate copy of the raw take. Selected recordings also travel with saved sessions and portable project files. The imported sound collection itself is temporary, so download originals you want to keep. Recording works on the HTTPS website and in the desktop app. macOS/browser microphone permissions must be allowed. If macOS permission was denied, enable it in System Settings → Privacy & Security → Microphone and restart the desktop app.

## New mixer controls

Add/remove up to 12 slots and choose each slot's role and source folder. Choose sound searches the imported collection. New slice cycles through bar-aligned sections of the same file. Star favorites to favor them in safe shuffles. Wild → Safe controls how closely selections match roles and tempo. Adjust provides gain, half/double time, octave, a 16-step gate, and a four-bar repeat. Undo/redo stores up to 12 mixer changes. Compact hides secondary controls; Hype adds gentle bass/treble EQ.

Saved sessions keeps named mixes in this browser/app profile using IndexedDB. Clearing app/browser data removes them, so also save a portable project file. Export audio provides a 4/8/16/32-bar mix and equal-length stem WAVs. Dry stems include all occupied slots; mixed stems respect mute/solo and include volume, pan, and gain. Mix export also includes Hype and master compression.

## Mac desktop app and DAW dragging

The desktop app uses Electron native file dragging. Drag an individual slot's Save tab or Drag stems to DAW into GarageBand, Logic, Ableton, or another compatible DAW. Native dragging exports each fitted dry loop; use Export stems for longer files or mixer settings. This implementation still needs acceptance testing in those Mac DAWs.

To run from source on a Mac with Node.js installed:

```sh
npm ci
npm start
```

To build Apple Silicon and Intel installers:

```sh
npm run dist:mac
```

The **Build Sound Crate for Mac** GitHub Actions workflow also creates DMG/ZIP artifacts after code changes. Download Sound-Crate-Mac from a successful run's Artifacts section. These builds are unsigned and are not notarized; macOS may block first launch. Signing requires the owner's Apple Developer credentials.

See [explainer video feature coverage](docs/feature-coverage.md) for the control-by-control comparison and validation limits.

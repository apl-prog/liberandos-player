# Liberandos — Signal Recovery

A build-free static player using the original nine MP3 stems and orange/green logo. No packages, accounts, analytics, or external services are required. Tap a glyph to begin; subsequent taps fade channels in/out. All nine active displays **SIGNAL RECOVERED**. Tab + Space/Enter also works. Pause/Resume preserves the shared playhead.

## Run locally

From this folder:

```sh
python3 -m http.server 8765
```

Open <http://localhost:8765>. Serve over HTTP; opening `index.html` directly as a file will not load the audio/modules correctly. On a phone connected to the same Wi-Fi, open `http://YOUR_COMPUTER_LAN_IP:8765` while the server is running (allow the local firewall prompt if needed).

## GitHub Pages

1. Create a repository and put this folder's **contents** in its root, including `index.html`, `.nojekyll`, JavaScript, CSS, `assets/`, and `audio/`.
2. Commit and push to `main`.
3. In repository **Settings → Pages**, choose **Deploy from a branch**, then **main** and **/(root)**. Save.
4. Open the Pages URL shown by GitHub once deployment finishes. Relative paths also work under `https://USERNAME.github.io/REPOSITORY/`.

No build step or server backend is required. An existing repository can instead publish these contents from its `/docs` folder. [GitHub's publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Channel map

LIBERANDOS has ten letters and the supplied set has nine stems. This prototype groups **L + I** as one control; the remaining glyphs are individual controls. Mapping is at the top of `player.js`.

| Control | Original MP3 |
| --- | --- |
| LI | bass grunge.mp3 |
| B | drums1 and organ.mp3 |
| E | drums 2.mp3 |
| R | Conga.mp3 |
| A | Acoustic Guitar.mp3 |
| N | Elect Guitars.mp3 |
| D | banjo fiddle.mp3 |
| O | harmonies.mp3 |
| S | Lead Vox.mp3 |

The logo remains the supplied image, clipped into nine regions without redrawing the glyphs. Desktop assembles the horizontal wordmark; mobile uses a staggered three-row arrangement. Reduced-motion preferences disable flicker/drift.

## Audio inspection and looping

All files: stereo MP3, **48,000 Hz**, **192 kbps**, **1,062,208 bytes**, **44.088 seconds encoded**. Inspection found identical metadata: 528 priming frames, 2,112,925 valid frames, and 2,771 trailing padding frames. The useful region is **44.019270833 seconds**. Raw per-file inspection is saved in `audio-inspection.json`.

`audio-engine.js`:

- Fetches/decodes all nine after the first glyph interaction. Selections made while loading are retained. A failed load exposes Retry.
- Handles decoders returning either the full encoded buffer or the already-trimmed valid region. Unknown lengths fail explicitly instead of silently misaligning.
- Trims known encoder padding, then applies the same **60 ms raised-cosine tail/head crossfade** to each channel. This yields a **43.959270833-second** repeating buffer at 48 kHz. The overlap shortens the cycle by 60 ms; adjust `CROSSFADE_SECONDS` if musical listening suggests a different join.
- Starts every `AudioBufferSourceNode` at the same future audio timestamp and loops the prepared buffers natively. No JavaScript timer is needed at a boundary, so background timer throttling cannot accumulate drift.
- Leaves all sources running while toggling only gain, with smooth ~100 ms transitions. Relative stem levels are preserved; shared conservative headroom prevents clipping for any channel subset.

The original MP3 files are unchanged. Padding constants are specific to this supplied set: inspect new exports before replacing the audio. A splice prevents scheduling gaps/click discontinuities; it cannot guarantee that an arbitrary musical phrase resolves naturally. Final musical listening on actual phones/headphones remains advisable. OS audio interruptions may suspend playback; Resume or another glyph tap resumes the shared context.

Reference: [Web Audio looping](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loop).

## Verification

Chrome checks passed for no autoplay, nine identical start timestamps and buffer lengths, toggles, all-on/all-off status, pause/resume, keyboard input, mobile tap targets and no horizontal overflow, reduced motion, failed-load retry, and no page errors. Two complete cycles were rendered offline: repeated samples matched exactly; the full-mix boundary step measured 0.00939 before the master gain. Results are in `test-results.json`. Real iOS Safari and Android hardware have not been tested.

To rerun the optional browser checks with Node, Playwright installed, Chrome available, and the local server running:

```sh
node tests/browser.cjs
```

Set `PLAYWRIGHT_PATH` or `CHROME_PATH` if installed in nonstandard locations. The site itself needs neither dependency.

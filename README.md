# GeoRadios — Interactive 3D World Radio Globe (GitHub Pages Clone & Technical Research)

Spin the 3D Earth, click any cyan station dot or country cluster, and listen to live radio broadcasts from **15,998 stations across 205 countries**.

- **Live GitHub Pages Demo**: [`https://huangyingting.github.io/GeoRadios/`](https://huangyingting.github.io/GeoRadios/)
- **Reference Applications**:
  - [GeoRadios (`georadios.com`)](https://georadios.com/) & [Hacker News Launch Thread (`item?id=50054379`)](https://news.ycombinator.com/item?id=50054379)
  - [Radio Garden (`radio.garden`)](https://radio.garden/)
  - [Air Drift (`airdrift.stream`)](https://airdrift.stream/)

---

## Part 1: Architectural Research — How GeoRadios, Radio Garden & Air Drift Are Implemented

Using headless Playwright browser instrumentation, network trace capture, and bundle decompilation, we analyzed how `georadios.com`, `radio.garden`, and `airdrift.stream` are architected.

### 1. Comparative Architecture Overview

| Dimension | **GeoRadios (`georadios.com`)** | **Radio Garden (`radio.garden`)** | **Air Drift (`airdrift.stream`)** |
| :--- | :--- | :--- | :--- |
| **Frontend Stack** | React + Three.js + Zustand + Tailwind CSS + Vite | React + Redux + CesiumJS / custom WebGL tile globe | Vanilla ES Modules (`globe.js`, `player.js`, `visualizer.js`) + `globe.gl` (Three.js) |
| **Hosting Model** | **100% Static CDN** (pre-built JSON shards + live Radio-Browser fallback) | Proprietary backend API + regional licensing proxies (e.g. UK restrictions) | Static frontend querying `api.radio-browser.info` directly at runtime |
| **Station Dataset** | **15,998 HTTPS stations** (`10,157` with exact GPS coordinates + `5,841` in country clusters) | ~40,000 curated stations grouped strictly by city dot clusters | Top ~200 stations per country fetched dynamically from Radio-Browser |
| **Globe Rendering** | Custom GLSL Earth shader (`earth-2048.webp` + `lights-4096.webp` + real-time solar terminator + `borders.json`) | Multi-resolution satellite imagery tiles + HTML city markers | `three-globe` / `globe.gl` with `earth-blue-marble.jpg` & `earth-topology.png` |
| **Audio Pipeline** | HTML5 `<audio>` + `hls.js` + WebAudio `AnalyserNode` (`fftSize=1024`) with automatic non-CORS fallback + WebAudio FM tuning noise | HTML5 `<audio>` / HLS stream proxy with custom crossfade tuner | Dual `<audio>` elements (`audioA` / `audioB`) for crossfading + `hls.js` + stereo `ChannelSplitterNode` visualizer |
| **Visual Extras** | **Immersive Mode** (5 full-screen audio-reactive GLSL shaders) + **Wikipedia Place Explorer** (Geosearch + Wikimedia Commons photos) | Historical radio jingles, curated "garden" stories | **2D Canvas Overlay Visualizer** (Circular, Bars, Wave, Galaxy, Particles) + **Drift Mode** auto-hopper |

---

### 2. Deep Dive: How GeoRadios (`georadios.com`) Works Under the Hood

#### A. Static Sharded Data Pipeline (Zero Backend Server Required)
Rather than querying `radio-browser.info` for all 16,000 stations on page load (which would transfer >15 MB of verbose JSON and hit rate limits), GeoRadios pre-compiles a compact columnar index (`public/data/`):

1. **`data/meta.json` (97 B)**:
   ```json
   {"v":1,"generatedAt":"2026-10-16T04:17:11.685Z","stations":15998,"precise":10157,"countries":205}
   ```
2. **`data/stations.json` (1.4 MB raw / ~350 KB gzipped)**:
   - Deduplicates all genre tags (`tags: string[5098]`) and IANA timezones (`tz: string[225]`) into lookup arrays.
   - Encodes each station as a 9-element tuple:
     `[id, name, countryCode, lat, lng, preciseFlag(0|1), tagIndices[], votes, tzIndex]`
   - `id` is the first 10 hex characters of the Radio-Browser `stationuuid`.
3. **`data/details/<00..ff>.json` (256 hex-prefix shards, ~10 KB each)**:
   - Stream URLs, favicons, homepages, codecs, and bitrates are omitted from `stations.json` so initial startup stays fast.
   - When a user clicks station `0013eb822d`, the client fetches `data/details/00.json` (~10 KB) and looks up:
     `[uuid, streamUrl, homepage, favicon, region, codec, bitrate, hlsFlag]`.
4. **`data/borders.json` (98 KB)**:
   - Simplified Natural Earth country border polylines encoded as flat `[lng0, lat0, lng1, lat1, ...]` arrays and rendered as `THREE.LineSegments` at radius `1.0015`.
5. **`data/artists.json` (28 KB)**:
   - Maps 451 world artists (e.g., *Amália Rodrigues*, *Daft Punk*, *Fela Kuti*) to their associated genre tags so searching an artist filters the globe to stations playing those genres.

#### B. Custom Three.js Globe & GLSL Shaders
- **Coordinate System**: Unit sphere (`radius = 1.0`), perspective camera (`fov = 45°`, `distance = 1.08 .. 4.2`).
- **Seamless Equirectangular UV Sampling (`sampleSeamless`)**:
  Standard `atan(z, x)` produces a 1-pixel mipmap seam along the `±180°` antimeridian because `u` jumps from `1.0` to `0.0`. GeoRadios computes two wrapped UV candidates (`uA = fract(rawU)` and `uB = fract(rawU + 0.5) - 0.5`) and selects the one with smaller screen-space derivative `fwidth()`, completely eliminating the seam.
- **Real-Time Solar Terminator & City Lights**:
  Computes the subsolar point from the current UTC date/time using the solar declination & equation-of-time expansion, passing `uSunDir` into the Earth fragment shader. The night hemisphere blends NASA's `lights-4096.webp` warm city lights (`#ffd9a0`) while keeping oceans legible.
- **Limb-Faded Station Markers (`THREE.Points`)**:
  All 10,157 precise GPS stations are rendered in a single draw call at radius `1.004`. In the vertex shader, `vFacing = dot(worldNormal, viewDir)` measures whether a station is on the front hemisphere; the fragment shader discards back-facing points and applies `smoothstep(-0.05, 0.22, vFacing)` so dots fade smoothly at the horizon.
- **2° × 2° Spatial Hash Grid (`SpatialGrid`)**:
  Raycasting against 10,157 individual points on every mouse move is slow. Instead, GeoRadios raycasts against a single invisible sphere (`radius = 1.002`), converts the 3D hit point to `(lat, lng)`, and queries a 2°×2° spatial hash bucket (`floor((lat+90)/2):floor((lng+180)/2)`) in $O(1)$ time.

#### C. WebAudio Engine & Automatic CORS Fallback
Many live Icecast/Shoutcast streams omit `Access-Control-Allow-Origin` headers. If an `<audio>` element has `crossOrigin="anonymous"` set, the browser blocks non-CORS streams completely; if `crossOrigin` is omitted, `AudioContext.createMediaElementSource()` outputs silence due to media tainting.
- **Solution**: The audio engine first attempts playback with `crossOrigin="anonymous"` wired through `AudioContext -> MediaElementAudioSourceNode -> AnalyserNode(fftSize=1024) -> GainNode`.
- If the stream triggers an error before `onplaying`, it automatically retries with a clean, un-CORS'd `<audio>` element (`usingCorsWebAudio = false`) so **every station plays reliably**.
- When playing a non-CORS stream, the visualizer smoothly switches to a multi-sine harmonic envelope generator so audio-reactive visuals remain fluid.
- While connecting, a procedural WebAudio buffer fills 2 seconds of white noise routed through a `1400 Hz` `BiquadFilterNode` (`bandpass`, `Q = 0.9`) to create realistic FM tuning static.

#### D. Immersive Audio-Reactive Shaders
Switching from **Globe** to **Immersive** mode launches a dedicated WebGL pipeline with 5 presets:
1. **Flowing Waves**: Domain-warped 3-octave fractional Brownian motion (`fbm3`) driving an Inigo Quilez cosine palette.
2. **Neon Dusk**: Synthwave sun with scanline cuts over a rippled perspective ocean reflection.
3. **Ember**: Upward-advected turbulent FBM thermal plumes.
4. **Aurora**: Multi-layered polar curtain ribbons with vertical ray striations.
5. **3D Sculpture**: Subdivided `IcosahedronGeometry(1, 5)` displaced in the vertex shader via 3-octave 3D Ashima simplex noise (`snoise`) with finite-difference normal reconstruction and Fresnel rim lighting.

All 2D presets apply **Jimenez Interleaved Gradient Noise (`ign`)** weighted by luminance to prevent 8-bit color banding in dark gradients.

---

## Part 2: Custom Orbital Telemetry UI & Bilingual (`简体中文` / `EN`) Design

Instead of copying GeoRadios's floating pills and blocking center modal, this project implements a bespoke **Orbital Telemetry & Studio Deck** interface engineered for high information density:

- **Condensed Technical Typography**:
  - Uses **Barlow Semi Condensed** + **Noto Sans SC** for compact, high-legibility labels across Latin and CJK scripts, paired with **JetBrains Mono** (`tabular-nums`) for geographical coordinates (`38.72°N 009.14°W`), live UTC/local clocks, bitrate/codec badges, and station indices.
- **Unified Top Orbital Command Bar (`src/components/HeaderSearch.tsx`)**:
  - Integrates live station/country counters, a real-time UTC clock, an Omnibox search palette (`/` or `⌘K`) across stations/countries/genres/artists, inline segmented switches (`SAT | VEC`, `3D Globe | Shader Studio`, `FM` tuning static, 1-click `中文 | EN` switcher, `Saved / 电台库`), and a 1-click Quick Genre filter strip.
- **Non-Blocking Right-Hand Studio Inspector Rail (`src/components/Overlays.tsx`)**:
  - Replaces blocking center modals with a persistent 3-tab dock (`Signal & Place / 信号与人文`, `Directory / 频段名录`, `Saved / 收藏与足迹`) featuring a real-time **24-band HTML5 Canvas audio spectrum analyzer**, 12-column station telemetry grid, inline Wikipedia Destination Briefing with Wikimedia Commons photo filmstrip, and a tabular numbered station directory.
- **Precision Bottom Studio Transport Bar (`src/components/PlayerDock.tsx`)**:
  - Compact studio transport deck with live status LED, mini spectrum bars, coordinate/time/codec telemetry, `Prev / Play / Next Nearest / Random Hop (随机漫游)`, and quick controls.
- **Simplified Chinese (`简体中文`) & English Localization (`src/lib/i18n.ts`, `src/lib/wikipedia.ts`)**:
  - Full UI localization in Simplified Chinese (`zh`) and English (`en`), including `Intl.DisplayNames` country names and `zh-CN` Wikipedia REST variant headers (`Accept-Language: zh-CN,zh-Hans`).

---

## Part 3: Running & Deploying This Clone

### Local Development

```bash
npm install
npm run dev
```

### Production Build (GitHub Pages Compatible)

```bash
npm run build
npm run preview
```

Vite is configured with `base: './'` and all asset/data fetchers resolve relative to `import.meta.env.BASE_URL`, so the built `dist/` folder works both at a root domain (`/`) and under a GitHub Pages project subpath (`/GeoRadios/`).

### Refreshing the Station Snapshot from Radio-Browser

```bash
npm run refresh:data
```
This runs `scripts/refresh-stations.mjs` to pull the latest HTTPS stations from `all.api.radio-browser.info` and rebuild `public/data/`.

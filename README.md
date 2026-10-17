# AuraFM — Interactive 3D World Radio & Planetary Atmosphere Soundscape

Spin the 3D Earth, click any cyan station dot or country cluster, and listen to live radio broadcasts from **15,998 stations across 205 countries** surrounded by a real-time audio-reactive Rayleigh atmosphere & aurora.

- **Live App**: [`https://aurafm.genisisiq.com/`](https://aurafm.genisisiq.com/) ([`https://vibewatch.github.io/AuraFM/`](https://vibewatch.github.io/AuraFM/))
- **GitHub Repository**: [`https://github.com/vibewatch/AuraFM`](https://github.com/vibewatch/AuraFM)
- **Reference Inspirations**:
  - [Radio Garden (`radio.garden`)](https://radio.garden/)
  - [Air Drift (`airdrift.stream`)](https://airdrift.stream/)

---

## Part 1: Architectural Overview

### 1. Core Architecture

| Dimension | **AuraFM** | **Radio Garden (`radio.garden`)** | **Air Drift (`airdrift.stream`)** |
| :--- | :--- | :--- | :--- |
| **Frontend Stack** | React + Three.js + Zustand + Tailwind CSS + Vite | React + Redux + CesiumJS / custom WebGL tile globe | Vanilla ES Modules (`globe.js`, `player.js`, `visualizer.js`) + `globe.gl` (Three.js) |
| **Hosting Model** | **100% Static CDN** (pre-built JSON shards + live Radio-Browser fallback) | Proprietary backend API + regional licensing proxies (e.g. UK restrictions) | Static frontend querying `api.radio-browser.info` directly at runtime |
| **Station Dataset** | **15,998 HTTPS stations** (`10,157` with exact GPS coordinates + `5,841` in country clusters) | ~40,000 curated stations grouped strictly by city dot clusters | Top ~200 stations per country fetched dynamically from Radio-Browser |
| **Globe Rendering** | Custom GLSL Earth shader (`earth-2048.webp` + `lights-4096.webp` + real-time solar terminator + `borders.json`) | Multi-resolution satellite imagery tiles + HTML city markers | `three-globe` / `globe.gl` with `earth-blue-marble.jpg` & `earth-topology.png` |
| **Audio Pipeline** | HTML5 `<audio>` + `hls.js` + WebAudio `AnalyserNode` (`fftSize=1024`) with automatic non-CORS fallback + WebAudio FM tuning noise | HTML5 `<audio>` / HLS stream proxy with custom crossfade tuner | Dual `<audio>` elements (`audioA` / `audioB`) for crossfading + `hls.js` + stereo `ChannelSplitterNode` visualizer |
| **Visual Extras** | **Planetary Rayleigh Atmosphere & Orbital Aurora** (5 atmospheric palettes) + **Wikipedia Place Explorer** (Geosearch + Wikimedia Commons photos) | Historical radio jingles, curated "garden" stories | **2D Canvas Overlay Visualizer** (Circular, Bars, Wave, Galaxy, Particles) + **Drift Mode** auto-hopper |

---

### 2. Deep Dive: How AuraFM Works Under the Hood

#### A. Static Sharded Data Pipeline (Zero Backend Server Required)
Rather than querying `radio-browser.info` for all 16,000 stations on page load (which would transfer >15 MB of verbose JSON and hit rate limits), AuraFM pre-compiles a compact columnar index (`public/data/`):

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
  Standard `atan(z, x)` produces a 1-pixel mipmap seam along the `±180°` antimeridian because `u` jumps from `1.0` to `0.0`. AuraFM computes two wrapped UV candidates (`uA = fract(rawU)` and `uB = fract(rawU + 0.5) - 0.5`) and selects the one with smaller screen-space derivative `fwidth()`, completely eliminating the seam.
- **Real-Time Solar Terminator & City Lights**:
  Computes the subsolar point from the current UTC date/time using the solar declination & equation-of-time expansion, passing `uSunDir` into the Earth fragment shader. The night hemisphere blends NASA's `lights-4096.webp` warm city lights (`#ffd9a0`) while keeping oceans legible.
- **Limb-Faded Station Markers (`THREE.Points`)**:
  All 10,157 precise GPS stations are rendered in a single draw call at radius `1.004`. In the vertex shader, `vFacing = dot(worldNormal, viewDir)` measures whether a station is on the front hemisphere; the fragment shader discards back-facing points and applies `smoothstep(-0.05, 0.22, vFacing)` so dots fade smoothly at the horizon.
- **2° × 2° Spatial Hash Grid (`SpatialGrid`)**:
  Raycasting against 10,157 individual points on every mouse move is slow. Instead, AuraFM raycasts against a single invisible sphere (`radius = 1.002`), converts the 3D hit point to `(lat, lng)`, and queries a 2°×2° spatial hash bucket (`floor((lat+90)/2):floor((lng+180)/2)`) in $O(1)$ time.

#### C. WebAudio Engine & Automatic CORS Fallback
Many live Icecast/Shoutcast streams omit `Access-Control-Allow-Origin` headers. If an `<audio>` element has `crossOrigin="anonymous"` set, the browser blocks non-CORS streams completely; if `crossOrigin` is omitted, `AudioContext.createMediaElementSource()` outputs silence due to media tainting.
- **Solution**: The audio engine first attempts playback with `crossOrigin="anonymous"` wired through `AudioContext -> MediaElementAudioSourceNode -> AnalyserNode(fftSize=1024) -> GainNode`.
- If the stream triggers an error before `onplaying`, it automatically retries with a clean, un-CORS'd `<audio>` element (`usingCorsWebAudio = false`) so **every station plays reliably**.
- When playing a non-CORS stream, the visualizer smoothly switches to a multi-sine harmonic envelope generator so audio-reactive visuals remain fluid.
- While connecting, a procedural WebAudio buffer fills 2 seconds of white noise routed through a `1400 Hz` `BiquadFilterNode` (`bandpass`, `Q = 0.9`) to create realistic FM tuning static.

#### D. Planetary Rayleigh Atmosphere & Orbital Aurora Shaders
Around the 3D Earth's silhouette, AuraFM renders a depth-tested, monotonically decaying Rayleigh scattering & ionosphere aurora shader with 5 atmospheric palettes:
1. **Atmosphere (`蔚蓝大气`)**
2. **Aurora (`极地极光`)**
3. **Terminator (`晨昏流金`)**
4. **Magneto (`深空磁层`)**
5. **Ionosphere (`电离辉光`)**

---

## Part 2: Spatial Glass UI & Bilingual (`简体中文` / `EN`) Design

AuraFM implements a floating **Spatial Glass Capsule** interface engineered for both desktop and mobile screens:

- **Typography**:
  - Uses **Plus Jakarta Sans** + **Inter** + **HarmonyOS Sans SC / PingFang SC** for crisp legibility across Latin and Simplified Chinese scripts, paired with **JetBrains Mono** (`tabular-nums`) for live station telemetry.
- **Floating Top Capsules (`src/components/HeaderSearch.tsx`)**:
  - Integrates the **AuraFM** brand pill, a Spotlight search & mood capsule (`/` or `⌘K`), and a spatial control capsule (Planetary Aura theme cycler, `Satellite / Minimal` surface toggle, `Saved / 电台库`, and 1-click `中文 / EN` language switch).
- **Floating Magazine Story & Channel Card (`src/components/Overlays.tsx`)**:
  - Collapsible floating glass card (`Story / 城市人文`, `Channels / 频道列表`, `Saved / 我的收藏`) featuring Wikipedia Destination Briefings with Wikimedia Commons photo carousels.
- **Sculptural Bottom Player Dock (`src/components/PlayerDock.tsx`)**:
  - Floating capsule player with vinyl station avatar, mini spectrum bars, `Prev / Play / Next Nearest / Random Hop (随机漫游)`, and quick controls.

---

## Part 3: Running & Deploying AuraFM

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

Vite is configured with `base: './'` and all asset/data fetchers resolve relative to `import.meta.env.BASE_URL`, so the built `dist/` folder works both at a root domain (`/`) and under a GitHub Pages project subpath (`/AuraFM/`).

### Refreshing the Station Snapshot from Radio-Browser

```bash
npm run refresh:data
```
This runs `scripts/refresh-stations.mjs` to pull the latest HTTPS stations from `all.api.radio-browser.info` and rebuild `public/data/`.

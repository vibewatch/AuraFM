import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import {
  buildArcPoints,
  getSunDirection,
  latLngToVec3,
  slerpVec3,
  vec3ToLatLng,
} from '../lib/geo';
import { getTextureUrl } from '../lib/data';
import { audioEngine } from '../lib/audio';
import { countryCodeToFlag, getCountryName } from '../lib/i18n';
import { ImmersivePreset, StationSummary } from '../types';

const AURA_PALETTES: Record<ImmersivePreset, [string, string, string]> = {
  waves: ['#22d3ee', '#3b82f6', '#34d399'],      // 星海流光 (Ocean Cyan & Mint)
  aurora: ['#10b981', '#06b6d4', '#a855f7'],     // 极光幻境 (Emerald, Cyan & Violet)
  dusk: ['#ec4899', '#6366f1', '#f43f5e'],       // 星云紫韵 (Neon Rose & Indigo)
  ember: ['#f59e0b', '#fb7185', '#fde047'],      // 日冕金辉 (Solar Gold & Coral)
  sculpture: ['#2dd4bf', '#e879f9', '#38bdf8'],  // 赛博霓虹 (Cyber Turquoise & Fuchsia)
};

const PLANETARY_CORONA_VERTEX = /* glsl */ `
  varying vec2 vPlanePos;
  void main() {
    vPlanePos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PLANETARY_CORONA_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vPlanePos;

  uniform float uTime;
  uniform float uCameraDist;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uPulse;
  uniform float uPlaying;
  uniform vec2 uActiveDir;
  uniform vec3 uColPrimary;
  uniform vec3 uColSecondary;
  uniform vec3 uColAccent;

  const float PI = 3.141592653589793;
  const float TAU = 6.283185307179586;

  void main() {
    float r = length(vPlanePos);
    float rLimb = uCameraDist / sqrt(max(0.18, uCameraDist * uCameraDist - 1.0));
    float d = r - rLimb;

    // Fade smoothly just inside the Earth silhouette so the limb transition is seamless
    float innerMask = smoothstep(-0.025, 0.003, d);
    if (innerMask <= 0.001 || d > 0.55) discard;

    float theta = atan(vPlanePos.y, vPlanePos.x);
    vec2 dir2D = r > 0.0001 ? vPlanePos / r : vec2(1.0, 0.0);

    // Directional focus toward the currently broadcasting station on the globe
    float stationFocus = 0.5 + 0.5 * dot(dir2D, uActiveDir);
    float focusBoost = mix(1.0, 0.85 + 0.42 * pow(stationFocus, 2.0), uPlaying);

    // Seamless periodic angular waves around the 360-degree planetary circumference
    float w1 = sin(theta * 3.0 + uTime * 0.90) * 0.45
             + cos(theta * 5.0 - uTime * 1.25) * 0.35
             + sin(theta * 9.0 + uTime * 1.80) * 0.20;

    float w2 = cos(theta * 4.0 - uTime * 1.05) * 0.45
             + sin(theta * 7.0 + uTime * 1.50) * 0.35
             + cos(theta * 13.0 - uTime * 2.20) * 0.20;

    float w3 = sin(theta * 6.0 + uTime * 1.35) * 0.50
             + cos(theta * 11.0 + uTime * 2.05) * 0.30
             + sin(theta * 17.0 - uTime * 2.70) * 0.20;

    float wHigh = 0.5 + 0.5 * sin(theta * 24.0 + uTime * 2.8 + w1 * 2.0);

    float energyScale = (0.55 + 0.45 * uPlaying) * focusBoost;

    // 1. Soft Atmospheric Horizon Halo hugging the Earth
    float atmoDecay = exp(-max(d, 0.0) * (10.5 - uBass * 3.0));
    vec3 atmoCol = mix(uColSecondary, uColPrimary, 0.5 + 0.5 * sin(theta * 2.0 + uTime * 0.45));
    vec3 color = atmoCol * atmoDecay * (0.34 + uBass * 0.32);

    // 2. Three Intertwined Harmonic Soundwave Strings & Translucent Aurora Veil around the Earth
    float reach1 = (0.042 + (0.048 + 0.095 * uBass + 0.045 * uMid) * (0.52 + 0.48 * w1)) * energyScale;
    float reach2 = (0.068 + (0.058 + 0.085 * uMid + 0.065 * uHigh + 0.045 * uPulse) * (0.52 + 0.48 * w2)) * energyScale;
    float reach3 = (0.095 + (0.065 + 0.075 * uHigh + 0.060 * uBass) * (0.52 + 0.48 * w3)) * energyScale;

    float veil1 = (1.0 - smoothstep(0.0, reach1, max(d, 0.0))) * smoothstep(-0.005, 0.015, d);
    float string1 = exp(-pow((d - reach1) / 0.0055, 2.0));

    float veil2 = (1.0 - smoothstep(0.0, reach2, max(d, 0.0))) * smoothstep(0.0, 0.02, d);
    float string2 = exp(-pow((d - reach2) / 0.0060, 2.0));

    float string3 = exp(-pow((d - reach3) / 0.0050, 2.0));

    color += uColPrimary * (veil1 * 0.18 + string1 * (0.78 + uBass * 0.55));
    color += uColAccent * (veil2 * 0.12 + string2 * (0.64 + uMid * 0.55));
    color += mix(uColSecondary, vec3(1.0), 0.35) * (string3 * (0.48 + uHigh * 0.55));

    // 3. 144 Ultra-Fine Radial Acoustic Needles with Starlight Tips around the Planet
    float numBars = 144.0;
    float barPhase = (theta + PI) / TAU * numBars;
    float barIdx = floor(barPhase);
    float barLocal = fract(barPhase) - 0.5;
    float barProfile = exp(-barLocal * barLocal * 105.0);

    float barSpectrum =
      0.28 +
      0.35 * (0.5 + 0.5 * sin(barIdx * 0.42 + uTime * 2.4)) * (0.40 + uBass * 1.10) +
      0.22 * (0.5 + 0.5 * cos(barIdx * 0.91 - uTime * 3.1)) * (0.35 + uMid * 1.15) +
      0.15 * wHigh * (0.30 + uHigh * 1.25);

    float barHeight = (0.028 + barSpectrum * (0.095 + 0.095 * uPlaying + 0.045 * uPulse)) * focusBoost;
    float barMask = barProfile * smoothstep(0.004, 0.016, d) * (1.0 - smoothstep(barHeight * 0.75, barHeight, d));
    float barTip = barProfile * exp(-pow((d - barHeight) / 0.0065, 2.0)) * (0.55 + 0.65 * uPlaying);

    vec3 barCol = mix(uColPrimary, uColAccent, clamp(d / max(0.05, barHeight), 0.0, 1.0));
    color += barCol * barMask * (0.36 + 0.38 * uPlaying);
    color += mix(uColAccent, vec3(1.0), 0.55) * barTip * 0.72;

    // 4. Subtle Concentric Planetary Soundwave Ripples
    float rippleWave = 0.5 + 0.5 * sin(max(d, 0.0) * 58.0 - uTime * 3.0 + w1 * 1.2);
    float rippleEnvelope = smoothstep(0.02, 0.07, d) * exp(-max(d, 0.0) * 9.5);
    color += mix(uColSecondary, uColAccent, 0.5) * pow(rippleWave, 5.0) * rippleEnvelope * (0.16 + 0.28 * uBass + 0.22 * uPulse);

    // Filmic tone-mapping & outer fade so colors remain jewel-like and never clip
    float outerFade = 1.0 - smoothstep(0.24, 0.48, d);
    color *= innerMask * outerFade;
    color = color / (1.0 + color * 0.48);

    float alpha = clamp(length(color) * 0.92, 0.0, 0.88);
    gl_FragColor = vec4(color, alpha);
  }
`;

const EARTH_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const EARTH_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uLandTex;
  uniform sampler2D uNightTex;
  uniform vec3 uSunDir;
  uniform float uLandMix;
  uniform float uNightMix;
  uniform vec3 uOceanDeep;
  uniform vec3 uOceanMid;
  uniform vec3 uRimColor;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  const float PI = 3.141592653589793;

  vec4 sampleSeamless(sampler2D tex, vec3 p) {
    vec3 d = normalize(p);
    float lng = atan(-d.z, d.x) / (2.0 * PI);
    float uA = lng + 0.5;
    float uB = fract(lng) + 0.5;
    float u = (fwidth(uA) < 0.5) ? uA : uB;
    float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;
    return texture2D(tex, vec2(u, v));
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 worldNormal = normalize(vWorldPosition);

    float facing = max(dot(N, V), 0.0);
    vec3 ocean = mix(uOceanDeep, uOceanMid, 0.55 + 0.45 * facing);

    vec4 landTexel = sampleSeamless(uLandTex, vPosition);
    vec3 landRgb = landTexel.rgb * 0.95 * (0.55 + 0.45 * facing);
    float landAlpha = landTexel.a;
    vec3 color = mix(ocean, landRgb, landAlpha * uLandMix);

    // Solar day/night terminator
    float sunDot = dot(worldNormal, normalize(uSunDir));
    float day = smoothstep(-0.12, 0.18, sunDot);
    float nightDim = mix(0.82, 0.52, landAlpha);
    color *= mix(1.0, mix(nightDim, 1.0, day), uLandMix);

    // Warm city lights on the night hemisphere
    if (uNightMix > 0.01 && day < 0.999) {
      float lights = sampleSeamless(uNightTex, vPosition).r;
      color += vec3(1.0, 0.85, 0.63) * lights * 1.3 * (1.0 - day) * uNightMix * uLandMix;
    }

    // Fresnel atmospheric rim
    float rim = pow(1.0 - facing, 2.5);
    color = mix(color, uRimColor, rim * 0.65);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 V = normalize(cameraPosition - vWorldPosition);
    float rim = pow(clamp(1.0 + dot(vNormal, V), 0.0, 1.0), 2.4);
    gl_FragColor = vec4(vec3(0.35, 0.72, 0.94), rim * 0.42);
  }
`;

const STATION_POINTS_VERTEX = /* glsl */ `
  attribute float aState; // 1.0 = normal, 2.0 = hovered, 0.15 = dimmed by filter, 3.0 = favorite
  varying float vState;
  varying float vFacing;
  uniform float uPixelRatio;
  uniform float uCameraDist;

  void main() {
    vState = aState;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 worldNormal = normalize(wp.xyz);
    vec3 viewDir = normalize(cameraPosition - wp.xyz);
    vFacing = dot(worldNormal, viewDir);

    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;

    float zoomScale = clamp(2.4 / max(uCameraDist, 1.05), 0.75, 2.1);
    float baseSize = 6.5 * zoomScale;
    if (aState > 2.5) {
      baseSize = 10.5 * zoomScale;
    } else if (aState > 1.5) {
      baseSize = 11.5 * zoomScale;
    } else if (aState < 0.5) {
      baseSize = 4.0 * zoomScale;
    }
    gl_PointSize = baseSize * uPixelRatio;
  }
`;

const STATION_POINTS_FRAGMENT = /* glsl */ `
  precision highp float;
  varying float vState;
  varying float vFacing;

  void main() {
    if (vFacing < -0.05) discard;
    float limbAlpha = smoothstep(-0.05, 0.22, vFacing);
    vec2 c = gl_PointCoord - vec2(0.5);
    float r = length(c) * 2.0;
    if (r > 1.0) discard;

    float outerAlpha = 1.0 - smoothstep(0.78, 1.0, r);
    float innerMask = 1.0 - smoothstep(0.48, 0.68, r);

    vec3 fillCol = vec3(0.133, 0.827, 0.933); // #22d3ee cyan
    if (vState > 2.5) {
      fillCol = vec3(0.961, 0.620, 0.043); // #f59e0b amber favorite
    } else if (vState > 1.5) {
      fillCol = vec3(0.40, 0.95, 1.0); // hovered bright cyan
    }
    vec3 outlineCol = vec3(0.008, 0.024, 0.090); // #020617
    vec3 col = mix(outlineCol, fillCol, innerMask);

    float filterAlpha = (vState < 0.5) ? 0.16 : 0.95;
    gl_FragColor = vec4(col, outerAlpha * limbAlpha * filterAlpha);
  }
`;

interface ScreenBadge {
  countryCode: string;
  count: number;
  x: number;
  y: number;
}

export const GlobeCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const preciseStations = useAppStore((s) => s.preciseStations);
  const clusters = useAppStore((s) => s.clusters);
  const borders = useAppStore((s) => s.borders);
  const spatialGrid = useAppStore((s) => s.spatialGrid);
  const globeView = useAppStore((s) => s.globeView);
  const currentStation = useAppStore((s) => s.currentStation);
  const favorites = useAppStore((s) => s.favorites);
  const filteredStationIds = useAppStore((s) => s.filteredStationIds);
  const cameraTarget = useAppStore((s) => s.cameraTarget);
  const flightArc = useAppStore((s) => s.flightArc);
  const language = useAppStore((s) => s.language);
  const immersivePreset = useAppStore((s) => s.immersivePreset);
  const playbackStatus = useAppStore((s) => s.playbackStatus);

  const selectStation = useAppStore((s) => s.selectStation);
  const setSpotStations = useAppStore((s) => s.setSpotStations);
  const setSelectedCountryCode = useAppStore((s) => s.setSelectedCountryCode);

  const [hoveredInfo, setHoveredInfo] = useState<{
    x: number;
    y: number;
    title: string;
    subtitle: string;
  } | null>(null);
  const [badges, setBadges] = useState<ScreenBadge[]>([]);

  // Mutable refs for access inside requestAnimationFrame without recreating WebGL context
  const stateRef = useRef({
    preciseStations,
    clusters,
    spatialGrid,
    globeView,
    currentStation,
    favorites,
    filteredStationIds,
    language,
    immersivePreset,
    playbackStatus,
    hoveredStationIdx: -1,
  });
  stateRef.current = {
    ...stateRef.current,
    preciseStations,
    clusters,
    spatialGrid,
    globeView,
    currentStation,
    favorites,
    filteredStationIds,
    language,
    immersivePreset,
    playbackStatus,
  };

  // Three.js object refs
  const threeRef = useRef<{
    earthUniforms?: {
      uLandTex: { value: THREE.Texture };
      uNightTex: { value: THREE.Texture };
      uSunDir: { value: THREE.Vector3 };
      uLandMix: { value: number };
      uNightMix: { value: number };
      uOceanDeep: { value: THREE.Color };
      uOceanMid: { value: THREE.Color };
      uRimColor: { value: THREE.Color };
    };
    stationGeo?: THREE.BufferGeometry;
    borderGroup?: THREE.Group;
    arcLine?: THREE.Line;
    arcStartTime?: number;
    arcTotalPoints?: number;
    selectionGroup?: THREE.Group;
    cameraSpherical: {
      lat: number;
      lng: number;
      distance: number;
      velLat: number;
      velLng: number;
    };
    flightAnim: {
      active: boolean;
      startTime: number;
      duration: number;
      fromLat: number;
      fromLng: number;
      fromDist: number;
      toLat: number;
      toLng: number;
      toDist: number;
      fullSpin: boolean;
    } | null;
  }>({
    cameraSpherical: {
      lat: 22,
      lng: -15,
      distance: 3.35,
      velLat: 0,
      velLng: 0.04,
    },
    flightAnim: null,
  });

  // Main WebGL initialization
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor('#020617', 1);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / Math.max(1, height), 0.05, 25);

    // Subtle starfield background
    const starCount = 1200;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 12 + Math.random() * 6;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: '#94a3b8',
      size: 1.4,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.5,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Default 1x1 canvas texture before NASA textures finish loading
    const placeholderCanvas = document.createElement('canvas');
    placeholderCanvas.width = 2;
    placeholderCanvas.height = 2;
    const pCtx = placeholderCanvas.getContext('2d');
    if (pCtx) {
      pCtx.fillStyle = '#163a63';
      pCtx.fillRect(0, 0, 2, 2);
    }
    const placeholderTex = new THREE.CanvasTexture(placeholderCanvas);

    const earthUniforms = {
      uLandTex: { value: placeholderTex as THREE.Texture },
      uNightTex: { value: placeholderTex as THREE.Texture },
      uSunDir: { value: getSunDirection(new Date()) },
      uLandMix: { value: stateRef.current.globeView === 'realistic' ? 1.0 : 0.0 },
      uNightMix: { value: stateRef.current.globeView === 'realistic' ? 1.0 : 0.0 },
      uOceanDeep: { value: new THREE.Color('#0c2340') },
      uOceanMid: { value: new THREE.Color('#163a63') },
      uRimColor: { value: new THREE.Color('#3d6fae') },
    };
    threeRef.current.earthUniforms = earthUniforms;

    const loader = new THREE.TextureLoader();
    loader.load(getTextureUrl('earth-2048.webp'), (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      earthUniforms.uLandTex.value = tex;
    });
    loader.load(getTextureUrl('lights-4096.webp'), (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      earthUniforms.uNightTex.value = tex;
    });

    const earthGeo = new THREE.SphereGeometry(1, 64, 64);
    const earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERTEX,
      fragmentShader: EARTH_FRAGMENT,
      uniforms: earthUniforms,
      extensions: { derivatives: true } as any,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.renderOrder = 1;
    scene.add(earthMesh);

    // BackSide Fresnel atmosphere halo
    const atmoGeo = new THREE.SphereGeometry(1.09, 48, 48);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    atmoMesh.renderOrder = 2;
    scene.add(atmoMesh);

    // 360-degree Planetary Sonic Corona around the Earth's outer perimeter
    const initColors = AURA_PALETTES[stateRef.current.immersivePreset] || AURA_PALETTES.waves;
    const coronaUniforms = {
      uTime: { value: 0 },
      uCameraDist: { value: 2.75 },
      uBass: { value: 0.25 },
      uMid: { value: 0.22 },
      uHigh: { value: 0.18 },
      uPulse: { value: 0.1 },
      uPlaying: { value: 0.35 },
      uActiveDir: { value: new THREE.Vector2(0.8, 0.6) },
      uColPrimary: { value: new THREE.Color(initColors[0]) },
      uColSecondary: { value: new THREE.Color(initColors[1]) },
      uColAccent: { value: new THREE.Color(initColors[2]) },
    };
    const coronaGeo = new THREE.PlaneGeometry(4.8, 4.8);
    const coronaMat = new THREE.ShaderMaterial({
      vertexShader: PLANETARY_CORONA_VERTEX,
      fragmentShader: PLANETARY_CORONA_FRAGMENT,
      uniforms: coronaUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    coronaMesh.renderOrder = -1;
    scene.add(coronaMesh);

    // 3D Orbital Soundwave Rings encircling the planet in 3D space
    const ORBIT_SEGMENTS = 180;
    const createOrbitalRing = (colorHex: string, opacity: number, tiltX: number, tiltZ: number) => {
      const positions = new Float32Array(ORBIT_SEGMENTS * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const loop = new THREE.LineLoop(geo, mat);
      loop.rotation.x = tiltX;
      loop.rotation.z = tiltZ;
      loop.renderOrder = 3;
      scene.add(loop);
      return { loop, geo, mat };
    };
    const orbitalRingA = createOrbitalRing(initColors[0], 0.42, 0.36, 0.22);
    const orbitalRingB = createOrbitalRing(initColors[2], 0.28, -0.42, -0.28);

    // Country borders group
    const borderGroup = new THREE.Group();
    scene.add(borderGroup);
    threeRef.current.borderGroup = borderGroup;

    // Precise stations Points
    const stationGeo = new THREE.BufferGeometry();
    const stationUniforms = {
      uPixelRatio: { value: pixelRatio },
      uCameraDist: { value: 2.75 },
    };
    const stationMat = new THREE.ShaderMaterial({
      vertexShader: STATION_POINTS_VERTEX,
      fragmentShader: STATION_POINTS_FRAGMENT,
      uniforms: stationUniforms,
      transparent: true,
      depthWrite: false,
    });
    const stationPoints = new THREE.Points(stationGeo, stationMat);
    scene.add(stationPoints);
    threeRef.current.stationGeo = stationGeo;

    // Selection beacon (pulsing green ring + bright center dot)
    const selectionGroup = new THREE.Group();
    selectionGroup.visible = false;
    const ringGeo = new THREE.RingGeometry(0.012, 0.018, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#4ade80',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    const coreGeo = new THREE.CircleGeometry(0.008, 24);
    const coreMat = new THREE.MeshBasicMaterial({
      color: '#4ade80',
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    selectionGroup.add(ringMesh);
    selectionGroup.add(coreMesh);
    scene.add(selectionGroup);
    threeRef.current.selectionGroup = selectionGroup;

    // Flight arc line
    const arcGeo = new THREE.BufferGeometry();
    const arcMat = new THREE.LineBasicMaterial({
      color: '#22d3ee',
      transparent: true,
      opacity: 0.75,
    });
    const arcLine = new THREE.Line(arcGeo, arcMat);
    arcLine.visible = false;
    scene.add(arcLine);
    threeRef.current.arcLine = arcLine;

    // Invisible picking sphere for raycasting
    const pickSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.002, 32, 32),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    scene.add(pickSphere);
    const raycaster = new THREE.Raycaster();

    // Pointer interaction state
    let isDragging = false;
    let pointerDownPos = { x: 0, y: 0 };
    let prevPointerPos = { x: 0, y: 0 };
    let totalDragDist = 0;

    const getLatLngAtScreenXY = (clientX: number, clientY: number): { lat: number; lng: number } | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(pickSphere, false);
      if (hits.length === 0) return null;
      const p = hits[0].point;
      return vec3ToLatLng(p.x, p.y, p.z);
    };

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      totalDragDist = 0;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      prevPointerPos = { x: e.clientX, y: e.clientY };
      threeRef.current.flightAnim = null;
      threeRef.current.cameraSpherical.velLat = 0;
      threeRef.current.cameraSpherical.velLng = 0;
    };

    const onPointerMove = (e: PointerEvent) => {
      const cs = threeRef.current.cameraSpherical;
      if (isDragging) {
        const dx = e.clientX - prevPointerPos.x;
        const dy = e.clientY - prevPointerPos.y;
        prevPointerPos = { x: e.clientX, y: e.clientY };
        totalDragDist += Math.hypot(dx, dy);

        const sensitivity = 0.14 * (cs.distance / 2.75);
        cs.lng -= dx * sensitivity;
        cs.lat = Math.max(-82, Math.min(82, cs.lat + dy * sensitivity));
        cs.velLng = -dx * sensitivity * 0.35;
        cs.velLat = dy * sensitivity * 0.35;
        setHoveredInfo(null);
        return;
      }

      // Hover picking
      const coords = getLatLngAtScreenXY(e.clientX, e.clientY);
      const grid = stateRef.current.spatialGrid;
      if (!coords || !grid) {
        stateRef.current.hoveredStationIdx = -1;
        setHoveredInfo(null);
        renderer.domElement.style.cursor = 'grab';
        return;
      }

      const pickRadiusDeg = Math.max(0.45, Math.min(2.2, (cs.distance - 1.0) * 0.95));
      const nearStations = grid.findStationsNear(
        coords.lat,
        coords.lng,
        pickRadiusDeg,
        stateRef.current.filteredStationIds
      );

      if (nearStations.length > 0) {
        const top = nearStations[0];
        stateRef.current.hoveredStationIdx = top.index;
        const flag = countryCodeToFlag(top.station.countryCode);
        const country = getCountryName(top.station.countryCode, stateRef.current.language);
        setHoveredInfo({
          x: e.clientX,
          y: e.clientY,
          title: top.station.name,
          subtitle:
            nearStations.length > 1
              ? `${flag} ${country} · +${nearStations.length - 1} more nearby`
              : `${flag} ${top.station.region ? `${top.station.region}, ` : ''}${country}`,
        });
        renderer.domElement.style.cursor = 'pointer';
        return;
      }

      stateRef.current.hoveredStationIdx = -1;
      const nearCluster = grid.findClusterNear(
        coords.lat,
        coords.lng,
        pickRadiusDeg * 1.4,
        stateRef.current.filteredStationIds
      );
      if (nearCluster) {
        const flag = countryCodeToFlag(nearCluster.cluster.countryCode);
        const country = getCountryName(nearCluster.cluster.countryCode, stateRef.current.language);
        setHoveredInfo({
          x: e.clientX,
          y: e.clientY,
          title: `${flag} ${country}`,
          subtitle: `${nearCluster.cluster.stations.length} stations`,
        });
        renderer.domElement.style.cursor = 'pointer';
        return;
      }

      setHoveredInfo(null);
      renderer.domElement.style.cursor = 'grab';
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      const clickDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (clickDist > 6 || totalDragDist > 8) return;

      const coords = getLatLngAtScreenXY(e.clientX, e.clientY);
      const grid = stateRef.current.spatialGrid;
      if (!coords || !grid) return;

      const cs = threeRef.current.cameraSpherical;
      const pickRadiusDeg = Math.max(0.55, Math.min(2.5, (cs.distance - 1.0) * 1.1));
      const nearStations = grid.findStationsNear(
        coords.lat,
        coords.lng,
        pickRadiusDeg,
        stateRef.current.filteredStationIds
      );

      if (nearStations.length > 0) {
        const primary = nearStations[0].station;
        // Group stations that are very close to the primary station
        const colocated: StationSummary[] = [];
        for (const item of nearStations) {
          if (item.distanceRad < 0.008) {
            colocated.push(item.station);
          }
        }
        if (colocated.length > 1) {
          setSpotStations(colocated);
        } else {
          selectStation(primary, { pushHistory: true, flyTo: false });
        }
        return;
      }

      const nearCluster = grid.findClusterNear(
        coords.lat,
        coords.lng,
        pickRadiusDeg * 1.6,
        stateRef.current.filteredStationIds
      );
      if (nearCluster) {
        setSelectedCountryCode(nearCluster.cluster.countryCode);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cs = threeRef.current.cameraSpherical;
      const zoomDelta = e.deltaY * 0.0012 * (cs.distance - 0.85);
      cs.distance = Math.max(1.08, Math.min(4.2, cs.distance + zoomDelta));
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    let rafId = 0;
    let lastBadgeUpdate = 0;
    let prevHoveredIdx = -1;

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const cs = threeRef.current.cameraSpherical;
      const anim = threeRef.current.flightAnim;

      // Update camera flight or inertia
      if (anim && anim.active) {
        const rawT = Math.min(1, (now - anim.startTime) / anim.duration);
        const ease =
          rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        if (anim.fullSpin) {
          cs.lat = anim.fromLat + (anim.toLat - anim.fromLat) * ease;
          let dLng = anim.toLng - anim.fromLng;
          if (dLng < 0) dLng += 360;
          cs.lng = anim.fromLng + (dLng + 360) * ease;
          const peakMid = Math.sin(rawT * Math.PI) * 0.55;
          cs.distance =
            anim.fromDist + (anim.toDist - anim.fromDist) * ease + peakMid;
        } else {
          const uA = latLngToVec3(anim.fromLat, anim.fromLng, 1);
          const uB = latLngToVec3(anim.toLat, anim.toLng, 1);
          const uCur = slerpVec3(uA, uB, ease);
          const ll = vec3ToLatLng(uCur[0], uCur[1], uCur[2]);
          cs.lat = ll.lat;
          cs.lng = ll.lng;
          cs.distance = anim.fromDist + (anim.toDist - anim.fromDist) * ease;
        }

        if (rawT >= 1) {
          anim.active = false;
        }
      } else if (!isDragging) {
        cs.lat = Math.max(-82, Math.min(82, cs.lat + cs.velLat));
        cs.lng += cs.velLng;
        cs.velLat *= 0.92;
        cs.velLng *= 0.94;
      }

      // Normalize longitude
      if (cs.lng > 180) cs.lng -= 360;
      if (cs.lng < -180) cs.lng += 360;

      const camPos = latLngToVec3(cs.lat, cs.lng, cs.distance);
      camera.position.set(camPos[0], camPos[1], camPos[2]);
      camera.lookAt(0, 0, 0);
      stationUniforms.uCameraDist.value = cs.distance;

      // Orient Planetary Sonic Corona to always face the camera around the Earth's silhouette
      coronaMesh.quaternion.copy(camera.quaternion);
      const timeSec = now * 0.001;
      coronaUniforms.uTime.value = timeSec;
      coronaUniforms.uCameraDist.value = cs.distance;

      // Sample real-time audio bands + organic planetary breathing baseline
      const bands = audioEngine.getAudioBands(timeSec);
      const isActiveAudio =
        stateRef.current.playbackStatus === 'playing' ||
        stateRef.current.playbackStatus === 'loading' ||
        Boolean(stateRef.current.currentStation);

      const ambientBass = 0.24 + 0.12 * Math.sin(timeSec * 1.35) + 0.08 * Math.cos(timeSec * 2.1);
      const ambientMid = 0.20 + 0.11 * Math.cos(timeSec * 1.75) + 0.07 * Math.sin(timeSec * 2.9);
      const ambientHigh = 0.16 + 0.09 * Math.sin(timeSec * 2.6);
      const ambientPulse = 0.12 + 0.10 * Math.pow(0.5 + 0.5 * Math.sin(timeSec * 1.8), 3);

      const targetBass = Math.max(ambientBass, bands.bass * 1.25);
      const targetMid = Math.max(ambientMid, bands.mid * 1.25);
      const targetHigh = Math.max(ambientHigh, bands.high * 1.25);
      const targetPulse = Math.max(ambientPulse, bands.pulse * 1.15);
      const targetPlaying = isActiveAudio ? 0.92 : 0.55;

      coronaUniforms.uBass.value += (targetBass - coronaUniforms.uBass.value) * 0.16;
      coronaUniforms.uMid.value += (targetMid - coronaUniforms.uMid.value) * 0.16;
      coronaUniforms.uHigh.value += (targetHigh - coronaUniforms.uHigh.value) * 0.18;
      coronaUniforms.uPulse.value += (targetPulse - coronaUniforms.uPulse.value) * 0.20;
      coronaUniforms.uPlaying.value += (targetPlaying - coronaUniforms.uPlaying.value) * 0.08;

      // Smoothly transition Planetary Aura Palette when user cycles themes
      const paletteHex = AURA_PALETTES[stateRef.current.immersivePreset] || AURA_PALETTES.waves;
      coronaUniforms.uColPrimary.value.lerp(new THREE.Color(paletteHex[0]), 0.08);
      coronaUniforms.uColSecondary.value.lerp(new THREE.Color(paletteHex[1]), 0.08);
      coronaUniforms.uColAccent.value.lerp(new THREE.Color(paletteHex[2]), 0.08);

      // Update 3D Orbital Soundwave Rings around the globe
      orbitalRingA.mat.color.copy(coronaUniforms.uColPrimary.value);
      orbitalRingB.mat.color.copy(coronaUniforms.uColAccent.value);
      orbitalRingA.loop.rotation.y = timeSec * 0.14;
      orbitalRingB.loop.rotation.y = -timeSec * 0.11;

      const updateRingGeometry = (
        geo: THREE.BufferGeometry,
        baseRadius: number,
        freqA: number,
        freqB: number,
        ampScale: number,
        phaseSign: number
      ) => {
        const posAttr = geo.attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const bVal = coronaUniforms.uBass.value;
        const mVal = coronaUniforms.uMid.value;
        const hVal = coronaUniforms.uHigh.value;
        for (let i = 0; i < ORBIT_SEGMENTS; i++) {
          const a = (i / ORBIT_SEGMENTS) * Math.PI * 2;
          const wave =
            Math.sin(a * freqA + timeSec * 2.2 * phaseSign) * bVal * 0.042 +
            Math.cos(a * freqB - timeSec * 3.1 * phaseSign) * mVal * 0.032 +
            Math.sin(a * 16 + timeSec * 4.5) * hVal * 0.018;
          const r = baseRadius + wave * ampScale;
          const yWave =
            Math.cos(a * (freqA + 1) - timeSec * 1.9 * phaseSign) * (bVal * 0.035 + mVal * 0.025);
          arr[i * 3] = Math.cos(a) * r;
          arr[i * 3 + 1] = yWave;
          arr[i * 3 + 2] = Math.sin(a) * r;
        }
        posAttr.needsUpdate = true;
      };
      updateRingGeometry(orbitalRingA.geo, 1.135, 5, 9, 1.0, 1);
      updateRingGeometry(orbitalRingB.geo, 1.205, 6, 11, 1.15, -1);

      // Smooth Realistic / Minimal transition
      const targetMix = stateRef.current.globeView === 'realistic' ? 1.0 : 0.0;
      earthUniforms.uLandMix.value += (targetMix - earthUniforms.uLandMix.value) * 0.12;
      earthUniforms.uNightMix.value += (targetMix - earthUniforms.uNightMix.value) * 0.12;

      // Update hovered point attribute if changed
      if (
        prevHoveredIdx !== stateRef.current.hoveredStationIdx &&
        stationGeo.attributes.aState
      ) {
        const attr = stationGeo.attributes.aState as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        const favIds = new Set(stateRef.current.favorites.map((f) => f.id));
        const filterIds = stateRef.current.filteredStationIds;
        const stations = stateRef.current.preciseStations;

        const computeBaseState = (idx: number) => {
          const st = stations[idx];
          if (!st) return 1.0;
          if (filterIds && !filterIds.has(st.id)) return 0.15;
          if (favIds.has(st.id)) return 3.0;
          return 1.0;
        };

        if (prevHoveredIdx >= 0 && prevHoveredIdx < arr.length) {
          arr[prevHoveredIdx] = computeBaseState(prevHoveredIdx);
        }
        const nextIdx = stateRef.current.hoveredStationIdx;
        if (nextIdx >= 0 && nextIdx < arr.length) {
          arr[nextIdx] = 2.0;
        }
        attr.needsUpdate = true;
        prevHoveredIdx = nextIdx;
      }

      // Update active station pulsing beacon & directional aura focus
      const curSt = stateRef.current.currentStation;
      if (curSt && (curSt.lat !== 0 || curSt.lng !== 0)) {
        selectionGroup.visible = true;
        const pos = latLngToVec3(curSt.lat, curSt.lng, 1.006);
        selectionGroup.position.set(pos[0], pos[1], pos[2]);
        selectionGroup.lookAt(pos[0] * 2, pos[1] * 2, pos[2] * 2);
        const pulse = (now * 0.0012) % 1;
        const scale = (1 + pulse * 2.4 + coronaUniforms.uBass.value * 0.9) * (cs.distance / 2.2);
        ringMesh.scale.set(scale, scale, 1);
        ringMat.opacity = (1 - pulse) * 0.88;
        const coreScale = cs.distance / 2.2;
        coreMesh.scale.set(coreScale, coreScale, 1);

        // Project active station direction onto camera plane for directional aura surge
        const worldVec = new THREE.Vector3(pos[0], pos[1], pos[2]).project(camera);
        const dirLen = Math.hypot(worldVec.x, worldVec.y);
        if (dirLen > 0.001) {
          coronaUniforms.uActiveDir.value.set(worldVec.x / dirLen, worldVec.y / dirLen);
        }
      } else {
        selectionGroup.visible = false;
      }

      // Update geodesic flight arc animation
      if (
        threeRef.current.arcLine &&
        threeRef.current.arcLine.visible &&
        threeRef.current.arcStartTime &&
        threeRef.current.arcTotalPoints
      ) {
        const arcElapsed = (now - threeRef.current.arcStartTime) / 1000;
        const progress = Math.min(1, arcElapsed / 1.1);
        const drawCount = Math.max(2, Math.floor(progress * threeRef.current.arcTotalPoints));
        threeRef.current.arcLine.geometry.setDrawRange(0, drawCount);
        const mat = threeRef.current.arcLine.material as THREE.LineBasicMaterial;
        if (arcElapsed > 3.5) {
          mat.opacity = Math.max(0, 0.75 * (1 - (arcElapsed - 3.5) / 1.5));
          if (mat.opacity <= 0.01) threeRef.current.arcLine.visible = false;
        }
      }

      renderer.render(scene, camera);

      // Update screen-space decluttered country cluster HTML badges every ~90ms
      if (now - lastBadgeUpdate > 90) {
        lastBadgeUpdate = now;
        const w = container.clientWidth;
        const h = container.clientHeight;
        const camDir = camera.position.clone().normalize();
        const nextBadges: ScreenBadge[] = [];
        const filterIds = stateRef.current.filteredStationIds;

        for (const cl of stateRef.current.clusters) {
          const count = filterIds
            ? cl.stations.filter((s) => filterIds.has(s.id)).length
            : cl.stations.length;
          if (count === 0) continue;

          const p = latLngToVec3(cl.lat, cl.lng, 1.005);
          const v = new THREE.Vector3(p[0], p[1], p[2]);
          const facing = v.clone().normalize().dot(camDir);
          if (facing < 0.22) continue;

          v.project(camera);
          const sx = (v.x * 0.5 + 0.5) * w;
          const sy = (-v.y * 0.5 + 0.5) * h;
          if (sx < 40 || sx > w - 40 || sy < 60 || sy > h - 80) continue;

          // Screen-space decluttering (minimum 54px separation)
          const overlaps = nextBadges.some(
            (b) => Math.hypot(b.x - sx, b.y - sy) < 54
          );
          if (!overlaps) {
            nextBadges.push({
              countryCode: cl.countryCode,
              count,
              x: sx,
              y: sy,
            });
          }
          if (nextBadges.length >= 18) break;
        }
        setBadges(nextBadges);
      }
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Populate country borders when loaded
  useEffect(() => {
    const group = threeRef.current.borderGroup;
    if (!group || borders.length === 0) return;
    group.clear();

    const segments: number[] = [];
    for (const polyline of borders) {
      for (let i = 0; i < polyline.length - 2; i += 2) {
        const [x1, y1, z1] = latLngToVec3(polyline[i + 1], polyline[i], 1.0015);
        const [x2, y2, z2] = latLngToVec3(polyline[i + 3], polyline[i + 2], 1.0015);
        segments.push(x1, y1, z1, x2, y2, z2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
    const mat = new THREE.LineBasicMaterial({
      color: '#5fa4e6',
      transparent: true,
      opacity: 0.28,
    });
    group.add(new THREE.LineSegments(geo, mat));
  }, [borders]);

  // Populate precise station Points buffer & update states on filter/favorite changes
  useEffect(() => {
    const geo = threeRef.current.stationGeo;
    if (!geo || preciseStations.length === 0) return;

    const count = preciseStations.length;
    const positions = new Float32Array(count * 3);
    const states = new Float32Array(count);
    const favIds = new Set(favorites.map((f) => f.id));

    for (let i = 0; i < count; i++) {
      const s = preciseStations[i];
      const [x, y, z] = latLngToVec3(s.lat, s.lng, 1.004);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      if (filteredStationIds && !filteredStationIds.has(s.id)) {
        states[i] = 0.15;
      } else if (favIds.has(s.id)) {
        states[i] = 3.0;
      } else {
        states[i] = 1.0;
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aState', new THREE.BufferAttribute(states, 1));
    geo.computeBoundingSphere();
  }, [preciseStations, favorites, filteredStationIds]);

  // Trigger camera flight when `cameraTarget` changes
  useEffect(() => {
    if (!cameraTarget) return;
    const cs = threeRef.current.cameraSpherical;
    threeRef.current.flightAnim = {
      active: true,
      startTime: performance.now(),
      duration: cameraTarget.fullSpin ? 1850 : 1200,
      fromLat: cs.lat,
      fromLng: cs.lng,
      fromDist: cs.distance,
      toLat: cameraTarget.lat,
      toLng: cameraTarget.lng,
      toDist: cameraTarget.distance ?? cs.distance,
      fullSpin: Boolean(cameraTarget.fullSpin),
    };
  }, [cameraTarget]);

  // Trigger geodesic flight arc when `flightArc` changes
  useEffect(() => {
    const arcLine = threeRef.current.arcLine;
    if (!arcLine || !flightArc) return;
    const pts = buildArcPoints(flightArc.from, flightArc.to, 64);
    const flat = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      flat[i * 3] = pts[i][0];
      flat[i * 3 + 1] = pts[i][1];
      flat[i * 3 + 2] = pts[i][2];
    }
    arcLine.geometry.setAttribute('position', new THREE.BufferAttribute(flat, 3));
    arcLine.geometry.setDrawRange(0, 2);
    (arcLine.material as THREE.LineBasicMaterial).opacity = 0.8;
    arcLine.visible = true;
    threeRef.current.arcStartTime = performance.now();
    threeRef.current.arcTotalPoints = pts.length;
  }, [flightArc]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-slate-950">
      <div ref={containerRef} className="h-full w-full" data-testid="globe-canvas-container" />

      {/* Country cluster count badges */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {badges.map((b) => (
          <button
            key={b.countryCode}
            type="button"
            onClick={() => setSelectedCountryCode(b.countryCode)}
            style={{
              transform: `translate3d(${b.x}px, ${b.y}px, 0) translate(-50%, -50%)`,
            }}
            title={`${getCountryName(b.countryCode, language)}: ${b.count.toLocaleString()} stations`}
            className="pointer-events-auto absolute top-0 left-0 flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/75 px-2.5 py-0.5 text-xs font-medium text-slate-100 shadow-lg backdrop-blur-md transition duration-200 hover:scale-110 hover:border-cyan-300/60 hover:bg-slate-900/95 hover:text-cyan-200"
          >
            <span className="text-xs leading-none">{countryCodeToFlag(b.countryCode)}</span>
            <span className="font-mono-tech text-[11px] text-cyan-200/95">{b.count.toLocaleString()}</span>
          </button>
        ))}
      </div>

      {/* Hover Tooltip */}
      {hoveredInfo && (
        <div
          style={{
            left: Math.min(window.innerWidth - 260, hoveredInfo.x + 16),
            top: Math.max(16, hoveredInfo.y - 14),
          }}
          className="pointer-events-none fixed z-30 max-w-[240px] rounded-2xl border border-white/12 bg-slate-950/85 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl"
        >
          <div className="truncate text-[13px] font-semibold text-white">{hoveredInfo.title}</div>
          <div className="mt-0.5 truncate text-xs text-slate-300/85">{hoveredInfo.subtitle}</div>
        </div>
      )}
    </div>
  );
};

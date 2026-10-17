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
  waves: ['#38bdf8', '#1d4ed8', '#7dd3fc'],      // 蔚蓝大气 (Natural Rayleigh Sky Blue, Deep Sapphire & Ice Blue)
  aurora: ['#2dd4bf', '#0284c7', '#34d399'],     // 极地极光 (Orbital Aurora Teal, Cerulean & Emerald)
  ember: ['#38bdf8', '#1e40af', '#fbbf24'],      // 晨昏流金 (Atmospheric Blue Base with Warm Sunrise Gold Corona)
  dusk: ['#60a5fa', '#3730a3', '#818cf8'],       // 深空磁层 (Celestial Azure & Magnetosphere Indigo)
  sculpture: ['#22d3ee', '#0369a1', '#67e8f9'],  // 电离辉光 (Ionosphere Cyan & Stratosphere Blue)
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
  uniform vec2 uSunDir2D;
  uniform vec3 uColPrimary;
  uniform vec3 uColSecondary;
  uniform vec3 uColAccent;

  void main() {
    float r = length(vPlanePos);
    float rLimb = uCameraDist / sqrt(max(0.18, uCameraDist * uCameraDist - 1.0));
    // d = 0 right at the Earth's 3D silhouette; earthMesh depth buffer naturally occludes the globe interior
    float d = max(0.0, r - rLimb * 0.995);
    if (r < rLimb * 0.94 || d > 0.42) discard;

    float theta = atan(vPlanePos.y, vPlanePos.x);
    vec2 dir2D = r > 0.0001 ? vPlanePos / r : vec2(1.0, 0.0);

    // Couple atmosphere with the Earth's solar day/night side and active station hemisphere
    float sunAlign = 0.5 + 0.5 * dot(dir2D, uSunDir2D);
    float stationAlign = 0.5 + 0.5 * dot(dir2D, uActiveDir);
    float stationFocus = mix(1.0, 0.84 + 0.48 * pow(stationAlign, 2.0), uPlaying);
    float energy = (0.68 + 0.32 * uPlaying) * stationFocus;

    // Smooth, organic fluid harmonics around the planetary horizon
    float wBass = 0.5 + 0.5 * (
      sin(theta * 3.0 + uTime * 0.80) * 0.48 +
      cos(theta * 5.0 - uTime * 1.15) * 0.34 +
      sin(theta * 8.0 + uTime * 1.50) * 0.18
    );

    float wMid = 0.5 + 0.5 * (
      cos(theta * 4.0 - uTime * 1.05 + sin(theta * 2.0 + uTime * 0.45) * 0.8) * 0.46 +
      sin(theta * 7.0 + uTime * 1.40) * 0.34 +
      cos(theta * 12.0 - uTime * 1.95) * 0.20
    );

    float wHigh = 0.5 + 0.5 * (
      sin(theta * 9.0 + uTime * 1.65 + wBass * 1.5) * 0.52 +
      cos(theta * 16.0 - uTime * 2.25 + wMid * 1.2) * 0.48
    );

    // Soft polar-aurora curtain shimmer (continuous silky waves, never discrete bars or rings)
    float curtainShimmer = 0.5 + 0.5 * (
      sin(theta * 11.0 + uTime * 0.70 + sin(theta * 3.0 - uTime * 0.5) * 2.1) * 0.58 +
      cos(theta * 19.0 - uTime * 1.10 + cos(theta * 5.0 + uTime * 0.6) * 1.6) * 0.42
    );

    // Strictly monotonic radial falloff from the Earth's limb (d = 0) outward into space:
    // Every layer is 100% rooted at d = 0 (exp(0) = 1) and decays smoothly outward with zero detached rings.

    // Layer 1: Dense Rayleigh Horizon Rim (tightly hugs the planet's curvature)
    float hRayleigh = 0.022 + 0.008 * uBass;
    float rayleighGlow = exp(-pow(d / hRayleigh, 1.15));
    vec3 horizonCol = mix(uColSecondary, uColPrimary, 0.62 + 0.26 * sunAlign);
    vec3 color = horizonCol * rayleighGlow * (0.78 + 0.22 * uBass);

    // Layer 2: Audio-Reactive Stratosphere Swell (undulating scale height around the globe)
    float hStratosphere = (
      0.036 +
      (0.032 + 0.068 * uBass + 0.035 * uPulse) * (0.30 + 0.70 * wBass) +
      (0.022 + 0.048 * uMid) * (0.30 + 0.70 * wMid)
    ) * energy;
    float stratGlow = exp(-pow(d / max(0.020, hStratosphere), 1.48));
    vec3 stratCol = mix(uColSecondary, uColPrimary, 0.45 + 0.55 * wBass);
    color += stratCol * stratGlow * (0.42 + 0.36 * uBass + 0.24 * uMid) * (0.75 + 0.25 * curtainShimmer);

    // Layer 3: Silky Ionosphere Aurora Veil (responds to mid & high frequencies, rooted at d = 0)
    float hAurora = (
      0.048 +
      (0.038 + 0.075 * uMid + 0.055 * uHigh + 0.035 * uBass) * (0.25 + 0.75 * wMid * (0.55 + 0.45 * wHigh))
    ) * energy;
    float auroraGlow = exp(-pow(d / max(0.024, hAurora), 1.62));
    vec3 auroraCol = mix(uColPrimary, uColAccent, clamp(0.30 + 0.55 * wMid + 0.25 * (d / max(0.04, hAurora)), 0.0, 1.0));
    color += auroraCol * auroraGlow * (0.28 + 0.42 * uMid + 0.35 * uHigh) * (0.55 + 0.45 * pow(curtainShimmer, 1.4));

    // Layer 4: Wide Exosphere Deep-Space Halo (subtle wide atmospheric fade)
    float hExosphere = (0.095 + 0.055 * uBass + 0.035 * wBass) * energy;
    float exoGlow = exp(-d / max(0.045, hExosphere));
    color += uColSecondary * exoGlow * (0.16 + 0.14 * uBass);

    // Smooth outer fade into deep space
    float outerFade = 1.0 - smoothstep(0.22, 0.40, d);
    color *= outerFade;

    // Natural filmic tone-mapping so the atmosphere matches the Earth's realistic shading
    color = color / (1.0 + color * 0.65);

    float alpha = clamp(length(color) * 0.95, 0.0, 0.92);
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
  uniform vec3 uAuraColor;
  uniform vec3 uStationPos;
  uniform float uTime;
  uniform float uAudioBass;
  uniform float uAudioMid;
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
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 worldNormal = normalize(vWorldPosition);

    // Use worldNormal vs world-space V so facing is 1.0 at disc center and 0.0 at 360° limb from any camera angle
    float facing = max(dot(worldNormal, V), 0.0);
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

    // Warm city lights on the night hemisphere (gently shimmering with music)
    if (uNightMix > 0.01 && day < 0.999) {
      float lights = sampleSeamless(uNightTex, vPosition).r;
      float lightPulse = 1.25 + 0.25 * uAudioMid;
      color += vec3(1.0, 0.85, 0.63) * lights * lightPulse * (1.0 - day) * uNightMix * uLandMix;
    }

    // Subtle concentric geodesic soundwave ripples on the globe around the active station
    if (length(uStationPos) > 0.5) {
      vec3 stDir = normalize(uStationPos);
      float geoDist = acos(clamp(dot(normalize(vPosition), stDir), -1.0, 1.0));
      if (geoDist < 0.45) {
        float wave = 0.5 + 0.5 * sin(geoDist * 42.0 - uTime * 3.4);
        float falloff = exp(-geoDist * 7.5) * smoothstep(0.006, 0.035, geoDist);
        float rippleStrength = (pow(wave, 4.0) * (0.18 + 0.30 * uAudioBass)) * falloff;
        color += uAuraColor * rippleStrength;
      }
    }

    // Seamless Fresnel atmospheric rim coupled with the outer planetary aura
    float rim = pow(1.0 - facing, 2.6);
    float edgeGlow = pow(1.0 - facing, 4.8);
    vec3 atmoTint = mix(uRimColor, uAuraColor, 0.35 + 0.25 * uAudioBass);
    color = mix(color, atmoTint, rim * (0.62 + 0.14 * uAudioBass));
    color += uAuraColor * edgeGlow * (0.18 + 0.18 * uAudioMid);

    gl_FragColor = vec4(color, 1.0);
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
    isBadge?: boolean;
  } | null>(null);
  const [badges, setBadges] = useState<ScreenBadge[]>([]);
  const hoveredBadgeRef = useRef<string | null>(null);
  const prevBadgesSigRef = useRef<string>('');
  const visibleBadgeSetRef = useRef<Set<string>>(new Set());

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
      uAuraColor: { value: THREE.Color };
      uStationPos: { value: THREE.Vector3 };
      uTime: { value: number };
      uAudioBass: { value: number };
      uAudioMid: { value: number };
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
    const initialAspect = width / Math.max(1, height);
    const initialFov =
      initialAspect < 1 ? Math.min(72, 45 / Math.max(0.58, initialAspect)) : 45;
    const camera = new THREE.PerspectiveCamera(initialFov, initialAspect, 0.05, 25);

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

    const initColors = AURA_PALETTES[stateRef.current.immersivePreset] || AURA_PALETTES.waves;

    const earthUniforms = {
      uLandTex: { value: placeholderTex as THREE.Texture },
      uNightTex: { value: placeholderTex as THREE.Texture },
      uSunDir: { value: getSunDirection(new Date()) },
      uLandMix: { value: stateRef.current.globeView === 'realistic' ? 1.0 : 0.0 },
      uNightMix: { value: stateRef.current.globeView === 'realistic' ? 1.0 : 0.0 },
      uOceanDeep: { value: new THREE.Color('#0c2340') },
      uOceanMid: { value: new THREE.Color('#163a63') },
      uRimColor: { value: new THREE.Color('#3d6fae') },
      uAuraColor: { value: new THREE.Color(initColors[0]) },
      uStationPos: { value: new THREE.Vector3(0, 0, 0) },
      uTime: { value: 0 },
      uAudioBass: { value: 0.22 },
      uAudioMid: { value: 0.18 },
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

    // 360-degree Atmospheric & Aurora Soundscape seamlessly extending the Earth's horizon
    const coronaUniforms = {
      uTime: { value: 0 },
      uCameraDist: { value: 3.35 },
      uBass: { value: 0.25 },
      uMid: { value: 0.22 },
      uHigh: { value: 0.18 },
      uPulse: { value: 0.1 },
      uPlaying: { value: 0.35 },
      uActiveDir: { value: new THREE.Vector2(0.8, 0.6) },
      uSunDir2D: { value: new THREE.Vector2(0.7, 0.4) },
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
      depthTest: true,
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    coronaMesh.renderOrder = 2;
    scene.add(coronaMesh);

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

    // Sleek station telemetry beacon (delicate concentric pulse ring + luminous core)
    const selectionGroup = new THREE.Group();
    selectionGroup.visible = false;
    const ringGeo = new THREE.RingGeometry(0.0085, 0.0115, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#34d399',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    const coreGeo = new THREE.CircleGeometry(0.0055, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: '#6ee7b7',
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
        hoveredBadgeRef.current = null;
        setHoveredInfo(null);
        return;
      }

      // When hovering a country badge button, keep its dedicated tooltip stable
      if (hoveredBadgeRef.current) {
        return;
      }

      // Ignore pointer moves over UI overlays outside the WebGL canvas
      if (e.target !== renderer.domElement) {
        if (stateRef.current.hoveredStationIdx !== -1) {
          stateRef.current.hoveredStationIdx = -1;
        }
        setHoveredInfo((prev) => (prev ? null : prev));
        return;
      }

      // Hover picking on the 3D globe canvas
      const coords = getLatLngAtScreenXY(e.clientX, e.clientY);
      const grid = stateRef.current.spatialGrid;
      if (!coords || !grid) {
        stateRef.current.hoveredStationIdx = -1;
        setHoveredInfo((prev) => (prev ? null : prev));
        renderer.domElement.style.cursor = 'grab';
        return;
      }

      const lang = stateRef.current.language;
      const pickRadiusDeg = Math.max(0.45, Math.min(2.2, (cs.distance - 1.0) * 0.95));
      const nearStations = grid.findStationsNear(
        coords.lat,
        coords.lng,
        pickRadiusDeg,
        stateRef.current.filteredStationIds
      );

      if (nearStations.length > 0) {
        // Apply slight hysteresis to prevent boundary flicker between two adjacent stations
        let chosen = nearStations[0];
        const prevIdx = stateRef.current.hoveredStationIdx;
        if (prevIdx >= 0 && chosen.index !== prevIdx) {
          const prevMatch = nearStations.find((s) => s.index === prevIdx);
          if (prevMatch && prevMatch.distanceRad <= chosen.distanceRad + 0.0025) {
            chosen = prevMatch;
          }
        }

        stateRef.current.hoveredStationIdx = chosen.index;
        const flag = countryCodeToFlag(chosen.station.countryCode);
        const country = getCountryName(chosen.station.countryCode, lang);
        const moreLabel =
          lang === 'zh'
            ? `${flag} ${country} · 附近还有 ${nearStations.length - 1} 个电台`
            : `${flag} ${country} · +${nearStations.length - 1} more nearby`;
        setHoveredInfo({
          x: e.clientX,
          y: e.clientY,
          title: chosen.station.name,
          subtitle:
            nearStations.length > 1
              ? moreLabel
              : `${flag} ${chosen.station.region ? `${chosen.station.region}, ` : ''}${country}`,
        });
        renderer.domElement.style.cursor = 'pointer';
        return;
      }

      stateRef.current.hoveredStationIdx = -1;
      const nearCluster = grid.findClusterNear(
        coords.lat,
        coords.lng,
        pickRadiusDeg * 1.2,
        stateRef.current.filteredStationIds
      );
      if (
        nearCluster &&
        !visibleBadgeSetRef.current.has(nearCluster.cluster.countryCode)
      ) {
        const flag = countryCodeToFlag(nearCluster.cluster.countryCode);
        const country = getCountryName(nearCluster.cluster.countryCode, lang);
        setHoveredInfo({
          x: e.clientX,
          y: e.clientY,
          title: `${flag} ${country}`,
          subtitle:
            lang === 'zh'
              ? `${nearCluster.cluster.stations.length.toLocaleString()} 个广播电台`
              : `${nearCluster.cluster.stations.length.toLocaleString()} stations`,
        });
        renderer.domElement.style.cursor = 'pointer';
        return;
      }

      setHoveredInfo((prev) => (prev ? null : prev));
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
      const aspect = w / Math.max(1, h);
      camera.aspect = aspect;
      camera.fov = aspect < 1 ? Math.min(72, 45 / Math.max(0.58, aspect)) : 45;
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
        if (Math.abs(cs.velLat) < 0.00005) cs.velLat = 0;
        if (Math.abs(cs.velLng) < 0.00005) cs.velLng = 0;
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

      // Couple Earth inner atmosphere & surface ripples with the active audio and palette
      earthUniforms.uAuraColor.value.copy(coronaUniforms.uColPrimary.value);
      earthUniforms.uTime.value = timeSec;
      earthUniforms.uAudioBass.value = coronaUniforms.uBass.value;
      earthUniforms.uAudioMid.value = coronaUniforms.uMid.value;

      // Project sun direction onto camera plane so outer atmosphere matches sunlit hemisphere
      const sunCamVec = earthUniforms.uSunDir.value.clone().project(camera);
      const sunLen = Math.hypot(sunCamVec.x, sunCamVec.y);
      if (sunLen > 0.001) {
        coronaUniforms.uSunDir2D.value.set(sunCamVec.x / sunLen, sunCamVec.y / sunLen);
      }

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

      // Update active station pulsing beacon, surface acoustic ripples & directional aura focus
      const curSt = stateRef.current.currentStation;
      if (curSt && (curSt.lat !== 0 || curSt.lng !== 0)) {
        selectionGroup.visible = true;
        const pos = latLngToVec3(curSt.lat, curSt.lng, 1.006);
        selectionGroup.position.set(pos[0], pos[1], pos[2]);
        selectionGroup.lookAt(pos[0] * 2, pos[1] * 2, pos[2] * 2);
        const pulse = (now * 0.0009) % 1;
        const scale = (1 + pulse * 1.85 + coronaUniforms.uBass.value * 0.55) * (cs.distance / 2.4);
        ringMesh.scale.set(scale, scale, 1);
        ringMat.opacity = (1 - pulse) * 0.82;
        const coreScale = cs.distance / 2.4;
        coreMesh.scale.set(coreScale, coreScale, 1);

        earthUniforms.uStationPos.value.set(pos[0], pos[1], pos[2]).normalize();

        // Project active station direction onto camera plane for directional aura surge
        const worldVec = new THREE.Vector3(pos[0], pos[1], pos[2]).project(camera);
        const dirLen = Math.hypot(worldVec.x, worldVec.y);
        if (dirLen > 0.001) {
          coronaUniforms.uActiveDir.value.set(worldVec.x / dirLen, worldVec.y / dirLen);
        }
      } else {
        selectionGroup.visible = false;
        earthUniforms.uStationPos.value.set(0, 0, 0);
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
      // Pause badge layout mutations while the user is actively hovering a badge on a stationary globe
      if (
        now - lastBadgeUpdate > 90 &&
        !(hoveredBadgeRef.current && !isDragging && (!anim || !anim.active))
      ) {
        lastBadgeUpdate = now;
        const w = container.clientWidth;
        const h = container.clientHeight;
        const camDir = camera.position.clone().normalize();
        const nextBadges: ScreenBadge[] = [];
        const filterIds = stateRef.current.filteredStationIds;
        const topSafe = w < 768 ? 98 : 64;

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
          const sx = Math.round((v.x * 0.5 + 0.5) * w);
          const sy = Math.round((-v.y * 0.5 + 0.5) * h);
          if (sx < 44 || sx > w - 44 || sy < topSafe || sy > h - 84) continue;

          // Pill-shaped screen-space decluttering so horizontal badges never overlap
          const overlaps = nextBadges.some(
            (b) => Math.abs(b.x - sx) < 78 && Math.abs(b.y - sy) < 34
          );
          if (!overlaps) {
            nextBadges.push({
              countryCode: cl.countryCode,
              count,
              x: sx,
              y: sy,
            });
          }
          if (nextBadges.length >= (w < 640 ? 12 : 18)) break;
        }

        const sig = nextBadges
          .map((b) => `${b.countryCode}:${b.count}:${b.x}:${b.y}`)
          .join('|');
        if (sig !== prevBadgesSigRef.current) {
          prevBadgesSigRef.current = sig;
          visibleBadgeSetRef.current = new Set(nextBadges.map((b) => b.countryCode));
          setBadges(nextBadges);
        }
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
            data-country-badge={b.countryCode}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerEnter={() => {
              hoveredBadgeRef.current = b.countryCode;
              stateRef.current.hoveredStationIdx = -1;
              const flag = countryCodeToFlag(b.countryCode);
              const country = getCountryName(b.countryCode, language);
              setHoveredInfo({
                x: b.x,
                y: b.y,
                title: `${flag} ${country}`,
                subtitle:
                  language === 'zh'
                    ? `${b.count.toLocaleString()} 个广播电台 · 点击浏览`
                    : `${b.count.toLocaleString()} stations · Click to explore`,
                isBadge: true,
              });
            }}
            onPointerLeave={() => {
              if (hoveredBadgeRef.current === b.countryCode) {
                hoveredBadgeRef.current = null;
                setHoveredInfo((prev) => (prev?.isBadge ? null : prev));
              }
            }}
            onClick={() => setSelectedCountryCode(b.countryCode)}
            style={{
              left: `${b.x}px`,
              top: `${b.y}px`,
            }}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/75 px-2.5 py-0.5 text-xs font-medium text-slate-100 shadow-lg backdrop-blur-md transition-[color,background-color,border-color,box-shadow,transform] duration-150 hover:scale-105 hover:border-cyan-300/60 hover:bg-slate-900/95 hover:text-cyan-200"
          >
            <span className="text-xs leading-none">{countryCodeToFlag(b.countryCode)}</span>
            <span className="font-mono-tech text-[11px] text-cyan-200/95">{b.count.toLocaleString()}</span>
          </button>
        ))}
      </div>

      {/* Hover Tooltip */}
      {hoveredInfo && (
        <div
          style={
            hoveredInfo.isBadge
              ? {
                  left: Math.min(Math.max(120, hoveredInfo.x), window.innerWidth - 120),
                  top: Math.max(16, hoveredInfo.y - 18),
                  transform: 'translate(-50%, -100%)',
                }
              : {
                  left: Math.min(window.innerWidth - 260, hoveredInfo.x + 16),
                  top: Math.max(16, hoveredInfo.y - 14),
                }
          }
          className="pointer-events-none fixed z-30 max-w-[240px] rounded-2xl border border-white/12 bg-slate-950/90 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl"
        >
          <div className="truncate text-[13px] font-semibold text-white">{hoveredInfo.title}</div>
          <div className="mt-0.5 truncate text-xs text-slate-300/85">{hoveredInfo.subtitle}</div>
        </div>
      )}
    </div>
  );
};

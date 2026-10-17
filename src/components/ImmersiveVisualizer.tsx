import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ImmersivePreset } from '../types';
import { audioEngine } from '../lib/audio';
import { useAppStore } from '../store/useAppStore';

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const NOISE_HELPERS = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm3(vec2 p) {
    float v = 0.0;
    v += 0.55 * vnoise(p); p *= 2.03;
    v += 0.30 * vnoise(p); p *= 2.01;
    v += 0.15 * vnoise(p);
    return v;
  }
  float ign(vec2 fragCoord, float frame) {
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(fragCoord + frame * vec2(7.23, 3.17), magic.xy)));
  }
  vec3 applyGrain(vec3 col, vec2 uv, vec2 res, float time) {
    vec2 fc = uv * res;
    float g = ign(fc, floor(time * 60.0)) - 0.5;
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    float weight = mix(0.032, 0.014, smoothstep(0.0, 0.7, luma));
    return max(col + g * weight, vec3(0.0));
  }
`;

const WAVES_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uVolume;
  uniform float uPulse;
  ${NOISE_HELPERS}
  vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
  }
  void main() {
    vec2 uv = vUv - 0.5;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    uv.x *= aspect;
    float speed = 0.08 + uVolume * 0.12;
    float t = uTime * speed;
    vec2 q = vec2(fbm3(uv * 1.6 + vec2(0.0, t)), fbm3(uv * 1.6 + vec2(5.2, -t * 0.8)));
    float warpStrength = 1.1 + uBass * 1.4 + uPulse * 0.5;
    vec2 r = vec2(
      fbm3(uv * 2.0 + warpStrength * q + vec2(1.7, 9.2) + t * 0.6),
      fbm3(uv * 2.0 + warpStrength * q + vec2(8.3, 2.8) - t * 0.5)
    );
    float f = fbm3(uv * 1.8 + r * (1.2 + uMid * 0.9));
    vec3 col = cosinePalette(
      f + uHigh * 0.25,
      vec3(0.10, 0.14, 0.24),
      vec3(0.28, 0.34, 0.42),
      vec3(0.9, 0.8, 0.7),
      vec3(0.00, 0.15, 0.35) + uMid * 0.12
    );
    col = mix(col, vec3(0.18, 0.85, 0.95), smoothstep(0.55, 0.9, f) * (0.35 + uBass * 0.45));
    col += vec3(0.12, 0.28, 0.35) * uPulse * 0.4;
    float vig = 1.0 - smoothstep(0.35, 1.05, length(vUv - 0.5) * 1.35);
    col *= 0.55 + 0.55 * vig;
    col = applyGrain(col, vUv, uResolution, uTime);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const DUSK_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uVolume;
  uniform float uPulse;
  ${NOISE_HELPERS}
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float horizon = -0.06 + sin(uTime * 0.15) * 0.015;
    float y = p.y - horizon;
    vec3 skyTop = vec3(0.04, 0.02, 0.12);
    vec3 skyMid = vec3(0.24, 0.06, 0.32);
    vec3 skyGlow = vec3(0.95, 0.32, 0.48);
    float skyT = clamp(y * 1.8 + 0.15, 0.0, 1.0);
    vec3 sky = mix(skyGlow, mix(skyMid, skyTop, smoothstep(0.2, 1.0, skyT)), smoothstep(0.0, 0.55, skyT));
    vec2 sunPos = vec2(0.0, horizon + 0.16 + uBass * 0.03);
    float sunDist = length(p - sunPos);
    float sunRadius = 0.20 + uBass * 0.035 + uPulse * 0.02;
    float sunMask = smoothstep(sunRadius, sunRadius - 0.008, sunDist);
    float stripePhase = (p.y - sunPos.y) * 55.0 - uTime * 0.8;
    float stripeCut = smoothstep(-0.08, 0.12, p.y - sunPos.y) * 0.75 + 0.25;
    float stripes = step(0.0, sin(stripePhase) + stripeCut * 0.6);
    vec3 sunCol = mix(vec3(1.0, 0.25, 0.55), vec3(1.0, 0.88, 0.35), clamp((p.y - sunPos.y) / sunRadius * 0.5 + 0.5, 0.0, 1.0));
    float halo = exp(-sunDist * 4.5) * (0.45 + uBass * 0.45 + uPulse * 0.25);
    sky += sunCol * halo;
    if (y > 0.0) {
      sky = mix(sky, sunCol, sunMask * stripes);
    }
    vec3 col = sky;
    if (y < 0.0) {
      float depth = -y;
      vec2 waveUv = vec2(p.x * 3.0, 1.0 / max(depth, 0.02) * 0.25 - uTime * (0.6 + uVolume * 0.6));
      float ripple = vnoise(waveUv) - 0.5;
      vec2 reflP = vec2(p.x + ripple * 0.08 * (1.0 + uBass), -y);
      float reflDist = length(reflP - vec2(0.0, 0.16));
      float reflGlow = exp(-reflDist * 3.5) * (0.6 + uBass * 0.5);
      vec3 seaBase = mix(vec3(0.14, 0.03, 0.22), vec3(0.02, 0.01, 0.06), smoothstep(0.0, 0.45, depth));
      vec3 reflCol = mix(vec3(0.95, 0.22, 0.55), vec3(0.20, 0.85, 0.95), uHigh * 0.7);
      float scanline = 0.65 + 0.35 * sin(depth * 140.0 - uTime * 4.0 + ripple * 6.0);
      col = seaBase + reflCol * reflGlow * scanline;
      col += vec3(0.15, 0.85, 0.95) * smoothstep(0.48, 0.5, abs(fract(p.x / max(depth, 0.03) * 0.12 + ripple * 0.2) - 0.5)) * depth * (0.3 + uMid * 0.7);
    }
    col += vec3(0.95, 0.35, 0.6) * exp(-abs(y) * 35.0) * (0.35 + uPulse * 0.4);
    col = applyGrain(col, vUv, uResolution, uTime);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const EMBER_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uVolume;
  uniform float uPulse;
  ${NOISE_HELPERS}
  void main() {
    vec2 uv = vUv - 0.5;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    uv.x *= aspect;
    float t = uTime * (0.12 + uVolume * 0.10);
    vec2 flow = uv * 2.2 + vec2(0.0, -t * 1.4);
    float n1 = fbm3(flow);
    float n2 = fbm3(flow * 1.8 + vec2(n1 * 1.6, -t * 0.9));
    float heat = fbm3(uv * 2.4 + vec2(n2 * (1.2 + uBass * 1.1), -t * 1.2));
    float bottomGlow = smoothstep(0.6, -0.55, uv.y) * (0.45 + uBass * 0.45 + uPulse * 0.25);
    float intensity = clamp(heat * 0.85 + bottomGlow * 0.65, 0.0, 1.2);
    vec3 darkAsh = vec3(0.04, 0.015, 0.01);
    vec3 deepRed = vec3(0.48, 0.07, 0.02);
    vec3 warmAmber = vec3(0.95, 0.38, 0.06);
    vec3 brightGold = vec3(1.0, 0.82, 0.38);
    vec3 col = mix(darkAsh, deepRed, smoothstep(0.15, 0.50, intensity));
    col = mix(col, warmAmber, smoothstep(0.45, 0.78, intensity));
    col = mix(col, brightGold, smoothstep(0.75, 1.08, intensity) * (0.6 + uHigh * 0.4));
    float vig = 1.0 - smoothstep(0.3, 1.0, length(vUv - 0.5) * 1.3);
    col *= 0.5 + 0.5 * vig;
    col = applyGrain(col, vUv, uResolution, uTime);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const AURORA_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uVolume;
  uniform float uPulse;
  ${NOISE_HELPERS}
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    vec3 nightSky = mix(vec3(0.01, 0.04, 0.09), vec3(0.005, 0.01, 0.03), uv.y);
    float t = uTime * (0.10 + uVolume * 0.08);
    vec3 aurora = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float fold = sin(p.x * (2.2 + fi * 0.7) + t * (1.1 - fi * 0.25) + fi * 2.1) * 0.18;
      fold += (vnoise(vec2(p.x * 3.5 + fi * 4.0, t * 0.8)) - 0.5) * (0.22 + uBass * 0.20);
      float bandCenter = 0.05 + fi * 0.11 + fold;
      float dist = p.y - bandCenter;
      float curtain = smoothstep(-0.06, 0.01, dist) * exp(-max(dist, 0.0) * (5.5 - uMid * 1.8));
      float rays = 0.55 + 0.45 * vnoise(vec2(p.x * 14.0 + fi * 7.0, p.y * 2.0 - t * 1.5));
      vec3 cLow = vec3(0.10, 0.92, 0.55);
      vec3 cMid = vec3(0.12, 0.75, 0.88);
      vec3 cTop = vec3(0.58, 0.22, 0.85);
      float hMix = clamp(dist * 3.5, 0.0, 1.0);
      vec3 ribbonCol = mix(cLow, mix(cMid, cTop, smoothstep(0.3, 1.0, hMix)), hMix);
      aurora += ribbonCol * curtain * rays * (0.55 + uBass * 0.35 + uPulse * 0.25) * (1.0 - fi * 0.22);
    }
    vec3 col = nightSky + aurora;
    col = applyGrain(col, vUv, uResolution, uTime);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SCULPTURE_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uPulse;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vDisplacement;

  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float displaceAt(vec3 dir) {
    float t = uTime * 0.28;
    float low = snoise(dir * 1.35 + vec3(t, -t * 0.7, t * 0.5)) * (0.18 + uBass * 0.28 + uPulse * 0.14);
    float mid = snoise(dir * 2.8 - vec3(t * 1.1, t * 0.8, -t)) * (0.06 + uMid * 0.14);
    float hi  = snoise(dir * 5.6 + vec3(0.0, t * 1.8, 0.0)) * (0.015 + uHigh * 0.045);
    return low + mid + hi;
  }

  void main() {
    vec3 dir = normalize(position);
    float d = displaceAt(dir);
    vDisplacement = d;
    vec3 displaced = dir * (1.0 + d);
    float eps = 0.015;
    vec3 tangent = normalize(abs(dir.y) < 0.99 ? cross(dir, vec3(0.0, 1.0, 0.0)) : cross(dir, vec3(1.0, 0.0, 0.0)));
    vec3 bitangent = cross(dir, tangent);
    vec3 dirT = normalize(dir + tangent * eps);
    vec3 dirB = normalize(dir + bitangent * eps);
    vec3 pT = dirT * (1.0 + displaceAt(dirT));
    vec3 pB = dirB * (1.0 + displaceAt(dirB));
    vec3 objNormal = normalize(cross(pT - displaced, pB - displaced));
    vNormal = normalize(normalMatrix * objNormal);
    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const SCULPTURE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uPulse;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vDisplacement;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    float dispT = clamp(vDisplacement * 2.2 + 0.5, 0.0, 1.0);
    vec3 deepCore = vec3(0.04, 0.09, 0.20);
    vec3 cyanPeak = vec3(0.14, 0.82, 0.94);
    vec3 warmCrest = vec3(0.95, 0.45, 0.72);
    vec3 baseCol = mix(deepCore, cyanPeak, smoothstep(0.25, 0.85, dispT));
    baseCol = mix(baseCol, warmCrest, smoothstep(0.65, 1.0, dispT) * (0.35 + uMid * 0.65));
    vec3 L1 = normalize(vec3(0.7, 0.9, 0.8));
    vec3 L2 = normalize(vec3(-0.8, -0.5, 0.4));
    float diff1 = max(dot(N, L1), 0.0);
    float diff2 = max(dot(N, L2), 0.0);
    vec3 H = normalize(L1 + V);
    float spec = pow(max(dot(N, H), 0.0), 36.0) * (0.5 + uHigh * 0.8);
    vec3 col = baseCol * (0.28 + diff1 * 0.75 + diff2 * 0.25);
    col += vec3(0.55, 0.92, 1.0) * spec;
    col += mix(vec3(0.18, 0.82, 0.96), vec3(0.35, 0.95, 0.65), uBass) * fresnel * (0.85 + uPulse * 0.6);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const PRESET_OPTIONS: { id: ImmersivePreset; label: string }[] = [
  { id: 'waves', label: 'Flowing Waves' },
  { id: 'dusk', label: 'Neon Dusk' },
  { id: 'ember', label: 'Ember' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'sculpture', label: '3D Sculpture' },
];

export const ImmersiveVisualizer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const preset = useAppStore((s) => s.immersivePreset);
  const setPreset = useAppStore((s) => s.setImmersivePreset);
  const setVisualMode = useAppStore((s) => s.setVisualMode);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(
          container.clientWidth * renderer.getPixelRatio(),
          container.clientHeight * renderer.getPixelRatio()
        ),
      },
      uBass: { value: 0.1 },
      uMid: { value: 0.1 },
      uHigh: { value: 0.1 },
      uVolume: { value: 0.1 },
      uPulse: { value: 0 },
    };

    const scene2D = new THREE.Scene();
    const camera2D = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    const fragMap: Record<Exclude<ImmersivePreset, 'sculpture'>, string> = {
      waves: WAVES_FRAGMENT,
      dusk: DUSK_FRAGMENT,
      ember: EMBER_FRAGMENT,
      aurora: AURORA_FRAGMENT,
    };

    const mat2D = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: preset === 'sculpture' ? WAVES_FRAGMENT : fragMap[preset],
      uniforms,
      depthWrite: false,
      depthTest: false,
    });
    const quadMesh = new THREE.Mesh(quadGeo, mat2D);
    scene2D.add(quadMesh);

    const scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color('#020617');
    const camera3D = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      20
    );
    camera3D.position.set(0, 0, 3.2);
    const icoGeo = new THREE.IcosahedronGeometry(1, 5);
    const mat3D = new THREE.ShaderMaterial({
      vertexShader: SCULPTURE_VERTEX,
      fragmentShader: SCULPTURE_FRAGMENT,
      uniforms,
    });
    const sculptureMesh = new THREE.Mesh(icoGeo, mat3D);
    scene3D.add(sculptureMesh);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      const pr = renderer.getPixelRatio();
      uniforms.uResolution.value.set(w * pr, h * pr);
      camera3D.aspect = w / Math.max(1, h);
      camera3D.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // Smooth spring state
    let sBass = 0.1;
    let sMid = 0.1;
    let sHigh = 0.1;
    let sVol = 0.1;
    let sPulse = 0;

    let rafId = 0;
    const startTime = performance.now();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const elapsed = (now - startTime) / 1000;
      const bands = audioEngine.getAudioBands(elapsed);

      sBass += (bands.bass - sBass) * 0.16;
      sMid += (bands.mid - sMid) * 0.14;
      sHigh += (bands.high - sHigh) * 0.18;
      sVol += (bands.volume - sVol) * 0.14;
      sPulse += (bands.pulse - sPulse) * 0.24;

      uniforms.uTime.value = elapsed;
      uniforms.uBass.value = sBass;
      uniforms.uMid.value = sMid;
      uniforms.uHigh.value = sHigh;
      uniforms.uVolume.value = sVol;
      uniforms.uPulse.value = sPulse;

      if (preset === 'sculpture') {
        sculptureMesh.rotation.y = elapsed * 0.22 + sBass * 0.35;
        sculptureMesh.rotation.x = Math.sin(elapsed * 0.17) * 0.35;
        renderer.render(scene3D, camera3D);
      } else {
        renderer.render(scene2D, camera2D);
      }
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      quadGeo.dispose();
      mat2D.dispose();
      icoGeo.dispose();
      mat3D.dispose();
      renderer.dispose();
    };
  }, [preset]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-slate-950">
      <div ref={containerRef} className="h-full w-full" />

      {/* Preset switcher pills */}
      <div className="pointer-events-auto absolute top-20 right-4 z-20 flex flex-wrap items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/70 p-1.5 backdrop-blur-md">
        {PRESET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setPreset(opt.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              preset === opt.id
                ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/50'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setVisualMode('globe')}
          className="ml-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20"
        >
          Back to Globe
        </button>
      </div>
    </div>
  );
};

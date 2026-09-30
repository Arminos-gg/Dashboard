// Ashima / Stefan Gustavson 3D simplex noise (MIT)
const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

export const fieldVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;

/**
 * Domain-warped nebula. Mostly black, with two pools of light whose palette is
 * the current mood. The cursor acts as a refractive lens whose strength follows
 * its velocity; focus mode pulls the light into a single central pool.
 */
export const fieldFragment = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uVel;
uniform float uScroll;
uniform float uFocus;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
varying vec2 vUv;

${SIMPLEX}

float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 3; i++) {
    s += a * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);
  vec2 dm = p - m;
  float d = length(dm);

  float lens = exp(-d * d * 7.0) * (0.18 + uVel * 1.6);
  p -= dm * lens * 0.42;
  p.y -= uScroll * 0.22;

  float t = uTime * 0.055;
  vec2 q = vec2(fbm(vec3(p * 1.05, t)), fbm(vec3(p * 1.05 + vec2(5.2, 1.3), t + 3.1)));
  float f = fbm(vec3(p * 1.2 + q * (1.4 + uEnergy * 1.8), t * 1.35)) * 0.5 + 0.5;

  vec3 col = mix(uA, uB, smoothstep(0.28, 0.88, f));
  col = mix(col, uC, smoothstep(0.64, 1.02, f + length(q) * 0.22) * 0.85);

  vec2 poolA = mix(vec2(0.58, -0.34), vec2(0.0, -0.02), uFocus);
  vec2 poolB = mix(vec2(-0.82, 0.5), vec2(0.0, 0.0), uFocus);
  float pa = pow(smoothstep(1.0 + uFocus * 0.2, 0.0, length(p - poolA)), 1.7);
  float pb = pow(smoothstep(0.75, 0.0, length(p - poolB)), 1.9) * (0.55 - uFocus * 0.4);
  float pools = pa + pb;
  float body = smoothstep(0.3, 1.0, f);
  col *= (0.006 + 0.5 * pools) * (0.22 + body * 1.35);

  // specular rim of the lens
  float rim = smoothstep(0.05, 0.0, abs(d - 0.16 - uVel * 0.1)) * uVel;
  col += uC * (lens * 0.02 + rim * 0.035) * (0.3 + pools);

  float vig = smoothstep(1.3, 0.25, length((uv - 0.5) * vec2(aspect, 1.0) * 1.05));
  col *= vig;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #include <colorspace_fragment>
  // film grain in display space so it never lifts the blacks
  gl_FragColor.rgb += (hash(uv * uRes + fract(uTime * 7.13)) - 0.5) * 0.022;
}
`;

export const particlesVertex = /* glsl */ `
uniform float uTime;
uniform float uVel;
uniform float uPixelRatio;
uniform float uScroll;
uniform float uFocus;
uniform float uSize;
uniform float uAspect;
uniform vec2 uMouse;
attribute float aSeed;
attribute float aScale;
varying float vAlpha;

void main() {
  vec3 p = position;
  float t = uTime;
  p.x += sin(t * 0.21 + aSeed * 6.2831 + p.y * 0.45) * 0.55;
  p.y += cos(t * 0.17 + aSeed * 12.566 + p.x * 0.35) * 0.45;
  p.z += sin(t * 0.13 + aSeed * 3.1415) * 0.35;

  // depth parallax while scrolling, wrapped so the field never runs out
  p.y += uScroll * (1.2 + (p.z + 6.0) * 0.28);
  p.y = mod(p.y + 6.5, 13.0) - 6.5;

  // focus gathers everything into a slow orbit
  float ang = aSeed * 6.2831 * 9.0 + t * 0.04 * (0.5 + aScale);
  float rad = 2.35 + aScale * 0.9 + sin(aSeed * 90.0) * 0.18;
  vec3 ring = vec3(cos(ang) * rad, sin(ang) * rad, (aSeed - 0.5) * 0.8);
  p = mix(p, ring, uFocus * 0.9);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  vec2 dir = ndc - uMouse;
  dir.x *= uAspect;
  float dist = length(dir);
  float push = smoothstep(0.5, 0.0, dist) * (0.012 + uVel * 0.26);
  vec2 off = normalize(dir + 1e-5) * push;
  off.x /= uAspect;
  ndc += off;
  clip.xy = ndc * clip.w;
  gl_Position = clip;

  float twinkle = 0.55 + 0.45 * sin(t * 1.9 + aSeed * 40.0);
  vAlpha = twinkle * smoothstep(-11.0, -3.5, mv.z) * (0.3 + aScale * 0.7);
  gl_PointSize = uSize * aScale * uPixelRatio * (6.0 / -mv.z) * (1.0 + uVel * 0.8);
}
`;

export const particlesFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor, a * a * vAlpha);
  #include <colorspace_fragment>
}
`;

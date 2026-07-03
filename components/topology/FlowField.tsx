"use client";

import { useEffect, useRef } from "react";

/**
 * FlowField — a GPU fragment-shader "data nebula" rendered on raw WebGL (no
 * dependency). OPT-IN ambience: the canvas defaults to static CSS radials, and
 * this component only mounts when the parent passes `ambient`. Even then it
 * renders exactly ONE frame (a fixed-time still of the domain-warped fbm field)
 * and stops — no requestAnimationFrame loop, no idle GPU/CPU burn. Redraws
 * happen only on resize, and are skipped entirely while the tab is hidden or
 * the canvas is scrolled out of view (IntersectionObserver + visibilitychange).
 * Tears down its GL context on unmount.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes.xy) / uRes.y;
  float t = uTime * 0.025;
  // domain warp for a flowing, cloud-like field
  vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t + 5.2));
  float f = fbm(p * 2.1 + q * 1.3 + t * 0.6);
  vec3 iris = vec3(0.486, 0.553, 1.0);   // mirrors --color-iris #7c8dff (GLSL can't read CSS vars)
  vec3 deep = vec3(0.30, 0.16, 0.55);    // violet undertone
  // Crush the lows so only high-density ridges glow — wispy filaments of light
  // over deep black, not a flat grey wash.
  float fil = smoothstep(0.5, 0.98, f);
  vec3 col = mix(deep, iris, fil) * fil * fil;
  // aperture: light pools toward the upper-centre and falls off to the rim
  float r = length(p - vec2(0.0, -0.10));
  col *= smoothstep(1.05, 0.08, r);
  // deep base lift so the field is felt, never a panel
  col = col * 0.55 + vec3(0.012, 0.013, 0.019);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Fixed shader time for the single still frame — chosen for even filaments. */
const STILL_TIME = 42.0;

export function FlowField({
  className,
  ambient = false,
}: {
  className?: string;
  /** Enable the WebGL still. Default OFF — the canvas uses CSS ambience. */
  ambient?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ambient) return;
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: true });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");

    // Visibility gates — never draw while the tab is hidden or the canvas is
    // out of the viewport. A pending flag redraws once we become visible again.
    let inView = true;
    let pending = false;

    const drawFrame = () => {
      if (document.hidden || !inView) {
        pending = true;
        return;
      }
      pending = false;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, STILL_TIME);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // ONE frame, then stop — no rAF loop. The field is a still, not a video.
    };

    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
      if (inView && pending) drawFrame();
    });
    io.observe(canvas);

    const onVisibility = () => {
      if (!document.hidden && pending) drawFrame();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onResize = () => drawFrame();
    window.addEventListener("resize", onResize);

    drawFrame();

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [ambient]);

  if (!ambient) return null;
  return <canvas ref={ref} className={className} aria-hidden />;
}

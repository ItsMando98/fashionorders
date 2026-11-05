"use client";

import { useEffect, useRef } from "react";

// Fullscreen triangle: three vertices that cover the whole clip space.
const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Concrete wall under several orange spotlights.
// The light is a set of cones (bright at the lamp, wide along the beam,
// dark outside the cone). It is not a gradient painted across the panel.
const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec3 u_view; // resolution.xy, time

#define u_resolution u_view.xy
#define u_time u_view.z

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.07 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

// One spotlight cone. origin is the lamp, dir is the aim (must be normalized),
// reach is how far the beam travels, width is how fast the cone opens.
float beam(vec2 p, vec2 origin, vec2 dir, float reach, float width) {
  vec2 rel = p - origin;
  float along = dot(rel, dir);
  float across = abs(dot(rel, vec2(-dir.y, dir.x)));
  float travel = clamp(along / reach, 0.0, 1.0);
  float cone = width * (0.22 + travel);
  // Fine grit only, so the cone stays a cone and the roughness stays in the wall.
  float rough = (noise(p * 9.0 + origin) - 0.5) * width * 0.4;
  float axial = pow(clamp(1.0 - travel, 0.0, 1.0), 1.05);
  float lateral = pow(clamp(1.0 - (across + rough) / max(cone, 0.001), 0.0, 1.0), 1.2);
  float gate = smoothstep(-0.04, 0.16, along);
  // Hot spot where the lamp hits the wall, so each light reads as its own lamp.
  float core = pow(clamp(1.0 - length(rel) / (width * 0.7), 0.0, 1.0), 2.0);
  return (axial * lateral * gate) + core * 0.35;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy)
    / min(u_resolution.x, u_resolution.y);
  float t = u_time;

  // Slow aim, a few degrees only. Each lamp stays in its own part of the wall.
  vec2 d1 = normalize(vec2(0.25 + 0.04 * sin(t * 0.21), -1.0));
  vec2 d2 = normalize(vec2(-0.35 + 0.04 * cos(t * 0.15), -1.0));
  vec2 d3 = normalize(vec2(-1.0, 0.12 + 0.04 * sin(t * 0.13)));
  vec2 d4 = normalize(vec2(0.45 + 0.04 * sin(t * 0.11), 0.55));
  vec2 d5 = normalize(vec2(0.15 * cos(t * 0.16), 1.0));

  // The visible wall is about x -0.8..0.8 and y -0.5..0.5. Short reach
  // keeps each cone in its own corner instead of washing the whole panel.
  float b1 = beam(p, vec2(-0.55, 0.32), d1, 0.55, 0.32);
  float b2 = beam(p, vec2(0.52, 0.26), d2, 0.5, 0.28);
  float b3 = beam(p, vec2(0.72, -0.02), d3, 0.6, 0.22);
  float b4 = beam(p, vec2(-0.18, -0.32), d4, 0.48, 0.3);
  float b5 = beam(p, vec2(0.22, -0.42), d5, 0.42, 0.2);

  b1 *= 0.94 + 0.06 * sin(t * 0.7);
  b2 *= 0.93 + 0.07 * sin(t * 0.53 + 1.3);
  b4 *= 0.92 + 0.08 * sin(t * 0.41 + 2.1);

  // Rough concrete at a small scale: mottling, pores, stones, formwork seams.
  float stain = fbm(p * 11.0);
  float grain = fbm(p * 26.0);
  float pores = smoothstep(0.7, 0.92, noise(p * 48.0));
  float stones = smoothstep(0.82, 0.97, noise(p * 70.0 + 4.0));
  float seam = smoothstep(0.993, 1.0, abs(sin(p.y * 8.0 + stain * 2.5)));
  float albedo = 0.82 + (stain - 0.5) * 0.42 + (grain - 0.5) * 0.34;
  albedo *= 1.0 - pores * 0.5;
  albedo *= 1.0 - seam * 0.1;
  albedo += stones * 0.2;
  albedo = clamp(albedo, 0.35, 1.25);

  // Raised grit catches the orange light. The shadow stays flat gray.
  float bump = 0.72 + (grain - 0.4) * 0.85;

  vec3 shade = vec3(0.26, 0.27, 0.3);
  shade += vec3(3.1, 0.78, 0.09) * b1;
  shade += vec3(2.7, 0.95, 0.14) * b2;
  shade += vec3(2.3, 0.52, 0.05) * b3;
  shade += vec3(2.9, 1.1, 0.18) * b4;
  shade += vec3(3.2, 1.15, 0.24) * b5;
  shade *= bump;

  vec3 col = vec3(0.5, 0.51, 0.53) * albedo * shade;

  float lit = clamp(max(b1, max(b2, max(b3, max(b4, b5)))), 0.0, 1.0);
  float spark = smoothstep(0.82, 1.0, noise(gl_FragCoord.xy * 0.55));
  col += vec3(1.0, 0.64, 0.30) * spark * lit * 0.22;

  float vig = smoothstep(0.55, 1.45, length(p));
  col *= 1.0 - vig * 0.28;
  col += (grainHash(gl_FragCoord.xy) - 0.5) * 0.045;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "unknown shader error";
    console.error("ShaderBackground compile error:", info);
    const target = gl.canvas as HTMLCanvasElement;
    target.dataset.shaderError = info;
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Animated WebGL background: black-gray concrete lit by orange spotlights.
// Renders a fullscreen triangle in a plain WebGL1 context. Positioning is
// per className: fixed (fills the viewport) or absolute (fills the shell panel).
export function ShaderBackground({
  className = "pointer-events-none fixed inset-0 -z-10 h-full w-full",
}: {
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("ShaderBackground link error:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const viewLoc = gl.getUniformLocation(program, "u_view");

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rafId = 0;
    const start = performance.now();

    const render = (now: number) => {
      resize();
      const seconds = reducedMotion ? 0 : (now - start) / 1000;
      gl.uniform3f(viewLoc, canvas.width, canvas.height, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reducedMotion) rafId = requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (!rafId) rafId = requestAnimationFrame(render);
    };
    const stopLoop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const onVisibility = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      stopLoop();
    };
    const onContextRestored = () => startLoop();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    resize();
    if (!document.hidden) startLoop();

    return () => {
      stopLoop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}

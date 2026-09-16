'use client';

import React, { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';

import './Aurora.css';

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uOpacity;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ), 
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  
  // Natural sweeping diagonal flow
  float t = uTime * 0.035;
  vec2 p = uv * vec2(1.3, 1.0);
  
  // Multi-frequency organic simplex flow
  float n1 = snoise(vec2(p.x * 1.5 + t * 0.8, p.y * 1.1 - t * 0.6));
  float n2 = snoise(vec2(p.x * 2.4 - t * 0.7, p.y * 1.6 + t * 0.9));
  float n3 = snoise(vec2(p.x * 0.9 + t * 0.4, p.y * 0.8 + t * 0.5));
  
  vec3 cCyan = uColorStops[0];   // light cyan
  vec3 cMid = uColorStops[1];    // soft periwinkle / lavender
  vec3 cViolet = uColorStops[2]; // soft violet
  
  // Flowing ribbon 1: Light cyan aurora sweep across upper hero and left
  float wave1_y = 0.78 + 0.16 * sin(uv.x * 2.6 + t * 0.7) + n1 * 0.18;
  float ribbonCyan = exp(-pow(uv.y - wave1_y, 2.0) * 16.0);
  
  // Flowing ribbon 2: Violet / lavender undulating veil across mid-right
  float wave2_y = 0.44 + 0.18 * cos(uv.x * 3.0 - t * 0.6) + n2 * 0.16;
  float ribbonViolet = exp(-pow(uv.y - wave2_y, 2.0) * 14.0);
  
  // Flowing ribbon 3: Higher airy luminous curtain
  float wave3_y = 0.90 - 0.22 * uv.x + n3 * 0.14;
  float ribbonAccent = exp(-pow(uv.y - wave3_y, 2.0) * 22.0) * 0.6;
  
  // Color blending per ribbon
  float aCyan = ribbonCyan * 0.85;
  vec3 colCyan = mix(cCyan, cMid, clamp(uv.x * 0.6 + n2 * 0.2, 0.0, 1.0));
  
  float aViolet = ribbonViolet * 0.80;
  vec3 colViolet = mix(cMid, cViolet, clamp(uv.x * 0.7 + 0.15 + n1 * 0.2, 0.0, 1.0));
  
  float aAccent = ribbonAccent * 0.50;
  vec3 colAccent = mix(cCyan, cViolet, clamp(uv.x + n3 * 0.2, 0.0, 1.0));
  
  // Organic composite: leaves negative space airy and clean
  vec3 accumColor = colCyan * aCyan + colViolet * aViolet + colAccent * aAccent;
  float accumAlpha = aCyan + aViolet + aAccent;
  
  // Subtle airy ambient tint at top only (never a flat screen wash)
  float topAmbient = smoothstep(0.55, 1.0, uv.y) * 0.07;
  accumAlpha += topAmbient;
  accumColor += mix(cCyan, cViolet, uv.x) * topAmbient;
  
  vec3 finalRgb = (accumAlpha > 0.001) ? (accumColor / accumAlpha) : cCyan;
  float finalAlpha = clamp(accumAlpha * uOpacity, 0.0, 1.0);
  
  fragColor = vec4(finalRgb * finalAlpha, finalAlpha);
}
`;

export interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  opacity?: number;
  time?: number;
  speed?: number;
  className?: string;
}

export function Aurora(props: AuroraProps) {
  const {
    colorStops = ['#38BDF8', '#818CF8', '#C084FC'], // Sky blue on left, Indigo-Lavender, Lilac/Violet on right
    amplitude = 1.0,
    blend = 0.5,
    opacity = 0.28,
    className = ''
  } = props;
  const propsRef = useRef<AuroraProps>(props);
  propsRef.current = props;

  const ctnDom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctn = ctnDom.current;
    if (!ctn) return;

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: true
    });
    const gl = renderer.gl;
    if (!gl) return;

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = 'transparent';
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.display = 'block';

    let program: Program | undefined;

    function resize() {
      if (!ctn) return;
      const width = ctn.offsetWidth || window.innerWidth;
      const height = ctn.offsetHeight || window.innerHeight;
      renderer.setSize(width, height);
      if (program) {
        program.uniforms.uResolution.value = [width, height];
      }
    }
    window.addEventListener('resize', resize);

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) {
      delete geometry.attributes.uv;
    }

    const colorStopsArray = colorStops.map(hex => {
      const c = new Color(hex);
      return [c.r, c.g, c.b];
    });

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uColorStops: { value: colorStopsArray },
        uResolution: { value: [ctn.offsetWidth || 1, ctn.offsetHeight || 1] },
        uBlend: { value: blend },
        uOpacity: { value: opacity }
      }
    });

    const mesh = new Mesh(gl, { geometry, program });
    ctn.appendChild(gl.canvas);

    let animateId = 0;
    const update = (t: number) => {
      animateId = requestAnimationFrame(update);
      const { time = t * 0.01, speed = 1.0 } = propsRef.current;
      if (program) {
        program.uniforms.uTime.value = time * speed * 0.08;
        program.uniforms.uAmplitude.value = propsRef.current.amplitude ?? 1.0;
        program.uniforms.uBlend.value = propsRef.current.blend ?? blend;
        program.uniforms.uOpacity.value = propsRef.current.opacity ?? opacity;
        const stops = propsRef.current.colorStops ?? colorStops;
        program.uniforms.uColorStops.value = stops.map(hex => {
          const c = new Color(hex);
          return [c.r, c.g, c.b];
        });
        renderer.render({ scene: mesh });
      }
    };
    animateId = requestAnimationFrame(update);

    resize();

    return () => {
      cancelAnimationFrame(animateId);
      window.removeEventListener('resize', resize);
      if (ctn && gl.canvas.parentNode === ctn) {
        ctn.removeChild(gl.canvas);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [amplitude]);

  return <div ref={ctnDom} className={`aurora-container ${className}`.trim()} />;
}

export default Aurora;

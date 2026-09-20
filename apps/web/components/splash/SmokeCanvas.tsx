"use client";

import { useEffect, useRef } from "react";

/* Humo realista: simulación de fluidos en GPU (WebGL2).

   La primera versión de este componente estampaba sprites con ruido y el
   resultado era "aerosol del Paint": puntos, no humo. El humo real es un
   FLUIDO — filamentos continuos que se estiran y enrulan — y eso no sale de
   partículas sueltas: sale de resolver el campo de velocidades.

   Esto es un solver de "stable fluids" (Stam) al estilo de la clásica
   WebGL-Fluid-Simulation de Dobryakov, reducido a lo que el humo necesita:

     advección semi-lagrangiana → transporta velocidad y densidad
     confinamiento de vorticidad → re-inyecta los rulos que la grilla disipa
     flotabilidad               → el humo caliente sube solo
     proyección de presión      → hace el campo incompresible (Jacobi ~20 it.)

   La densidad (dye) se pinta con la tinta azulada de la marca y alfa
   premultiplicado; quien lo usa lo compone con `mix-blend-mode: multiply`
   sobre el papel. Sin WebGL2/float targets o con reduced-motion, no dibuja
   nada: el splash funciona igual sin humo. */

export type SmokeEmitter = {
  /** Posición relativa al canvas (0–1, y hacia abajo como CSS). */
  x: number;
  y: number;
  /** Caudal de densidad (misma escala que la versión anterior: ~6–14). */
  rate?: number;
  /** Amplitud del vaivén del punto de emisión, relativa al ancho. */
  spread?: number;
};

const VERT = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUv, vL, vR, vT, vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAG = {
  advection: `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 simTexelSize;
uniform float dt;
uniform float dissipation;
void main () {
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * simTexelSize;
  gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt);
}`,

  splat: `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
void main () {
  vec2 p = vUv - point;
  p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  vec3 base = texture2D(uTarget, vUv).xyz;
  gl_FragColor = vec4(base + splat, 1.0);
}`,

  curl: `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
void main () {
  float L = texture2D(uVelocity, vL).y;
  float R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x;
  float B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,

  vorticity: `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curlStrength;
uniform float dt;
void main () {
  float L = texture2D(uCurl, vL).x;
  float R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x;
  float B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curlStrength * C;
  force.y *= -1.0;
  vec2 velocity = texture2D(uVelocity, vUv).xy + force * dt;
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}`,

  buoyancy: `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uDye;
uniform float lift;
uniform float dt;
void main () {
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  float d = texture2D(uDye, vUv).x;
  velocity.y += lift * min(d, 1.5) * dt;
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}`,

  divergence: `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
void main () {
  float L = texture2D(uVelocity, vL).x;
  float R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y;
  float B = texture2D(uVelocity, vB).y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,

  clear: `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float value;
void main () {
  gl_FragColor = value * texture2D(uTexture, vUv);
}`,

  pressure: `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main () {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  float divergence = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`,

  gradientSubtract: `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main () {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  vec2 velocity = texture2D(uVelocity, vUv).xy - 0.5 * vec2(R - L, T - B);
  gl_FragColor = vec4(clamp(velocity, -200.0, 200.0), 0.0, 1.0);
}`,

  display: `
precision highp float;
varying vec2 vUv;
uniform sampler2D uDye;
uniform vec3 inkColor;
uniform float opacity;
void main () {
  float d = texture2D(uDye, vUv).x;
  float a = (1.0 - exp(-d * 1.1)) * opacity;
  gl_FragColor = vec4(inkColor * a, a);
}`,
};

type Uniforms = Record<string, WebGLUniformLocation | null>;

type Prog = { program: WebGLProgram; uniforms: Uniforms };

type FBO = {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  width: number;
  height: number;
  texelSize: [number, number];
};

type DoubleFBO = { read: FBO; write: FBO; swap: () => void };

function compileProgram(gl: WebGL2RenderingContext, fragSrc: string): Prog | null {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("smoke shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = make(gl.VERTEX_SHADER, VERT);
  const fs = make(gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("smoke link:", gl.getProgramInfoLog(program));
    return null;
  }
  const uniforms: Uniforms = {};
  const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(program, i)!.name;
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

export function SmokeCanvas({
  running = true,
  timeScale = 1,
  intensity = 1,
  fog = 0,
  emitters,
  className,
  style,
}: {
  /** Con false deja de emitir; el humo vivo se disipa solo. */
  running?: boolean;
  /** >1 = cámara lenta (misma convención que los splash). */
  timeScale?: number;
  /** Multiplica el caudal. 1 = banco de pruebas; ~0.5 ambiente. */
  intensity?: number;
  /** Velo de neblina que cubre TODO el lienzo: splats gigantes y débiles que
      deambulan por el campo. 0 lo apaga; ~1 = velo sutil, ~2 = niebla densa.
      Independiente de `intensity` a propósito: el velo no debe escalar con
      el caudal de los emisores. */
  fog?: number;
  emitters?: SmokeEmitter[];
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(running);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  // Dep serializada: el array literal cambia de identidad por render.
  const emittersKey = JSON.stringify(emitters ?? null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      depth: false,
      stencil: false,
      antialias: false,
    });
    if (!gl) return;
    if (!gl.getExtension("EXT_color_buffer_float")) return;

    const emit: Required<SmokeEmitter>[] = (
      (JSON.parse(emittersKey) as SmokeEmitter[] | null) ?? [{ x: 0.5, y: 0.9 }]
    ).map(e => ({ rate: 10, spread: 0.04, ...e }));

    // ── Programas ──────────────────────────────────────────────────────
    const progs = {
      advection: compileProgram(gl, FRAG.advection),
      splat: compileProgram(gl, FRAG.splat),
      curl: compileProgram(gl, FRAG.curl),
      vorticity: compileProgram(gl, FRAG.vorticity),
      buoyancy: compileProgram(gl, FRAG.buoyancy),
      divergence: compileProgram(gl, FRAG.divergence),
      clear: compileProgram(gl, FRAG.clear),
      pressure: compileProgram(gl, FRAG.pressure),
      gradientSubtract: compileProgram(gl, FRAG.gradientSubtract),
      display: compileProgram(gl, FRAG.display),
    };
    if (Object.values(progs).some(p => p === null)) return;
    const P = progs as Record<keyof typeof progs, Prog>;

    // Quad de pantalla completa.
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);

    // ── Framebuffers ───────────────────────────────────────────────────
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const createFBO = (w: number, h: number, internal: number, format: number): FBO => {
      const tex = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { fbo, tex, width: w, height: h, texelSize: [1 / w, 1 / h] };
    };

    const createDouble = (w: number, h: number, internal: number, format: number): DoubleFBO => {
      const d = {
        read: createFBO(w, h, internal, format),
        write: createFBO(w, h, internal, format),
        swap() {
          const t = d.read;
          d.read = d.write;
          d.write = t;
        },
      };
      return d;
    };

    let velocity!: DoubleFBO;
    let dye!: DoubleFBO;
    let pressure!: DoubleFBO;
    let divergence!: FBO;
    let curl!: FBO;
    let W = 0;
    let H = 0;

    const sizeFor = (short: number) => {
      const aspect = W / H;
      return aspect > 1
        ? [Math.round(short * aspect), short]
        : [short, Math.round(short / aspect)];
    };

    const initFramebuffers = () => {
      const r = canvas.getBoundingClientRect();
      W = Math.max(2, Math.round(r.width * dpr));
      H = Math.max(2, Math.round(r.height * dpr));
      canvas.width = W;
      canvas.height = H;
      const [sw, sh] = sizeFor(128);
      const [dw, dh] = sizeFor(448);
      velocity = createDouble(sw, sh, gl.RG16F, gl.RG);
      dye = createDouble(dw, dh, gl.R16F, gl.RED);
      pressure = createDouble(sw, sh, gl.R16F, gl.RED);
      divergence = createFBO(sw, sh, gl.R16F, gl.RED);
      curl = createFBO(sw, sh, gl.R16F, gl.RED);
    };
    initFramebuffers();
    // OJO: ResizeObserver SIEMPRE dispara una primera notificación al
    // observar — sin el guard de tamaño, ese callback recreaba los
    // framebuffers un instante después del montaje y borraba la siembra de
    // niebla en silencio. Solo re-inicializar ante un cambio real, y volver
    // a sembrar porque el campo se pierde con los FBOs.
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      const w = Math.max(2, Math.round(r.width * dpr));
      const h = Math.max(2, Math.round(r.height * dpr));
      if (w !== W || h !== H) {
        initFramebuffers();
        warmupFog();
      }
    });
    ro.observe(canvas);

    // ── Helpers de pase ────────────────────────────────────────────────
    const bindTex = (u: WebGLUniformLocation | null, tex: WebGLTexture, unit: number) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(u, unit);
    };

    const blit = (target: FBO | null, prog: Prog, texel: [number, number]) => {
      gl.uniform2f(prog.uniforms.texelSize, texel[0], texel[1]);
      if (target) {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      } else {
        gl.viewport(0, 0, W, H);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const splat = (
      x: number,
      y: number,
      vx: number,
      vy: number,
      amount: number,
      velRadius = 0.0022,
      dyeRadius = 0.0008,
    ) => {
      const aspect = W / H;
      gl.useProgram(P.splat.program);
      gl.uniform1f(P.splat.uniforms.aspectRatio, aspect);
      gl.uniform2f(P.splat.uniforms.point, x, y);

      bindTex(P.splat.uniforms.uTarget, velocity.read.tex, 0);
      gl.uniform3f(P.splat.uniforms.color, vx, vy, 0);
      gl.uniform1f(P.splat.uniforms.radius, velRadius);
      blit(velocity.write, P.splat, velocity.read.texelSize);
      velocity.swap();

      bindTex(P.splat.uniforms.uTarget, dye.read.tex, 0);
      gl.uniform3f(P.splat.uniforms.color, amount, 0, 0);
      gl.uniform1f(P.splat.uniforms.radius, dyeRadius);
      blit(dye.write, P.splat, dye.read.texelSize);
      dye.swap();
    };

    // ── Paso de simulación (compartido por el loop y el warm-up) ───────
    const simStep = (dt: number) => {
      const simTexel = velocity.read.texelSize;

      gl.useProgram(P.curl.program);
      bindTex(P.curl.uniforms.uVelocity, velocity.read.tex, 0);
      blit(curl, P.curl, simTexel);

      gl.useProgram(P.vorticity.program);
      bindTex(P.vorticity.uniforms.uVelocity, velocity.read.tex, 0);
      bindTex(P.vorticity.uniforms.uCurl, curl.tex, 1);
      gl.uniform1f(P.vorticity.uniforms.curlStrength, 32);
      gl.uniform1f(P.vorticity.uniforms.dt, dt);
      blit(velocity.write, P.vorticity, simTexel);
      velocity.swap();

      gl.useProgram(P.buoyancy.program);
      bindTex(P.buoyancy.uniforms.uVelocity, velocity.read.tex, 0);
      bindTex(P.buoyancy.uniforms.uDye, dye.read.tex, 1);
      // En modo niebla la densidad es alta y pareja: con lift 11 el campo
      // entero generaba columnas ascendentes ("empuje") por flotabilidad.
      // La niebla quiere flotar apenas, no subir en chorro.
      gl.uniform1f(P.buoyancy.uniforms.lift, fog > 0 ? 3.5 : 11);
      gl.uniform1f(P.buoyancy.uniforms.dt, dt);
      blit(velocity.write, P.buoyancy, simTexel);
      velocity.swap();

      gl.useProgram(P.divergence.program);
      bindTex(P.divergence.uniforms.uVelocity, velocity.read.tex, 0);
      blit(divergence, P.divergence, simTexel);

      gl.useProgram(P.clear.program);
      bindTex(P.clear.uniforms.uTexture, pressure.read.tex, 0);
      gl.uniform1f(P.clear.uniforms.value, 0.8);
      blit(pressure.write, P.clear, simTexel);
      pressure.swap();

      gl.useProgram(P.pressure.program);
      bindTex(P.pressure.uniforms.uDivergence, divergence.tex, 1);
      for (let i = 0; i < 20; i++) {
        bindTex(P.pressure.uniforms.uPressure, pressure.read.tex, 0);
        blit(pressure.write, P.pressure, simTexel);
        pressure.swap();
      }

      gl.useProgram(P.gradientSubtract.program);
      bindTex(P.gradientSubtract.uniforms.uPressure, pressure.read.tex, 0);
      bindTex(P.gradientSubtract.uniforms.uVelocity, velocity.read.tex, 1);
      blit(velocity.write, P.gradientSubtract, simTexel);
      velocity.swap();

      gl.useProgram(P.advection.program);
      gl.uniform2f(P.advection.uniforms.simTexelSize, simTexel[0], simTexel[1]);
      gl.uniform1f(P.advection.uniforms.dt, dt);
      bindTex(P.advection.uniforms.uVelocity, velocity.read.tex, 0);
      bindTex(P.advection.uniforms.uSource, velocity.read.tex, 0);
      gl.uniform1f(P.advection.uniforms.dissipation, 0.12);
      blit(velocity.write, P.advection, simTexel);
      velocity.swap();

      bindTex(P.advection.uniforms.uVelocity, velocity.read.tex, 0);
      bindTex(P.advection.uniforms.uSource, dye.read.tex, 1);
      gl.uniform1f(P.advection.uniforms.dissipation, 0.4);
      blit(dye.write, P.advection, dye.read.texelSize);
      dye.swap();
    };

    // Niebla de fondo — goteo de mantenimiento: seis fuentes de nube
    // errantes (cada una con su propia frecuencia de deriva, nunca
    // sincronizan) que recargan billows donde pasan. La disipación borra lo
    // viejo, la vorticidad enrula lo nuevo. Compartido por loop y warm-up.
    const fogDrip = (tNow: number, dt: number) => {
      for (let i = 0; i < 6; i++) {
        const ph = i * 2.61;
        // Deriva lenta y empujón mínimo: con 60/45 de velocidad las fuentes
        // se veían como "sopladores" — chorros localizados que delataban el
        // truco. La tinta entra casi quieta y el movimiento lo ponen la
        // flotabilidad y la vorticidad, que es donde el humo se ve natural.
        const fx = 0.5 + 0.46 * Math.sin(tNow * (0.13 + i * 0.025) + ph * 2.3);
        const fy = 0.5 + 0.44 * Math.sin(tNow * (0.09 + i * 0.02) + ph * 1.9);
        splat(
          fx,
          fy,
          Math.sin(tNow * 0.5 + ph) * 4 * dt,
          Math.cos(tNow * 0.4 + ph) * 3 * dt,
          fog * dt * 0.28,
          0.04,
          0.06,
        );
      }
    };

    let t = 0;

    // Warm-up de la niebla: nada de estados iniciales inventados (se probó
    // sembrar el campo a mano y da un gris plano o un caos, según la dosis).
    // Se PRE-CORRE la simulación 3 s con el mismo goteo del loop, sin
    // dibujar: el primer frame visible ES el humo al que antes había que
    // esperarle 3 segundos. Un solo costo al montar (60 pasos).
    const warmupFog = () => {
      if (fog <= 0) return;
      const wdt = 1 / 20;
      for (let i = 0; i < 60; i++) {
        fogDrip(t, wdt);
        simStep(wdt);
        t += wdt;
      }
    };
    warmupFog();

    // ── Loop ───────────────────────────────────────────────────────────
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.033, (now - last) / 1000) / timeScale;
      last = now;
      t += dt;

      // Emisión: el vaivén del punto y de la dirección es lo único
      // scripteado; los rulos los pone la vorticidad del fluido.
      if (runningRef.current) {
        emit.forEach((e, i) => {
          const ph = i * 2.399;
          const wig =
            Math.sin(t * 1.9 + ph) * 0.6 + Math.sin(t * 0.77 + ph * 1.7) * 0.4;
          const x = e.x + wig * e.spread;
          const y = 1 - e.y;
          // Fuerzas: F*dt por frame. La primera calibración usaba ~3300
          // texels/s² y el campo explotaba en manchones; esto es un soplo.
          // Calibración "brasa": poco caudal, poco empuje — el humo flota y
          // persiste en vez de chorrear hacia arriba.
          const dirx = Math.sin(t * 2.3 + ph) * 45;
          const amount = e.rate * intensity * dt * 0.7;
          splat(x, y, dirx * dt, 110 * dt, amount);
        });
      }

      if (runningRef.current && fog > 0) fogDrip(t, dt);

      simStep(dt);

      gl.useProgram(P.display.program);
      bindTex(P.display.uniforms.uDye, dye.read.tex, 0);
      gl.uniform3f(P.display.uniforms.inkColor, 52 / 255, 56 / 255, 84 / 255);
      gl.uniform1f(P.display.uniforms.opacity, 0.7);
      blit(null, P.display, [1 / W, 1 / H]);
    };
    raf = requestAnimationFrame(frame);

    // OJO: nada de loseContext() acá. Con StrictMode el efecto corre
    // montar→limpiar→montar sobre el MISMO canvas, y un getContext sobre un
    // contexto perdido devuelve null: el humo moría en silencio. El contexto
    // se libera solo cuando React desmonta el nodo.
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [emittersKey, intensity, timeScale, fog]);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden="true" />;
}

/**
 * GreenTrace — WebGL Fluid Simulation
 * Based on Pavel Dobryakov's WebGL-Fluid-Simulation (MIT License)
 * Adapted for React + themed to GreenTrace purple palette.
 * Only purple/violet hues are used. Background remains dark/transparent.
 */
import { useEffect, useRef } from 'react';

const FluidSimulation = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ─── Config ────────────────────────────────────────────────────────────────
    const config = {
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 512,
      DENSITY_DISSIPATION: 3.5,   // higher = fades faster
      VELOCITY_DISSIPATION: 0.4,
      PRESSURE: 0.8,
      PRESSURE_ITERATIONS: 20,
      CURL: 18,
      SPLAT_RADIUS: 0.18,
      SPLAT_FORCE: 2500,
      SHADING: false,
      COLORFUL: false,
    };

    // ─── GreenTrace Purple Palette ─────────────────────────────────────────────
    // HSL(270-290, 80-100%, 50-70%) kept to purple/violet only
    const PURPLE_COLORS = [
      { r: 0.20, g: 0.03, b: 0.40 },  // very dark deep purple
      { r: 0.18, g: 0.02, b: 0.35 },  // dark violet
      { r: 0.25, g: 0.06, b: 0.45 },  // mid-dark purple
      { r: 0.15, g: 0.02, b: 0.30 },  // very subtle dark
      { r: 0.22, g: 0.08, b: 0.42 },  // muted lavender
    ];

    // ─── WebGL Context ─────────────────────────────────────────────────────────
    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    let gl = canvas.getContext('webgl2', params);
    const isWebGL2 = !!gl;
    if (!isWebGL2) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
    if (!gl) { console.error('WebGL not supported'); return; }

    let halfFloat, supportLinearFiltering;
    if (isWebGL2) {
      gl.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = gl.getExtension('OES_texture_half_float');
      supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
    }
    gl.clearColor(0, 0, 0, 1);
    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;

    function supportRenderTextureFormat(internalFormat, format, type) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }

    function getSupportedFormat(internalFormat, format, type) {
      if (!supportRenderTextureFormat(internalFormat, format, type)) {
        if (internalFormat === gl.R16F) return getSupportedFormat(gl.RG16F, gl.RG, type);
        if (internalFormat === gl.RG16F) return getSupportedFormat(gl.RGBA16F, gl.RGBA, type);
        return null;
      }
      return { internalFormat, format };
    }

    let formatRGBA, formatRG, formatR;
    if (isWebGL2) {
      formatRGBA = getSupportedFormat(gl.RGBA16F, gl.RGBA, halfFloatTexType);
      formatRG   = getSupportedFormat(gl.RG16F,   gl.RG,   halfFloatTexType);
      formatR    = getSupportedFormat(gl.R16F,    gl.RED,  halfFloatTexType);
    } else {
      formatRGBA = getSupportedFormat(gl.RGBA, gl.RGBA, halfFloatTexType);
      formatRG   = getSupportedFormat(gl.RGBA, gl.RGBA, halfFloatTexType);
      formatR    = getSupportedFormat(gl.RGBA, gl.RGBA, halfFloatTexType);
    }

    // ─── Shader compiler ───────────────────────────────────────────────────────
    function compileShader(type, src, keywords) {
      if (keywords) src = keywords.map(k => `#define ${k}\n`).join('') + src;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
      return shader;
    }

    function createProgram(vs, fs) {
      const p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
      return p;
    }

    function getUniforms(program) {
      const u = {};
      const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const name = gl.getActiveUniform(program, i).name;
        u[name] = gl.getUniformLocation(program, name);
      }
      return u;
    }

    class GLProgram {
      constructor(vs, fs) {
        this.program = createProgram(vs, fs);
        this.uniforms = getUniforms(this.program);
      }
      bind() { gl.useProgram(this.program); }
    }

    // ─── Vertex shaders ────────────────────────────────────────────────────────
    const baseVS = compileShader(gl.VERTEX_SHADER, `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
      uniform vec2 texelSize;
      void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0,  texelSize.y);
        vB = vUv - vec2(0.0,  texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `);

    // ─── Fragment shaders ──────────────────────────────────────────────────────
    const clearFS    = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float; precision mediump sampler2D;
      varying highp vec2 vUv;
      uniform sampler2D uTexture; uniform float value;
      void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
    `);
    const displayFS = compileShader(gl.FRAGMENT_SHADER,`
      precision highp float; precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
        float a = max(c.r, max(c.g, c.b));
        gl_FragColor = vec4(c, a);
      }
    `);
    const splatFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;
      void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p,p)/radius) * color;
        vec3 base  = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
      }
    `);
    const advectionFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uVelocity; uniform sampler2D uSource;
      uniform vec2 texelSize; uniform vec2 dyeTexelSize;
      uniform float dt; uniform float dissipation;
      vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;
        vec2 iuv = floor(st); vec2 fuv = fract(st);
        vec4 a = texture2D(sam, (iuv + vec2(0.5,0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5,0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5,1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5,1.5)) * tsize);
        return mix(mix(a,b,fuv.x), mix(c,d,fuv.x), fuv.y);
      }
      void main () {
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        vec4 result = bilerp(uSource, coord, dyeTexelSize);
        float decay = 1.0 + dissipation * dt;
        gl_FragColor = result / decay;
      }
    `, supportLinearFiltering ? null : ['MANUAL_FILTERING']);
    const divergenceFS = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float; precision mediump sampler2D;
      varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR;
      varying highp vec2 vT; varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;
        float div = 0.5*(R-L+T-B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
      }
    `);
    const curlFS = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float; precision mediump sampler2D;
      varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR;
      varying highp vec2 vT; varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        gl_FragColor = vec4(0.5*(R-L-T+B), 0.0, 0.0, 1.0);
      }
    `);
    const vorticityFS = compileShader(gl.FRAGMENT_SHADER, `
      precision highp float; precision highp sampler2D;
      varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
      uniform sampler2D uVelocity; uniform sampler2D uCurl;
      uniform float curl; uniform float dt;
      void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(T)-abs(B), abs(L)-abs(R));
        force /= length(force) + 0.0001;
        force *= curl * C;
        vec2 vel = texture2D(uVelocity, vUv).xy;
        gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
      }
    `);
    const pressureFS = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float; precision mediump sampler2D;
      varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR;
      varying highp vec2 vT; varying highp vec2 vB;
      uniform sampler2D uPressure; uniform sampler2D uDivergence;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float div = texture2D(uDivergence, vUv).x;
        gl_FragColor = vec4((L+R+B+T-div)*0.25, 0.0, 0.0, 1.0);
      }
    `);
    const gradSubFS = compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float; precision mediump sampler2D;
      varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR;
      varying highp vec2 vT; varying highp vec2 vB;
      uniform sampler2D uPressure; uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 vel = texture2D(uVelocity, vUv).xy;
        gl_FragColor = vec4(vel - vec2(R-L, T-B), 0.0, 1.0);
      }
    `);

    // ─── Programs ──────────────────────────────────────────────────────────────
    const clearPrg    = new GLProgram(baseVS, clearFS);
    const displayPrg  = new GLProgram(baseVS, displayFS);
    const splatPrg    = new GLProgram(baseVS, splatFS);
    const advectionPrg = new GLProgram(baseVS, advectionFS);
    const divergencePrg = new GLProgram(baseVS, divergenceFS);
    const curlPrg     = new GLProgram(baseVS, curlFS);
    const vorticityPrg = new GLProgram(baseVS, vorticityFS);
    const pressurePrg  = new GLProgram(baseVS, pressureFS);
    const gradSubPrg   = new GLProgram(baseVS, gradSubFS);

    // ─── Quad blit ─────────────────────────────────────────────────────────────
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLocation = gl.getAttribLocation(displayPrg.program, 'aPosition');
    gl.enableVertexAttribArray(posLocation);
    gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);

    function blit(target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
      if (target) gl.viewport(0, 0, target.width, target.height);
      else gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // ─── FBO Helpers ───────────────────────────────────────────────────────────
    function createTexture(w, h, internalFormat, format, type, filter) {
      gl.activeTexture(gl.TEXTURE0);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
      return tex;
    }

    function createFBO(w, h, internalFormat, format, type, filter) {
      const tex = createTexture(w, h, internalFormat, format, type, filter);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fbo, width: w, height: h,
        texelSizeX: 1/w, texelSizeY: 1/h };
    }

    function createDoubleFBO(w, h, internalFormat, format, type, filter) {
      let fbo1 = createFBO(w, h, internalFormat, format, type, filter);
      let fbo2 = createFBO(w, h, internalFormat, format, type, filter);
      return {
        width: w, height: h,
        texelSizeX: 1/w, texelSizeY: 1/h,
        get read() { return fbo1; },
        get write() { return fbo2; },
        swap() { [fbo1, fbo2] = [fbo2, fbo1]; }
      };
    }

    function getResolution(res) {
      const aspectRatio = canvas.width / canvas.height;
      if (aspectRatio < 1) return { width: Math.round(res * aspectRatio), height: res };
      return { width: res, height: Math.round(res / aspectRatio) };
    }

    const filter = supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    let dye, velocity, divergence, curl, pressure;

    function initFramebuffers() {
      const simRes = getResolution(config.SIM_RESOLUTION);
      const dyeRes = getResolution(config.DYE_RESOLUTION);
      if (formatRGBA == null) { console.error('Floating point textures not supported'); return; }
      dye      = createDoubleFBO(dyeRes.width, dyeRes.height, formatRGBA.internalFormat, formatRGBA.format, halfFloatTexType, filter);
      velocity = createDoubleFBO(simRes.width, simRes.height, formatRG.internalFormat,   formatRG.format,   halfFloatTexType, filter);
      divergence = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST);
      curl      = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST);
      pressure  = createDoubleFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST);
    }

    function resizeCanvas() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        return true;
      }
      return false;
    }

    // ─── Texture unit binding helper ───────────────────────────────────────────
    function bindTexture(unit, tex) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      return unit;
    }

    // ─── Simulation steps ──────────────────────────────────────────────────────
    function step(dt) {
      gl.disable(gl.BLEND);

      // Curl
      curlPrg.bind();
      gl.uniform2f(curlPrg.uniforms['texelSize'], velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(curlPrg.uniforms['uVelocity'], bindTexture(0, velocity.read.tex));
      blit(curl);

      // Vorticity
      vorticityPrg.bind();
      gl.uniform2f(vorticityPrg.uniforms['texelSize'], velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(vorticityPrg.uniforms['uVelocity'], bindTexture(0, velocity.read.tex));
      gl.uniform1i(vorticityPrg.uniforms['uCurl'],     bindTexture(1, curl.tex));
      gl.uniform1f(vorticityPrg.uniforms['curl'],      config.CURL);
      gl.uniform1f(vorticityPrg.uniforms['dt'],        dt);
      blit(velocity.write);
      velocity.swap();

      // Divergence
      divergencePrg.bind();
      gl.uniform2f(divergencePrg.uniforms['texelSize'], velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(divergencePrg.uniforms['uVelocity'], bindTexture(0, velocity.read.tex));
      blit(divergence);

      // Pressure clear
      clearPrg.bind();
      gl.uniform1i(clearPrg.uniforms['uTexture'], bindTexture(0, pressure.read.tex));
      gl.uniform1f(clearPrg.uniforms['value'],    config.PRESSURE);
      blit(pressure.write);
      pressure.swap();

      // Pressure jacobi
      pressurePrg.bind();
      gl.uniform2f(pressurePrg.uniforms['texelSize'], velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(pressurePrg.uniforms['uDivergence'], bindTexture(0, divergence.tex));
      for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(pressurePrg.uniforms['uPressure'], bindTexture(1, pressure.read.tex));
        blit(pressure.write);
        pressure.swap();
      }

      // Gradient subtract
      gradSubPrg.bind();
      gl.uniform2f(gradSubPrg.uniforms['texelSize'], velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(gradSubPrg.uniforms['uPressure'], bindTexture(0, pressure.read.tex));
      gl.uniform1i(gradSubPrg.uniforms['uVelocity'], bindTexture(1, velocity.read.tex));
      blit(velocity.write);
      velocity.swap();

      // Advect velocity
      advectionPrg.bind();
      gl.uniform2f(advectionPrg.uniforms['texelSize'],    velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform2f(advectionPrg.uniforms['dyeTexelSize'], velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(advectionPrg.uniforms['uVelocity'],   bindTexture(0, velocity.read.tex));
      gl.uniform1i(advectionPrg.uniforms['uSource'],     bindTexture(1, velocity.read.tex));
      gl.uniform1f(advectionPrg.uniforms['dt'],          dt);
      gl.uniform1f(advectionPrg.uniforms['dissipation'], config.VELOCITY_DISSIPATION);
      blit(velocity.write);
      velocity.swap();

      // Advect dye
      gl.uniform2f(advectionPrg.uniforms['dyeTexelSize'], dye.texelSizeX, dye.texelSizeY);
      gl.uniform1i(advectionPrg.uniforms['uVelocity'],   bindTexture(0, velocity.read.tex));
      gl.uniform1i(advectionPrg.uniforms['uSource'],     bindTexture(1, dye.read.tex));
      gl.uniform1f(advectionPrg.uniforms['dissipation'], config.DENSITY_DISSIPATION);
      blit(dye.write);
      dye.swap();
    }

    function splat(x, y, dx, dy, color) {
      splatPrg.bind();
      gl.uniform1i(splatPrg.uniforms['uTarget'],     bindTexture(0, velocity.read.tex));
      gl.uniform1f(splatPrg.uniforms['aspectRatio'], canvas.width / canvas.height);
      gl.uniform2f(splatPrg.uniforms['point'],       x, y);
      gl.uniform3f(splatPrg.uniforms['color'],       dx, dy, 0.0);
      gl.uniform1f(splatPrg.uniforms['radius'],      correctRadius(config.SPLAT_RADIUS / 100.0));
      blit(velocity.write);
      velocity.swap();

      gl.uniform1i(splatPrg.uniforms['uTarget'],     bindTexture(0, dye.read.tex));
      gl.uniform3f(splatPrg.uniforms['color'],       color.r, color.g, color.b);
      blit(dye.write);
      dye.swap();
    }

    function correctRadius(r) {
      const aspectRatio = canvas.width / canvas.height;
      return aspectRatio > 1 ? r * aspectRatio : r;
    }

    function render() {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.viewport(0, 0, canvas.width, canvas.height);
      displayPrg.bind();
      gl.uniform1i(displayPrg.uniforms['uTexture'], bindTexture(0, dye.read.tex));
      blit(null);
    }

    // ─── Mouse/touch interaction ────────────────────────────────────────────────
    let lastX = -1, lastY = -1;
    let colorIdx = 0;

    function getColor() {
      const c = PURPLE_COLORS[colorIdx % PURPLE_COLORS.length];
      colorIdx++;
      return c;
    }

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / canvas.width;
      const y = 1.0 - (e.clientY - rect.top) / canvas.height;
      if (lastX < 0) { lastX = x; lastY = y; return; }
      const dx = (x - lastX) * config.SPLAT_FORCE;
      const dy = (y - lastY) * config.SPLAT_FORCE;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > 0.1) {
        splat(x, y, dx, dy, getColor());
      }
      lastX = x; lastY = y;
    }

    function onTouchMove(e) {
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = (t.clientX - rect.left) / canvas.width;
      const y = 1.0 - (t.clientY - rect.top) / canvas.height;
      if (lastX < 0) { lastX = x; lastY = y; return; }
      const dx = (x - lastX) * config.SPLAT_FORCE;
      const dy = (y - lastY) * config.SPLAT_FORCE;
      splat(x, y, dx, dy, getColor());
      lastX = x; lastY = y;
    }

    // ─── Main loop ─────────────────────────────────────────────────────────────
    resizeCanvas();
    initFramebuffers();

    // Seed a few gentle opening splats
    setTimeout(() => {
      for (let i = 0; i < 3; i++) {
        splat(Math.random(), Math.random(),
          (Math.random()-0.5)*400, (Math.random()-0.5)*400,
          getColor());
      }
    }, 100);

    let lastTime = Date.now();
    let frameId;

    function update() {
      if (resizeCanvas()) initFramebuffers();
      const dt = Math.min((Date.now() - lastTime) / 1000, 0.016667);
      lastTime = Date.now();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);
      step(dt);
      render();
      frameId = requestAnimationFrame(update);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchstart', e => { lastX = -1; lastY = -1; });

    frameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchstart', () => {});
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-0 block pointer-events-none"
      style={{ isolation: 'isolate', opacity: 0.55 }}
    />
  );
};

export default FluidSimulation;

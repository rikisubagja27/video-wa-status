import type {VideoSample} from 'mediabunny';
import type {EnhanceLevel} from '../types/video';

const VERTEX_SHADER_SRC = `#version 300 es
precision highp float;
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Real-time GPU Video Restoration Shader:
// 1) Edge-preserving deblock/bilateral denoise (removes macroblocks & mosquito noise on blurry/downloaded clips)
// 2) Contrast-Adaptive Sharpening (CAS-inspired) so edges/faces/text become sharp without white halos
// 3) Subtle micro-contrast & color clarity boost
const FRAGMENT_SHADER_SRC = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform float u_deblock;
uniform float u_sharpen;
uniform float u_contrast;
uniform float u_saturation;
in vec2 v_uv;
out vec4 outColor;

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec3 c = texture(u_tex, v_uv).rgb;
  vec3 n = texture(u_tex, v_uv + vec2(0.0, -u_texel.y)).rgb;
  vec3 s = texture(u_tex, v_uv + vec2(0.0, u_texel.y)).rgb;
  vec3 w = texture(u_tex, v_uv + vec2(-u_texel.x, 0.0)).rgb;
  vec3 e = texture(u_tex, v_uv + vec2(u_texel.x, 0.0)).rgb;

  vec3 nw = texture(u_tex, v_uv + vec2(-u_texel.x, -u_texel.y)).rgb;
  vec3 ne = texture(u_tex, v_uv + vec2(u_texel.x, -u_texel.y)).rgb;
  vec3 sw = texture(u_tex, v_uv + vec2(-u_texel.x, u_texel.y)).rgb;
  vec3 se = texture(u_tex, v_uv + vec2(u_texel.x, u_texel.y)).rgb;

  // Step 1: Edge-preserving bilateral deblock/denoise for compressed/blurry inputs
  vec3 base = c;
  if (u_deblock > 0.001) {
    float lc = luma(c);
    float thresh = 0.095;
    float wn = exp(-pow((luma(n) - lc) / thresh, 2.0));
    float ws = exp(-pow((luma(s) - lc) / thresh, 2.0));
    float ww = exp(-pow((luma(w) - lc) / thresh, 2.0));
    float we = exp(-pow((luma(e) - lc) / thresh, 2.0));
    float wnw = 0.7 * exp(-pow((luma(nw) - lc) / thresh, 2.0));
    float wne = 0.7 * exp(-pow((luma(ne) - lc) / thresh, 2.0));
    float wsw = 0.7 * exp(-pow((luma(sw) - lc) / thresh, 2.0));
    float wse = 0.7 * exp(-pow((luma(se) - lc) / thresh, 2.0));
    float wSum = 1.0 + wn + ws + ww + we + wnw + wne + wsw + wse;
    vec3 smoothCol = (c + n*wn + s*ws + w*ww + e*we + nw*wnw + ne*wne + sw*wsw + se*wse) / wSum;
    base = mix(c, smoothCol, u_deblock);
  }

  // Step 2: Contrast-Adaptive Sharpening (CAS-style, prevents ringing halos & flat-area noise)
  vec3 mn = min(min(min(n, s), min(w, e)), base);
  vec3 mx = max(max(max(n, s), max(w, e)), base);
  vec3 mn2 = min(mn, min(min(nw, ne), min(sw, se)));
  vec3 mx2 = max(mx, max(max(nw, ne), max(sw, se)));
  vec3 minCol = mix(mn, mn2, 0.5);
  vec3 maxCol = mix(mx, mx2, 0.5);

  vec3 amp = clamp(min(minCol, 1.0 - maxCol) / max(maxCol, vec3(1e-4)), 0.0, 1.0);
  amp = sqrt(amp);
  float peak = -1.0 / mix(8.0, 4.6, clamp(u_sharpen, 0.0, 1.0));
  vec3 weight = amp * peak;

  vec3 crossAvg = n + s + w + e;
  vec3 sharpened = (base + crossAvg * weight) / max(1.0 + 4.0 * weight, vec3(1e-4));
  // Anti-ringing clamp around local neighborhood
  sharpened = clamp(sharpened, minCol * 0.96, maxCol * 1.04);

  vec3 result = mix(base, sharpened, clamp(u_sharpen * 1.15, 0.0, 1.0));

  // Step 3: Subtle S-curve micro-contrast & color clarity
  vec3 centered = result - 0.5;
  result = clamp(0.5 + centered * u_contrast, 0.0, 1.0);
  float grey = luma(result);
  result = clamp(mix(vec3(grey), result, u_saturation), 0.0, 1.0);

  outColor = vec4(result, 1.0);
}
`;

export interface GpuFrameEnhancer {
  processSample: (sample: VideoSample) => HTMLCanvasElement;
  dispose: () => void;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create WebGL2 shader');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

export function createGpuFrameEnhancer(
  targetWidth: number,
  targetHeight: number,
  enhanceLevel: EnhanceLevel,
): GpuFrameEnhancer | null {
  if (typeof document === 'undefined') return null;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetWidth;
  outCanvas.height = targetHeight;

  const gl = outCanvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });

  if (!gl) {
    // 2D Canvas fallback with clean CSS filter clarity if WebGL2 is unavailable
    const ctx2d = outCanvas.getContext('2d', {alpha: false});
    if (!ctx2d) return null;
    ctx2d.imageSmoothingEnabled = true;
    ctx2d.imageSmoothingQuality = 'high';
    return {
      processSample(sample: VideoSample): HTMLCanvasElement {
        if (enhanceLevel === 'strong') {
          ctx2d.filter = 'contrast(1.07) saturate(1.06)';
        } else if (enhanceLevel === 'balanced') {
          ctx2d.filter = 'contrast(1.03) saturate(1.03)';
        } else {
          ctx2d.filter = 'none';
        }
        sample.draw(ctx2d, 0, 0, targetWidth, targetHeight);
        return outCanvas;
      },
      dispose() {
        outCanvas.width = 1;
        outCanvas.height = 1;
      },
    };
  }

  let program: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let vbo: WebGLBuffer | null = null;
  let tex: WebGLTexture | null = null;
  let stagingCanvas: HTMLCanvasElement | null = null;
  let stagingCtx: CanvasRenderingContext2D | null = null;

  try {
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create WebGL2 program');
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'WebGL2 link failed');
    }

    vao = gl.createVertexArray();
    vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const posLoc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.useProgram(program);
    gl.viewport(0, 0, targetWidth, targetHeight);

    const uTexLoc = gl.getUniformLocation(program, 'u_tex');
    const uTexelLoc = gl.getUniformLocation(program, 'u_texel');
    const uDeblockLoc = gl.getUniformLocation(program, 'u_deblock');
    const uSharpenLoc = gl.getUniformLocation(program, 'u_sharpen');
    const uContrastLoc = gl.getUniformLocation(program, 'u_contrast');
    const uSaturationLoc = gl.getUniformLocation(program, 'u_saturation');

    const params =
      enhanceLevel === 'strong'
        ? {deblock: 0.55, sharpen: 0.85, contrast: 1.07, saturation: 1.06}
        : enhanceLevel === 'balanced'
          ? {deblock: 0.22, sharpen: 0.48, contrast: 1.03, saturation: 1.03}
          : {deblock: 0.0, sharpen: 0.0, contrast: 1.0, saturation: 1.0};

    gl.uniform1i(uTexLoc, 0);
    gl.uniform1f(uDeblockLoc, params.deblock);
    gl.uniform1f(uSharpenLoc, params.sharpen);
    gl.uniform1f(uContrastLoc, params.contrast);
    gl.uniform1f(uSaturationLoc, params.saturation);

    return {
      processSample(sample: VideoSample): HTMLCanvasElement {
        const srcW = Math.max(1, sample.displayWidth);
        const srcH = Math.max(1, sample.displayHeight);

        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform2f(uTexelLoc, 1.0 / srcW, 1.0 / srcH);

        // If sample carries rotation/flip or sub-rect crop, bake orientation safely via 2D staging
        const hasSubRect =
          sample.visibleRect.left !== 0 ||
          sample.visibleRect.top !== 0 ||
          sample.visibleRect.width !== sample.codedWidth ||
          sample.visibleRect.height !== sample.codedHeight;

        if (sample.rotation !== 0 || sample.flip || hasSubRect) {
          if (!stagingCanvas) {
            stagingCanvas = document.createElement('canvas');
            stagingCtx = stagingCanvas.getContext('2d', {alpha: false});
          }
          if (stagingCanvas && stagingCtx) {
            if (stagingCanvas.width !== srcW || stagingCanvas.height !== srcH) {
              stagingCanvas.width = srcW;
              stagingCanvas.height = srcH;
            }
            sample.draw(stagingCtx, 0, 0, srcW, srcH);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, stagingCanvas);
          }
        } else {
          const frame = sample.toVideoFrame();
          try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
          } finally {
            frame.close();
          }
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.flush();
        return outCanvas;
      },
      dispose() {
        try {
          if (tex) gl.deleteTexture(tex);
          if (vbo) gl.deleteBuffer(vbo);
          if (vao) gl.deleteVertexArray(vao);
          if (program) gl.deleteProgram(program);
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        } catch {
          // Ignore cleanup issues
        }
        if (stagingCanvas) {
          stagingCanvas.width = 1;
          stagingCanvas.height = 1;
          stagingCanvas = null;
          stagingCtx = null;
        }
        outCanvas.width = 1;
        outCanvas.height = 1;
      },
    };
  } catch {
    // Fallback if shader compilation fails on an unusual GPU driver
    outCanvas.width = 1;
    outCanvas.height = 1;
    return null;
  }
}

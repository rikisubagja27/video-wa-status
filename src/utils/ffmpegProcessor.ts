import {FFmpeg} from '@ffmpeg/ffmpeg';
import {toBlobURL} from '@ffmpeg/util';
import type {
  EnhanceLevel,
  OptimizationResult,
  OptimizationSettings,
  VideoMetadata,
} from '../types/video';
import {computeTargetDimensions, computeWhatsAppSweetSpotKbps} from './videoMath';
import {
  cancelWebCodecsConversion,
  isWebCodecsSupported,
  processVideoWithWebCodecs,
} from './webcodecsProcessor';

export {computeTargetDimensions, computeWhatsAppSweetSpotKbps} from './videoMath';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function buildChunkedWasmBlobURL(): Promise<string> {
  try {
    const [res0, res1] = await Promise.all([
      fetch('/ffmpeg/ffmpeg-core.wasm.part0'),
      fetch('/ffmpeg/ffmpeg-core.wasm.part1'),
    ]);
    if (res0.ok && res1.ok) {
      const [buf0, buf1] = await Promise.all([res0.arrayBuffer(), res1.arrayBuffer()]);
      const combined = new Blob([buf0, buf1], {type: 'application/wasm'});
      return URL.createObjectURL(combined);
    }
  } catch {
    // Fall through to single-file / CDN fallback
  }

  try {
    const singleRes = await fetch('/ffmpeg/ffmpeg-core.wasm');
    if (singleRes.ok) {
      const buf = await singleRes.arrayBuffer();
      return URL.createObjectURL(new Blob([buf], {type: 'application/wasm'}));
    }
  } catch {
    // Fall through to CDN fallback
  }

  return toBlobURL(
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm',
    'application/wasm',
  );
}

export async function getFFmpegInstance(
  onStatus?: (msg: string) => void,
): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    onStatus?.('Memuat engine FFmpeg WebAssembly lokal...');

    const coreURL = await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript');
    const wasmURL = await buildChunkedWasmBlobURL();

    try {
      await ffmpeg.load({
        coreURL,
        wasmURL,
      });
    } finally {
      URL.revokeObjectURL(coreURL);
      URL.revokeObjectURL(wasmURL);
    }

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    ffmpegInstance = null;
    throw err;
  }
}

export function resetFFmpegInstance(): void {
  cancelWebCodecsConversion();
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate();
    } catch {
      // Ignore termination errors
    }
  }
  ffmpegInstance = null;
  loadPromise = null;
}

function buildOutputFilename(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'wa-status-video';
  const safeBase = base.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48);
  return `${safeBase}_WA_HD.mp4`;
}

export async function processVideoWithFFmpeg(
  sourceFile: File,
  sourceMeta: VideoMetadata,
  settings: OptimizationSettings,
  callbacks: {
    onProgress: (percent: number) => void;
    onStatus: (message: string) => void;
  },
): Promise<OptimizationResult> {
  const startedAt = performance.now();
  const ffmpeg = await getFFmpegInstance(callbacks.onStatus);

  const ext = sourceFile.name.split('.').pop()?.toLowerCase() || 'mp4';
  const inputFileName = `input_${Date.now()}.${ext}`;
  const outputFileName = `output_${Date.now()}.mp4`;

  const progressHandler = ({progress}: {progress: number}) => {
    const clamped = Math.max(0, Math.min(99, Math.round(progress * 100)));
    callbacks.onProgress(clamped);
  };

  ffmpeg.on('progress', progressHandler);

  try {
    callbacks.onStatus('Menyiapkan video di memori lokal perangkat...');
    callbacks.onProgress(2);

    const buffer = await sourceFile.arrayBuffer();
    await ffmpeg.writeFile(inputFileName, new Uint8Array(buffer));

    const targetDims = computeTargetDimensions(
      sourceMeta.width,
      sourceMeta.height,
      settings.quality,
      sourceMeta.durationSec,
    );

    let effectiveFps = 30;
    if (settings.fps === '60') {
      effectiveFps = !sourceMeta.fps || sourceMeta.fps >= 50 ? 60 : Math.round(sourceMeta.fps);
    } else if (settings.fps === '30') {
      effectiveFps = 30;
    } else if (sourceMeta.fps) {
      effectiveFps = Math.min(60, Math.max(24, Math.round(sourceMeta.fps)));
    }

    const audioKbps = settings.audio === 'aac-128' ? 128 : 192;
    const targetShortSide = Math.min(targetDims.width, targetDims.height);
    const effectiveEnhance: EnhanceLevel =
      settings.enhanceLevel !== 'off'
        ? settings.enhanceLevel
        : settings.lanczosSharpen
          ? 'balanced'
          : 'off';

    const buildArgs = (codec: 'h264' | 'h265'): string[] => {
      const args: string[] = ['-i', inputFileName];
      const filters: string[] = [];

      // For blurry/blocky inputs, denoise compression squares before sharpening & scaling
      if (effectiveEnhance === 'strong') {
        filters.push('hqdn3d=1.6:1.2:4:3');
      }

      if (targetDims.resized) {
        const scaleFlags =
          effectiveEnhance !== 'off' || settings.lanczosSharpen ? 'lanczos' : 'bicubic';
        filters.push(`scale=${targetDims.width}:${targetDims.height}:flags=${scaleFlags}`);
      }

      // Luma-only sharpening prevents chroma ringing while visibly sharpening blurry faces & text
      if (effectiveEnhance === 'strong') {
        filters.push('unsharp=5:5:0.85:3:3:0.0');
        filters.push('eq=contrast=1.06:saturation=1.05');
      } else if (effectiveEnhance === 'balanced') {
        filters.push('unsharp=5:5:0.45:3:3:0.0');
        filters.push('eq=contrast=1.03:saturation=1.03');
      }

      if (filters.length > 0) {
        args.push('-vf', filters.join(','));
      }

      if (settings.enforceCfr) {
        args.push('-vsync', 'cfr');
      }

      if (settings.fps !== 'original') {
        const targetFps = Number(settings.fps);
        if (!sourceMeta.fps || sourceMeta.fps >= targetFps - 1) {
          args.push('-r', String(targetFps));
        }
      } else if (settings.enforceCfr && sourceMeta.fps) {
        args.push('-r', String(effectiveFps));
      }

      if (codec === 'h265') {
        args.push('-c:v', 'libx265', '-tag:v', 'hvc1');
      } else {
        args.push(
          '-c:v',
          'libx264',
          '-profile:v',
          'high',
          '-level',
          '4.1',
          '-bf',
          '2',
          '-g',
          String(effectiveFps * 2),
          '-keyint_min',
          String(effectiveFps),
        );
      }

      args.push(
        '-preset',
        'superfast',
        '-pix_fmt',
        'yuv420p',
        '-colorspace',
        'bt709',
        '-color_primaries',
        'bt709',
        '-color_trc',
        'bt709',
      );

      if (settings.bitrate === 'wa-1200k') {
        args.push('-crf', '20', '-maxrate', '1350k', '-bufsize', '2700k');
      } else if (settings.bitrate === 'wa-2200k') {
        args.push('-crf', '18', '-maxrate', '2400k', '-bufsize', '4800k');
      } else if (settings.bitrate === 'wa-3200k') {
        args.push('-crf', '17', '-maxrate', '3400k', '-bufsize', '6800k');
      } else if (settings.bitrate === 'wa-auto') {
        const maxKbps = computeWhatsAppSweetSpotKbps(
          sourceMeta.durationSec,
          audioKbps,
          targetShortSide,
        );
        const bufKbps = Math.round(maxKbps * 2);
        args.push(
          '-crf',
          '18',
          '-maxrate',
          `${maxKbps}k`,
          '-bufsize',
          `${bufKbps}k`,
        );
      } else if (settings.bitrate === 'auto-hd') {
        args.push('-crf', codec === 'h265' ? '19' : '16', '-maxrate', '9M', '-bufsize', '18M');
      } else {
        const rateMap: Record<string, {crf: string; max: string; buf: string}> = {
          '6m': {crf: '17', max: '6.5M', buf: '13M'},
          '8m': {crf: '16', max: '8.5M', buf: '17M'},
          '12m': {crf: '15', max: '12M', buf: '24M'},
        };
        const r = rateMap[settings.bitrate];
        args.push('-crf', r.crf, '-maxrate', r.max, '-bufsize', r.buf);
      }

      if (settings.audio === 'copy') {
        args.push('-c:a', 'copy');
      } else if (settings.audio === 'aac-128') {
        args.push('-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2');
      } else {
        args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2');
      }

      args.push('-movflags', '+faststart', '-y', outputFileName);
      return args;
    };

    let codecUsed = settings.codec === 'h265' ? 'H.265 (HEVC)' : 'H.264 (AVC)';
    let note: string | undefined;

    callbacks.onStatus(
      effectiveEnhance === 'strong'
        ? `Merestorasi detail video buram (${codecUsed})...`
        : `Mengoptimalkan video (${codecUsed}, mode cepat CRF)...`,
    );
    let exitCode = await ffmpeg.exec(buildArgs(settings.codec));

    if (exitCode !== 0 && settings.codec === 'h265') {
      callbacks.onStatus('Codec H.265 tidak tersedia di WASM core ini, beralih ke H.264 High Profile...');
      codecUsed = 'H.264 (AVC)';
      note = 'Codec H.265 tidak didukung modul WASM ini; otomatis menggunakan H.264 High Profile agar kompatibel penuh.';
      exitCode = await ffmpeg.exec(buildArgs('h264'));
    }

    if (exitCode !== 0 && settings.audio === 'copy') {
      callbacks.onStatus('Menyesuaikan audio ke AAC untuk kompatibilitas MP4...');
      const fallbackArgs = buildArgs('h264').map((a, idx, arr) =>
        a === 'copy' && arr[idx - 1] === '-c:a' ? 'aac' : a,
      );
      exitCode = await ffmpeg.exec(fallbackArgs);
    }

    if (exitCode !== 0) {
      throw new Error(
        `Proses FFmpeg berhenti dengan kode ${exitCode}. Perangkat mungkin kehabisan memori untuk video ini.`,
      );
    }

    callbacks.onStatus('Menyusun file MP4 final...');
    const outputData = await ffmpeg.readFile(outputFileName);
    const bytes = outputData instanceof Uint8Array ? outputData : new Uint8Array();
    if (bytes.byteLength === 0) {
      throw new Error('File hasil optimasi kosong.');
    }

    const outCopy = new Uint8Array(bytes.byteLength);
    outCopy.set(bytes);
    const outFile = new File([outCopy.buffer], buildOutputFilename(sourceFile.name), {
      type: 'video/mp4',
      lastModified: Date.now(),
    });

    const previewUrl = URL.createObjectURL(outFile);
    const estimatedBitrateBps =
      sourceMeta.durationSec > 0
        ? Math.round((outFile.size * 8) / sourceMeta.durationSec)
        : null;

    callbacks.onProgress(100);

    return {
      mode: 'optimize',
      file: outFile,
      previewUrl,
      sizeBytes: outFile.size,
      width: targetDims.width,
      height: targetDims.height,
      durationSec: sourceMeta.durationSec,
      estimatedBitrateBps,
      codecUsed,
      container: 'MP4',
      processingTimeMs: Math.round(performance.now() - startedAt),
      note,
    };
  } finally {
    ffmpeg.off('progress', progressHandler);
    try {
      await ffmpeg.deleteFile(inputFileName);
    } catch {
      // Ignore cleanup error
    }
    try {
      await ffmpeg.deleteFile(outputFileName);
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * Hybrid Optimizer:
 * 1. Tries hardware-accelerated WebCodecs GPU pipeline + WebGL2 CAS/Deblock shader first — 10-30x faster!
 * 2. Seamlessly falls back to tuned FFmpeg WASM (superfast + perceptual CRF + hqdn3d/unsharp) if WebCodecs is unavailable.
 */
export async function optimizeVideoFast(
  sourceFile: File,
  sourceMeta: VideoMetadata,
  settings: OptimizationSettings,
  callbacks: {
    onProgress: (percent: number) => void;
    onStatus: (message: string) => void;
  },
): Promise<OptimizationResult> {
  if (isWebCodecsSupported()) {
    try {
      return await processVideoWithWebCodecs(sourceFile, sourceMeta, settings, callbacks);
    } catch (err) {
      if (err instanceof Error && err.message === 'CANCELLED_BY_USER') {
        throw new Error('Pemrosesan dibatalkan oleh pengguna.');
      }
      callbacks.onStatus('Beralih ke engine FFmpeg WebAssembly lokal...');
      callbacks.onProgress(0);
    }
  }

  return processVideoWithFFmpeg(sourceFile, sourceMeta, settings, callbacks);
}

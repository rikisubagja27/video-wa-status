import {FFmpeg} from '@ffmpeg/ffmpeg';
import {toBlobURL} from '@ffmpeg/util';
import type {
  OptimizationResult,
  OptimizationSettings,
  QualityPreset,
  VideoMetadata,
} from '../types/video';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

function makeEven(n: number): number {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? Math.max(2, rounded) : Math.max(2, rounded - 1);
}

export function computeTargetDimensions(
  sourceW: number,
  sourceH: number,
  preset: QualityPreset,
): {width: number; height: number; downscaled: boolean} {
  if (!sourceW || !sourceH || preset === 'original') {
    return {
      width: makeEven(sourceW || 1080),
      height: makeEven(sourceH || 1920),
      downscaled: false,
    };
  }

  const maxShortSide =
    preset === '720p' ? 720 : preset === '1080p' ? 1080 : 2160;
  const maxLongSide =
    preset === '720p' ? 1280 : preset === '1080p' ? 1920 : 3840;

  const isPortrait = sourceH >= sourceW;
  const shortSide = isPortrait ? sourceW : sourceH;
  const longSide = isPortrait ? sourceH : sourceW;

  // Never upscale
  if (shortSide <= maxShortSide && longSide <= maxLongSide) {
    return {
      width: makeEven(sourceW),
      height: makeEven(sourceH),
      downscaled: false,
    };
  }

  const scaleFactor = Math.min(maxShortSide / shortSide, maxLongSide / longSide);
  return {
    width: makeEven(sourceW * scaleFactor),
    height: makeEven(sourceH * scaleFactor),
    downscaled: true,
  };
}

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
  return `${safeBase}_HD_Pro.mp4`;
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
    );

    const buildArgs = (codec: 'h264' | 'h265'): string[] => {
      const args: string[] = ['-i', inputFileName];

      // Video filter (scale only if downscaling, preserve aspect ratio & even dims)
      if (targetDims.downscaled) {
        args.push('-vf', `scale=${targetDims.width}:${targetDims.height}`);
      }

      // FPS (never upsample above source FPS)
      if (settings.fps !== 'original') {
        const targetFps = Number(settings.fps);
        if (!sourceMeta.fps || sourceMeta.fps >= targetFps) {
          args.push('-r', String(targetFps));
        }
      }

      if (codec === 'h265') {
        args.push('-c:v', 'libx265', '-tag:v', 'hvc1');
      } else {
        args.push('-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1');
      }

      args.push('-preset', 'veryfast', '-pix_fmt', 'yuv420p');

      // Bitrate / CRF tuned for visual quality preservation
      if (settings.bitrate === 'auto-hd') {
        args.push('-crf', codec === 'h265' ? '22' : '19');
      } else {
        const rateMap: Record<string, {bv: string; max: string; buf: string}> = {
          '6m': {bv: '6M', max: '7.5M', buf: '12M'},
          '8m': {bv: '8M', max: '10M', buf: '16M'},
          '12m': {bv: '12M', max: '15M', buf: '24M'},
        };
        const r = rateMap[settings.bitrate];
        args.push('-b:v', r.bv, '-maxrate', r.max, '-bufsize', r.buf);
      }

      // Audio settings
      if (settings.audio === 'copy') {
        args.push('-c:a', 'copy');
      } else if (settings.audio === 'aac-128') {
        args.push('-c:a', 'aac', '-b:a', '128k', '-ac', '2');
      } else {
        args.push('-c:a', 'aac', '-b:a', '192k', '-ac', '2');
      }

      args.push('-movflags', '+faststart', '-y', outputFileName);
      return args;
    };

    let codecUsed = settings.codec === 'h265' ? 'H.265 (HEVC)' : 'H.264 (AVC)';
    let note: string | undefined;

    callbacks.onStatus(`Mengoptimalkan video (${codecUsed})...`);
    let exitCode = await ffmpeg.exec(buildArgs(settings.codec));

    // Graceful fallback if H.265 or audio stream copy fails in WASM core
    if (exitCode !== 0 && settings.codec === 'h265') {
      callbacks.onStatus('Codec H.265 tidak tersedia di WASM core ini, beralih ke H.264 High Profile...');
      codecUsed = 'H.264 (AVC)';
      note = 'Codec H.265 tidak didukung oleh modul WASM browser ini; otomatis menggunakan H.264 High Profile agar kompatibel penuh.';
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
    // Clean temporary files from WASM memory immediately
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

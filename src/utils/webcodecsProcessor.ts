import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  canEncodeVideo,
} from 'mediabunny';
import type {
  OptimizationResult,
  OptimizationSettings,
  VideoMetadata,
} from '../types/video';
import {computeTargetDimensions} from './videoMath';

let activeConversion: Conversion | null = null;

export function cancelWebCodecsConversion(): void {
  if (activeConversion) {
    activeConversion.cancel().catch(() => {});
    activeConversion = null;
  }
}

export function isWebCodecsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoDecoder !== 'undefined' &&
    typeof EncodedVideoChunk !== 'undefined'
  );
}

function buildOutputFilename(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'wa-status-video';
  const safeBase = base.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48);
  return `${safeBase}_WA_HD.mp4`;
}

function resolveTargetVideoBitrateBps(
  settings: OptimizationSettings,
  durationSec: number,
  targetShortSide: number,
  fps: number,
): number {
  if (settings.bitrate === 'wa-1200k') return 1_200_000;
  if (settings.bitrate === 'wa-2200k') return 2_200_000;
  if (settings.bitrate === '6m') return 6_000_000;
  if (settings.bitrate === '8m') return 8_000_000;
  if (settings.bitrate === '12m') return 12_000_000;
  if (settings.bitrate === 'auto-hd') {
    return targetShortSide >= 1080 ? (fps >= 50 ? 9_000_000 : 7_500_000) : 4_200_000;
  }

  // wa-auto: matches 720p Status sweet spot (1.2-2.2 Mbps) or 1080p HD chat path
  const effectiveDuration = Math.min(Math.max(durationSec || 15, 3), 30);
  const audioBps = settings.audio === 'aac-128' ? 128_000 : 192_000;

  if (targetShortSide <= 720) {
    const budgetTotalBps = Math.floor((6.5 * 1024 * 1024 * 8) / effectiveDuration);
    return Math.max(1_200_000, Math.min(2_200_000, budgetTotalBps - audioBps));
  }

  const budgetTotalBps = Math.floor((14.5 * 1024 * 1024 * 8) / effectiveDuration);
  return Math.max(3_500_000, Math.min(5_800_000, budgetTotalBps - audioBps));
}

export async function processVideoWithWebCodecs(
  sourceFile: File,
  sourceMeta: VideoMetadata,
  settings: OptimizationSettings,
  callbacks: {
    onProgress: (percent: number) => void;
    onStatus: (message: string) => void;
  },
): Promise<OptimizationResult> {
  if (!isWebCodecsSupported()) {
    throw new Error('WEBCODECS_UNSUPPORTED');
  }

  const startedAt = performance.now();
  callbacks.onStatus('Mengaktifkan akselerasi GPU perangkat (WebCodecs)...');
  callbacks.onProgress(2);

  const targetDims = computeTargetDimensions(
    sourceMeta.width,
    sourceMeta.height,
    settings.quality,
  );

  // Determine target FPS (never upsample)
  let targetFps: number | undefined;
  if (settings.fps === '30') {
    targetFps = 30;
  } else if (settings.fps === '60') {
    if (!sourceMeta.fps || sourceMeta.fps >= 50) {
      targetFps = 60;
    }
  } else if (settings.enforceCfr && sourceMeta.fps) {
    targetFps = Math.min(60, Math.max(24, Math.round(sourceMeta.fps)));
  }

  const effectiveFps = targetFps ?? Math.round(sourceMeta.fps || 30);
  const targetShortSide = Math.min(targetDims.width, targetDims.height);
  const targetBitrateBps = resolveTargetVideoBitrateBps(
    settings,
    sourceMeta.durationSec,
    targetShortSide,
    effectiveFps,
  );

  let targetCodec: 'avc' | 'hevc' = settings.codec === 'h265' ? 'hevc' : 'avc';
  let note: string | undefined;

  if (targetCodec === 'hevc') {
    const canHevc = await canEncodeVideo('hevc', {
      width: targetDims.width,
      height: targetDims.height,
    }).catch(() => false);
    if (!canHevc) {
      targetCodec = 'avc';
      note =
        'Encoder hardware H.265 tidak tersedia di browser ini; otomatis menggunakan H.264 High Profile untuk kompatibilitas penuh.';
    }
  }

  const canAvc = await canEncodeVideo(targetCodec, {
    width: targetDims.width,
    height: targetDims.height,
  }).catch(() => false);

  if (!canAvc) {
    throw new Error('WEBCODECS_UNSUPPORTED');
  }

  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(sourceFile),
  });

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack || !(await videoTrack.canDecode())) {
      throw new Error('WEBCODECS_UNSUPPORTED');
    }

    const output = new Output({
      format: new Mp4OutputFormat({fastStart: 'in-memory'}),
      target: new BufferTarget(),
    });

    const videoQuality = new Quality({
      bitrate: targetBitrateBps,
      bitrateMode: 'variable',
    });

    const audioBitrate = settings.audio === 'aac-128' ? 128_000 : 192_000;

    const conversion = await Conversion.init({
      input,
      output,
      showWarnings: false,
      video: {
        codec: targetCodec,
        quality: videoQuality,
        ...(targetDims.downscaled
          ? {width: targetDims.width, height: targetDims.height, fit: 'contain'}
          : {}),
        ...(targetFps ? {frameRate: targetFps} : {}),
        keyFrameInterval: 2,
        hardwareAcceleration: 'prefer-hardware',
        forceTranscode: true,
        allowTransformationMetadata: false,
      },
      audio:
        settings.audio === 'copy'
          ? {
              codec: 'aac',
              quality: new Quality({bitrate: 192_000, bitrateMode: 'variable'}),
            }
          : {
              codec: 'aac',
              quality: new Quality({bitrate: audioBitrate, bitrateMode: 'variable'}),
              numberOfChannels: 2,
            },
    });

    if (!conversion.isValid) {
      throw new Error('WEBCODECS_UNSUPPORTED');
    }

    activeConversion = conversion;
    conversion.onProgress = (p) => {
      const pct = Math.max(3, Math.min(99, Math.round(p * 100)));
      callbacks.onProgress(pct);
    };

    callbacks.onStatus('Memproses video cepat dengan akselerasi hardware GPU...');
    await conversion.execute();
    activeConversion = null;

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength === 0) {
      throw new Error('WEBCODECS_EMPTY_OUTPUT');
    }

    const outFile = new File([buffer], buildOutputFilename(sourceFile.name), {
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
      codecUsed:
        targetCodec === 'hevc'
          ? 'H.265 (Hardware GPU)'
          : 'H.264 (Hardware GPU)',
      container: 'MP4',
      processingTimeMs: Math.round(performance.now() - startedAt),
      note,
    };
  } catch (err) {
    activeConversion = null;
    if (err instanceof ConversionCanceledError) {
      throw new Error('CANCELLED_BY_USER');
    }
    throw err;
  } finally {
    input.dispose();
  }
}

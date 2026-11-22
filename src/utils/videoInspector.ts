import type {
  AppSettings,
  DeviceCapabilities,
  OptimizationRecommendation,
  VideoMetadata,
} from '../types/video';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, exp);
  return `${val >= 100 || exp === 0 ? val.toFixed(0) : val.toFixed(2)} ${units[exp]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatBitrate(bps: number | null): string {
  if (!bps || !Number.isFinite(bps) || bps <= 0) return 'Tidak tersedia';
  if (bps >= 1_000_000) {
    return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  }
  return `${Math.round(bps / 1000)} kbps`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function computeAspectRatioLabel(width: number, height: number): string {
  if (!width || !height) return 'Tidak diketahui';
  const ratio = width / height;
  const known: Array<[number, string]> = [
    [9 / 16, '9:16'],
    [16 / 9, '16:9'],
    [3 / 4, '3:4'],
    [4 / 3, '4:3'],
    [4 / 5, '4:5'],
    [1, '1:1'],
    [9 / 21, '9:21'],
    [21 / 9, '21:9'],
  ];
  for (const [target, label] of known) {
    if (Math.abs(ratio - target) < 0.035) {
      return label;
    }
  }
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

export function detectContainer(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'mp4' || file.type === 'video/mp4') return 'MP4';
  if (ext === 'mov' || file.type === 'video/quicktime') return 'MOV (QuickTime)';
  if (ext === 'webm' || file.type === 'video/webm') return 'WebM';
  if (ext === 'm4v' || file.type === 'video/x-m4v') return 'M4V';
  if (ext === '3gp' || file.type === 'video/3gpp') return '3GP';
  return ext ? ext.toUpperCase() : file.type || 'Video';
}

interface BoxProbeResult {
  fps: number | null;
  codecHint: string | null;
}

function readFourCC(view: DataView, offset: number): string {
  if (offset + 4 > view.byteLength) return '';
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function findAscii(bytes: Uint8Array, needle: string): number {
  const target = needle.split('').map((c) => c.charCodeAt(0));
  outer: for (let i = 0; i <= bytes.length - target.length; i++) {
    for (let j = 0; j < target.length; j++) {
      if (bytes[i + j] !== target[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function parseMp4HeaderBuffer(buffer: ArrayBuffer): BoxProbeResult {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  let codecHint: string | null = null;
  if (findAscii(bytes, 'hvc1') !== -1 || findAscii(bytes, 'hev1') !== -1) {
    codecHint = 'H.265 (HEVC)';
  } else if (findAscii(bytes, 'avc1') !== -1 || findAscii(bytes, 'avc3') !== -1) {
    codecHint = 'H.264 (AVC)';
  } else if (findAscii(bytes, 'vp09') !== -1) {
    codecHint = 'VP9';
  } else if (findAscii(bytes, 'av01') !== -1) {
    codecHint = 'AV1';
  }

  // Locate video track mdhd + stts to estimate FPS without loading the whole file into RAM
  let fps: number | null = null;
  try {
    let searchFrom = 0;
    while (searchFrom < bytes.length - 16) {
      const trakOffset = findAscii(bytes.subarray(searchFrom), 'trak');
      if (trakOffset === -1) break;
      const absTrak = searchFrom + trakOffset - 4;
      if (absTrak < 0 || absTrak + 8 > bytes.length) break;
      const trakSize = view.getUint32(absTrak, false);
      const trakEnd = Math.min(bytes.length, absTrak + Math.max(trakSize, 64));
      const trakSlice = bytes.subarray(absTrak, trakEnd);

      const isVideoTrack =
        findAscii(trakSlice, 'vide') !== -1 ||
        findAscii(trakSlice, 'avc1') !== -1 ||
        findAscii(trakSlice, 'hvc1') !== -1 ||
        findAscii(trakSlice, 'hev1') !== -1;

      if (isVideoTrack) {
        const mdhdIdx = findAscii(trakSlice, 'mdhd');
        const sttsIdx = findAscii(trakSlice, 'stts');

        if (mdhdIdx !== -1 && sttsIdx !== -1) {
          const absMdhd = absTrak + mdhdIdx - 4;
          const absStts = absTrak + sttsIdx - 4;

          if (absMdhd + 24 < bytes.length && absStts + 24 < bytes.length) {
            const mdhdVersion = view.getUint8(absMdhd + 8);
            const timescale =
              mdhdVersion === 1
                ? view.getUint32(absMdhd + 28, false)
                : view.getUint32(absMdhd + 20, false);

            const entryCount = view.getUint32(absStts + 12, false);
            if (entryCount > 0 && absStts + 24 <= bytes.length) {
              const sampleDelta = view.getUint32(absStts + 20, false);
              if (timescale > 0 && sampleDelta > 0) {
                const calculated = timescale / sampleDelta;
                if (calculated >= 10 && calculated <= 240) {
                  fps = Math.round(calculated * 100) / 100;
                  break;
                }
              }
            }
          }
        }
      }
      searchFrom = absTrak + 8;
    }
  } catch {
    // Fallback cleanly if container atom layout differs
  }

  // Fallback check via fourCC scan
  if (!codecHint && readFourCC(view, 4) === 'ftyp') {
    const brand = readFourCC(view, 8);
    if (brand.startsWith('qt')) {
      codecHint = 'QuickTime MOV';
    }
  }

  return {fps, codecHint};
}

async function probeMp4Metadata(file: File): Promise<BoxProbeResult> {
  try {
    const chunkLimit = 1024 * 1024; // 1 MB max read slice
    const headSlice = await file.slice(0, Math.min(file.size, chunkLimit)).arrayBuffer();
    const headResult = parseMp4HeaderBuffer(headSlice);
    if (headResult.fps !== null && headResult.codecHint !== null) {
      return headResult;
    }
    if (file.size > chunkLimit) {
      const tailStart = Math.max(0, file.size - chunkLimit);
      const tailSlice = await file.slice(tailStart, file.size).arrayBuffer();
      const tailResult = parseMp4HeaderBuffer(tailSlice);
      return {
        fps: headResult.fps ?? tailResult.fps,
        codecHint: headResult.codecHint ?? tailResult.codecHint,
      };
    }
    return headResult;
  } catch {
    return {fps: null, codecHint: null};
  }
}

export async function inspectVideoFile(file: File): Promise<VideoMetadata> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const videoStats = await new Promise<{width: number; height: number; duration: number}>(
      (resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const timeoutId = window.setTimeout(() => {
          reject(new Error('Waktu pembacaan metadata video habis.'));
        }, 12000);

        video.onloadedmetadata = () => {
          window.clearTimeout(timeoutId);
          resolve({
            width: video.videoWidth || 0,
            height: video.videoHeight || 0,
            duration: Number.isFinite(video.duration) ? video.duration : 0,
          });
        };

        video.onerror = () => {
          window.clearTimeout(timeoutId);
          reject(new Error('Format video ini tidak dapat diputar atau dibaca oleh browser.'));
        };

        video.src = objectUrl;
      },
    );

    const probe = await probeMp4Metadata(file);
    const estimatedBitrateBps =
      videoStats.duration > 0 ? Math.round((file.size * 8) / videoStats.duration) : null;

    return {
      name: file.name,
      sizeBytes: file.size,
      durationSec: videoStats.duration,
      width: videoStats.width,
      height: videoStats.height,
      fps: probe.fps,
      mimeType: file.type || 'video/mp4',
      container: detectContainer(file),
      codecHint: probe.codecHint,
      aspectRatioLabel: computeAspectRatioLabel(videoStats.width, videoStats.height),
      estimatedBitrateBps,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function getDeviceCapabilities(): DeviceCapabilities {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (typeof navigator !== 'undefined' &&
      navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1);
  const isSafari =
    /safari/.test(ua) && !/chrome|crios|fxios|edgios|android/.test(ua);
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as {standalone?: boolean}).standalone === true);

  const deviceMemoryGB =
    typeof navigator !== 'undefined' && 'deviceMemory' in navigator
      ? ((navigator as unknown as {deviceMemory?: number}).deviceMemory ?? null)
      : null;

  let supportsWebShareFiles = false;
  if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
    try {
      const testFile = new File([new Uint8Array([0])], 'test.mp4', {type: 'video/mp4'});
      supportsWebShareFiles = navigator.canShare({files: [testFile]});
    } catch {
      supportsWebShareFiles = false;
    }
  }

  const supportsWasm = typeof WebAssembly === 'object';
  const supports4KProcessing = supportsWasm && !isIOS && (deviceMemoryGB === null || deviceMemoryGB >= 6);

  return {
    isIOS,
    isSafari,
    isStandalone,
    supportsWebShareFiles,
    supportsWasm,
    deviceMemoryGB,
    supports4KProcessing,
  };
}

export function buildRecommendation(
  meta: VideoMetadata,
  caps: DeviceCapabilities,
  appSettings: AppSettings,
): OptimizationRecommendation {
  const shortSide = Math.min(meta.width, meta.height);
  const longSide = Math.max(meta.width, meta.height);
  const isMP4 = meta.container === 'MP4';
  const isH264 = meta.codecHint === 'H.264 (AVC)';
  const isHEVC = meta.codecHint === 'H.265 (HEVC)';
  const mbSize = meta.sizeBytes / (1024 * 1024);
  const bitrateMbps = meta.estimatedBitrateBps ? meta.estimatedBitrateBps / 1_000_000 : 0;

  const statusDurationWarning =
    meta.durationSec > 30
      ? `Durasi video ${formatDuration(meta.durationSec)} melebihi batas 30 detik per klip WhatsApp Status. WhatsApp akan memotong video secara otomatis saat diunggah.`
      : null;

  // Only preserve directly when already MP4 H.264 within WhatsApp Status bitrate/size sweet spot
  if (
    isMP4 &&
    isH264 &&
    shortSide <= 1080 &&
    longSide <= 1920 &&
    bitrateMbps > 0 &&
    bitrateMbps <= 5.5 &&
    mbSize <= 14.8
  ) {
    return {
      recommendedMode: 'preserve',
      recommendedPreset: 'original',
      recommendedCodec: 'h264',
      recommendedBitrate: appSettings.defaultBitrate,
      recommendedFps: 'original',
      headline: 'Gunakan Original Preserve Mode (Sudah di Titik Optimal WA Status)',
      reasons: [
        'Video sudah berformat MP4 H.264 dengan ukuran di bawah ambang batas kompresi berat WhatsApp (~15 MB).',
        'Tidak perlu encoding ulang agar ketajaman, bitrate, dan audio asli tetap terjaga.',
      ],
      statusDurationWarning,
    };
  }

  const reasons: string[] = [];
  if (mbSize > 14.8 || bitrateMbps > 5.5) {
    reasons.push(
      `Ukuran (${mbSize.toFixed(1)} MB) atau bitrate (${bitrateMbps.toFixed(1)} Mbps) melebihi zona aman WhatsApp Status (~15 MB). Mode Anti-Pecah mengunci bitrate presisi agar WhatsApp tidak mengompres ulang secara brutal.`,
    );
  }
  if (shortSide > 1080) {
    reasons.push(
      `Resolusi sumber ${meta.width}×${meta.height} akan di-downscale dengan filter Lanczos ke Full HD 1080p tanpa mengorbankan detail.`,
    );
  }
  if (isHEVC || meta.container.includes('MOV')) {
    reasons.push(
      'Video iPhone MOV/HEVC sering memakai Variable Frame Rate (VFR) & HDR yang membuat gerakan patah-patah saat diunggah. Konversi ke H.264 CFR + BT.709 menjaga gerakan mulus.',
    );
  }
  if (caps.isIOS && shortSide > 1080) {
    reasons.push(
      'Perangkat iPhone terdeteksi: profil 1080p/720p jauh lebih stabil untuk memori Safari dibanding 4K.',
    );
  }
  if (reasons.length === 0) {
    reasons.push(
      'Profil WA Status Anti-Pecah (H.264 High + CFR + BT.709) mengoptimalkan alokasi bit per frame agar video tetap tajam dan mulus setelah diunggah.',
    );
  }

  return {
    recommendedMode: 'optimize',
    recommendedPreset: 'wa-sweetspot',
    recommendedCodec: 'h264',
    recommendedBitrate: 'wa-auto',
    recommendedFps: meta.durationSec > 18 ? '30' : meta.fps && meta.fps >= 50 ? '60' : '30',
    headline: 'Rekomendasi Utama: Mode WA Status Anti-Pecah (Target <= 14.5 MB, CFR)',
    reasons,
    statusDurationWarning,
  };
}

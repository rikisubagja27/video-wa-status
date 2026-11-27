import type {QualityPreset} from '../types/video';

export function makeEven(n: number): number {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? Math.max(2, rounded) : Math.max(2, rounded - 1);
}

/**
 * Computes exact even target dimensions preserving aspect ratio.
 * - `restore-hd`: cleanly upscales blurry/low-res clips (< 1080p) to 1080p HD or downscales > 1080p to 1080p.
 * - `wa-sweetspot`: uses crisp 1080p for shorter clips (<= 18s) or 720p for longer clips, upscaling < 720p clips cleanly to 720p.
 * - `original`, `720p`, `1080p`, `4k`: never upscales unnecessarily.
 */
export function computeTargetDimensions(
  sourceW: number,
  sourceH: number,
  preset: QualityPreset,
  durationSec = 15,
): {width: number; height: number; resized: boolean; downscaled: boolean; upscaled: boolean} {
  const safeW = makeEven(sourceW || 720);
  const safeH = makeEven(sourceH || 1280);

  if (!sourceW || !sourceH || preset === 'original') {
    return {
      width: safeW,
      height: safeH,
      resized: false,
      downscaled: false,
      upscaled: false,
    };
  }

  const isPortrait = sourceH >= sourceW;
  const shortSide = isPortrait ? sourceW : sourceH;
  const longSide = isPortrait ? sourceH : sourceW;

  if (preset === 'restore-hd') {
    const targetShort = 1080;
    const targetLong = 1920;
    const scaleFactor = Math.min(targetShort / shortSide, targetLong / longSide);
    const nextW = makeEven(sourceW * scaleFactor);
    const nextH = makeEven(sourceH * scaleFactor);
    const changed = nextW !== safeW || nextH !== safeH;
    return {
      width: nextW,
      height: nextH,
      resized: changed,
      downscaled: changed && scaleFactor < 1,
      upscaled: changed && scaleFactor > 1,
    };
  }

  if (preset === 'wa-sweetspot') {
    // Shorter clips (<= 18s) stay super crisp at 1080p (~3.2 Mbps => ~7.5 MB);
    // Longer clips (19-30s) or < 720p sources target clean 720p (~2.5-3.2 Mbps => <= 11 MB)
    const prefer1080 = durationSec <= 18 && shortSide >= 900;
    const maxShort = prefer1080 ? 1080 : 720;
    const maxLong = prefer1080 ? 1920 : 1280;

    if (shortSide < maxShort && longSide < maxLong) {
      // Clean GPU upscale for low-res sources (< 720p) so WhatsApp receives crisp HD frames
      const scaleFactor = Math.min(maxShort / shortSide, maxLong / longSide);
      const nextW = makeEven(sourceW * scaleFactor);
      const nextH = makeEven(sourceH * scaleFactor);
      const changed = nextW !== safeW || nextH !== safeH;
      return {
        width: nextW,
        height: nextH,
        resized: changed,
        downscaled: false,
        upscaled: changed,
      };
    }

    if (shortSide <= maxShort && longSide <= maxLong) {
      return {
        width: safeW,
        height: safeH,
        resized: false,
        downscaled: false,
        upscaled: false,
      };
    }

    const scaleFactor = Math.min(maxShort / shortSide, maxLong / longSide);
    const nextW = makeEven(sourceW * scaleFactor);
    const nextH = makeEven(sourceH * scaleFactor);
    const changed = nextW !== safeW || nextH !== safeH;
    return {
      width: nextW,
      height: nextH,
      resized: changed,
      downscaled: changed,
      upscaled: false,
    };
  }

  let maxShortSide = 1080;
  let maxLongSide = 1920;

  if (preset === '720p') {
    maxShortSide = 720;
    maxLongSide = 1280;
  } else if (preset === '4k') {
    maxShortSide = 2160;
    maxLongSide = 3840;
  }

  // Never upscale on standard presets
  if (shortSide <= maxShortSide && longSide <= maxLongSide) {
    return {
      width: safeW,
      height: safeH,
      resized: false,
      downscaled: false,
      upscaled: false,
    };
  }

  const scaleFactor = Math.min(maxShortSide / shortSide, maxLongSide / longSide);
  const nextW = makeEven(sourceW * scaleFactor);
  const nextH = makeEven(sourceH * scaleFactor);
  const changed = nextW !== safeW || nextH !== safeH;
  return {
    width: nextW,
    height: nextH,
    resized: changed,
    downscaled: changed,
    upscaled: false,
  };
}

/**
 * Computes crisp bitrate sweet spot so frames aren't pre-starved before WhatsApp upload,
 * while staying comfortably under WhatsApp's ~15 MB media ceiling.
 */
export function computeWhatsAppSweetSpotKbps(
  durationSec: number,
  audioKbps: number,
  shortSide: number,
): number {
  const effectiveDuration = Math.min(Math.max(durationSec || 15, 3), 30);
  if (shortSide <= 720) {
    // Target ~10.5 MB max budget -> 2.4 to 3.6 Mbps crisp 720p (prevents double-compression mud)
    const targetTotalKbits = 10.5 * 1024 * 8;
    const budgetVideoKbps = Math.floor(targetTotalKbits / effectiveDuration - audioKbps);
    return Math.max(2200, Math.min(3600, budgetVideoKbps));
  }

  // 1080p crisp target (~14.5 MB max budget -> 3.4 to 5.5 Mbps)
  const targetTotalKbits = 14.5 * 1024 * 8;
  const budgetVideoKbps = Math.floor(targetTotalKbits / effectiveDuration - audioKbps);
  return Math.max(3400, Math.min(5500, budgetVideoKbps));
}

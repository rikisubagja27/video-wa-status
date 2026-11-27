import type {QualityPreset} from '../types/video';

export function makeEven(n: number): number {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? Math.max(2, rounded) : Math.max(2, rounded - 1);
}

/**
 * Computes exact even target dimensions preserving aspect ratio without upscaling.
 * For `wa-sweetspot`, pre-scales cleanly to 720p (720x1280 vertical / 1280x720 horizontal)
 * so WhatsApp Status doesn't crush 1080p/4K with its blurry mobile resizer.
 */
export function computeTargetDimensions(
  sourceW: number,
  sourceH: number,
  preset: QualityPreset,
): {width: number; height: number; downscaled: boolean} {
  if (!sourceW || !sourceH || preset === 'original') {
    return {
      width: makeEven(sourceW || 720),
      height: makeEven(sourceH || 1280),
      downscaled: false,
    };
  }

  const isPortrait = sourceH >= sourceW;
  const shortSide = isPortrait ? sourceW : sourceH;
  const longSide = isPortrait ? sourceH : sourceW;

  let maxShortSide = 1080;
  let maxLongSide = 1920;

  if (preset === 'wa-sweetspot' || preset === '720p') {
    maxShortSide = 720;
    maxLongSide = 1280;
  } else if (preset === '4k') {
    maxShortSide = 2160;
    maxLongSide = 3840;
  }

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

export function computeWhatsAppSweetSpotKbps(
  durationSec: number,
  audioKbps: number,
  shortSide: number,
): number {
  const effectiveDuration = Math.min(Math.max(durationSec || 15, 3), 30);
  if (shortSide <= 720) {
    // 720p Status sweet spot: 1.2 - 2.2 Mbps keeps size small (<= 8 MB) and text/faces crisp
    const targetTotalKbits = 6.5 * 1024 * 8;
    const budgetVideoKbps = Math.floor(targetTotalKbits / effectiveDuration - audioKbps);
    return Math.max(1200, Math.min(2200, budgetVideoKbps));
  }

  // 1080p sweet spot (for HD chat forwarding / high-cap uploads)
  const targetTotalKbits = 14.5 * 1024 * 8;
  const budgetVideoKbps = Math.floor(targetTotalKbits / effectiveDuration - audioKbps);
  return Math.max(3500, Math.min(5800, budgetVideoKbps));
}

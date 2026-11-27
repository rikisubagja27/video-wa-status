export type TabId = 'home' | 'optimizer' | 'history' | 'guide' | 'settings';

export type QualityPreset =
  | 'wa-sweetspot'
  | 'restore-hd'
  | 'original'
  | '1080p'
  | '720p'
  | '4k';

export type VideoCodec = 'h264' | 'h265';

export type AudioMode = 'aac-192' | 'aac-128' | 'copy';

export type BitrateMode =
  | 'wa-1200k'
  | 'wa-2200k'
  | 'wa-3200k'
  | 'wa-auto'
  | 'auto-hd'
  | '6m'
  | '8m'
  | '12m';

export type FpsOption = 'original' | '30' | '60';

export type EnhanceLevel = 'off' | 'balanced' | 'strong';

export interface VideoMetadata {
  name: string;
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  fps: number | null;
  mimeType: string;
  container: string;
  codecHint: string | null;
  aspectRatioLabel: string;
  estimatedBitrateBps: number | null;
}

export interface DeviceCapabilities {
  isIOS: boolean;
  isSafari: boolean;
  isStandalone: boolean;
  supportsWebShareFiles: boolean;
  supportsWasm: boolean;
  deviceMemoryGB: number | null;
  supports4KProcessing: boolean;
}

export interface OptimizationRecommendation {
  recommendedMode: 'preserve' | 'optimize';
  recommendedPreset: QualityPreset;
  recommendedCodec: VideoCodec;
  recommendedBitrate: BitrateMode;
  recommendedFps: FpsOption;
  recommendedEnhance: EnhanceLevel;
  headline: string;
  reasons: string[];
  statusDurationWarning: string | null;
}

export interface OptimizationSettings {
  mode: 'preserve' | 'optimize';
  quality: QualityPreset;
  codec: VideoCodec;
  audio: AudioMode;
  bitrate: BitrateMode;
  fps: FpsOption;
  enforceCfr: boolean;
  lanczosSharpen: boolean;
  enhanceLevel: EnhanceLevel;
}

export interface OptimizationResult {
  mode: 'preserve' | 'optimize';
  file: File;
  previewUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationSec: number;
  estimatedBitrateBps: number | null;
  codecUsed: string;
  container: string;
  processingTimeMs: number;
  note?: string;
}

export interface HistoryItem {
  id: string;
  createdAt: number;
  fileName: string;
  mode: 'preserve' | 'optimize';
  qualityLabel: string;
  beforeSizeBytes: number;
  afterSizeBytes: number;
  beforeResolution: string;
  afterResolution: string;
  durationSec: number;
}

export interface AppSettings {
  saveHistory: boolean;
  autoCleanTemp: boolean;
  defaultCodec: VideoCodec;
  defaultBitrate: BitrateMode;
}

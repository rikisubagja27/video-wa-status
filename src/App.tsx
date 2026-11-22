/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  BookOpen,
  Clock,
  FolderOpen,
  Home,
  Settings,
  Sliders,
} from 'lucide-react';
import {motion, AnimatePresence} from 'motion/react';
import type {
  AppSettings,
  HistoryItem,
  OptimizationResult,
  OptimizationSettings,
  TabId,
  VideoMetadata,
} from './types/video';
import {
  buildRecommendation,
  getDeviceCapabilities,
  inspectVideoFile,
} from './utils/videoInspector';
import {
  addHistoryItem,
  clearAllHistory,
  deleteHistoryItem,
  getHistoryItems,
  loadAppSettings,
  saveAppSettings,
} from './utils/storage';
import {resetFFmpegInstance} from './utils/ffmpegProcessor';
import {usePWAInstall} from './hooks/usePWAInstall';
import {BrandLogo} from './components/BrandLogo';
import {PWAInstallButton} from './components/PWAInstallButton';
import {OfflineIndicator} from './components/OfflineIndicator';
import {HomeView} from './components/HomeView';
import {OptimizerView} from './components/OptimizerView';
import {HistoryView} from './components/HistoryView';
import {GuideView} from './components/GuideView';
import {SettingsView} from './components/SettingsView';

const NAV_ITEMS: Array<{
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {id: 'home', label: 'Beranda', shortLabel: 'Beranda', icon: Home},
  {id: 'optimizer', label: 'Optimasi Video', shortLabel: 'Optimasi', icon: Sliders},
  {id: 'history', label: 'Riwayat Proses', shortLabel: 'Riwayat', icon: Clock},
  {id: 'guide', label: 'Panduan', shortLabel: 'Panduan', icon: BookOpen},
  {id: 'settings', label: 'Pengaturan', shortLabel: 'Setelan', icon: Settings},
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadAppSettings());
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const [optimizerSettings, setOptimizerSettings] = useState<OptimizationSettings>(() => ({
    mode: 'optimize',
    quality: 'wa-sweetspot',
    codec: loadAppSettings().defaultCodec,
    audio: 'aac-192',
    bitrate: loadAppSettings().defaultBitrate,
    fps: '30',
    enforceCfr: true,
    lanczosSharpen: true,
  }));
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);

  const globalFileInputRef = useRef<HTMLInputElement>(null);
  const {isInstalled} = usePWAInstall();
  const capabilities = useMemo(() => getDeviceCapabilities(), []);

  const recommendation = useMemo(() => {
    if (!metadata) return null;
    return buildRecommendation(metadata, capabilities, appSettings);
  }, [metadata, capabilities, appSettings]);

  // Load saved metadata history on startup
  useEffect(() => {
    getHistoryItems().then(setHistoryItems).catch(() => {});
  }, []);

  // Revoke object URLs cleanly on change/unmount
  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    return () => {
      if (optimizationResult?.previewUrl && optimizationResult.previewUrl !== sourceUrl) {
        URL.revokeObjectURL(optimizationResult.previewUrl);
      }
    };
  }, [optimizationResult, sourceUrl]);

  const handleSelectFile = useCallback(
    async (file: File) => {
      setInspectError(null);
      setIsInspecting(true);

      // Clear previous result & temp memory if configured
      if (optimizationResult?.previewUrl && optimizationResult.previewUrl !== sourceUrl) {
        URL.revokeObjectURL(optimizationResult.previewUrl);
      }
      setOptimizationResult(null);
      if (appSettings.autoCleanTemp) {
        resetFFmpegInstance();
      }

      const nextUrl = URL.createObjectURL(file);
      try {
        const meta = await inspectVideoFile(file);
        const rec = buildRecommendation(meta, capabilities, appSettings);

        setSourceFile(file);
        setSourceUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
        setMetadata(meta);
        setOptimizerSettings({
          mode: rec.recommendedMode,
          quality: rec.recommendedPreset,
          codec: rec.recommendedCodec,
          audio: 'aac-192',
          bitrate: rec.recommendedBitrate,
          fps: rec.recommendedFps,
          enforceCfr: true,
          lanczosSharpen: true,
        });
      } catch (err) {
        URL.revokeObjectURL(nextUrl);
        setInspectError(
          err instanceof Error
            ? err.message
            : 'Video tidak dapat dibaca. Coba pilih file MP4 atau MOV lain.',
        );
      } finally {
        setIsInspecting(false);
      }
    },
    [appSettings, capabilities, optimizationResult, sourceUrl],
  );

  const handleClearFile = useCallback(() => {
    if (optimizationResult?.previewUrl && optimizationResult.previewUrl !== sourceUrl) {
      URL.revokeObjectURL(optimizationResult.previewUrl);
    }
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
    setOptimizationResult(null);
    setSourceFile(null);
    setSourceUrl(null);
    setMetadata(null);
    setInspectError(null);
    resetFFmpegInstance();
  }, [optimizationResult, sourceUrl]);

  const handleGoToOptimizer = (mode: 'preserve' | 'optimize') => {
    setOptimizerSettings((prev) => ({...prev, mode}));
    setActiveTab('optimizer');
  };

  const handleOptimizationComplete = async (res: OptimizationResult) => {
    setOptimizationResult((prev) => {
      if (prev?.previewUrl && prev.previewUrl !== sourceUrl && prev.previewUrl !== res.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return res;
    });

    if (appSettings.saveHistory && metadata) {
      const entry: HistoryItem = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        fileName: metadata.name,
        mode: res.mode,
        qualityLabel:
          res.mode === 'preserve'
            ? 'Original Preserve'
            : `${optimizerSettings.quality.toUpperCase()} · ${res.codecUsed}`,
        beforeSizeBytes: metadata.sizeBytes,
        afterSizeBytes: res.sizeBytes,
        beforeResolution: `${metadata.width}×${metadata.height}`,
        afterResolution: `${res.width}×${res.height}`,
        durationSec: metadata.durationSec,
      };
      try {
        await addHistoryItem(entry);
        const updated = await getHistoryItems();
        setHistoryItems(updated);
      } catch {
        // Ignore IndexedDB error on private browsing
      }
    }

    if (appSettings.autoCleanTemp && res.mode === 'optimize') {
      resetFFmpegInstance();
    }
  };

  const handleUpdateAppSettings = (next: AppSettings) => {
    setAppSettings(next);
    saveAppSettings(next);
  };

  const handleDeleteHistoryItem = async (id: string) => {
    await deleteHistoryItem(id);
    setHistoryItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllHistory = async () => {
    await clearAllHistory();
    setHistoryItems([]);
  };

  const handleClearMemoryAndCache = async () => {
    handleClearFile();
  };

  const openGlobalPicker = () => {
    globalFileInputRef.current?.click();
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#0A0E12] text-slate-100">
      <input
        ref={globalFileInputRef}
        type="file"
        accept="video/*,.mp4,.mov,.m4v,.webm,.3gp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            handleSelectFile(f);
            setActiveTab('home');
          }
          e.target.value = '';
        }}
        className="hidden"
        aria-label="Pilih video"
      />

      <OfflineIndicator />

      {/* Top Navigation Bar: 3-zone Desktop Contract + Compact Mobile Top Bar */}
      <header className="sticky top-0 z-30 pt-safe bg-[#0A0E12]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 sm:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg cursor-pointer shrink-0"
          >
            <BrandLogo compact />
          </button>

          {/* Zone 2: Desktop Single-Line Nav Links */}
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-2 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-emerald-500 text-white font-semibold'
                      : 'border-transparent text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            {!isInstalled ? (
              <PWAInstallButton onOpenFullGuide={() => setActiveTab('guide')} />
            ) : (
              <button
                type="button"
                onClick={openGlobalPicker}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span>Pilih Video</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-24 md:pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{opacity: 0, y: 6}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -4}}
            transition={{duration: 0.16, ease: [0.16, 1, 0.3, 1]}}
          >
            {activeTab === 'home' && (
              <HomeView
                sourceFile={sourceFile}
                sourceUrl={sourceUrl}
                metadata={metadata}
                recommendation={recommendation}
                capabilities={capabilities}
                isInspecting={isInspecting}
                inspectError={inspectError}
                onSelectFile={handleSelectFile}
                onClearFile={handleClearFile}
                onGoToOptimizer={handleGoToOptimizer}
              />
            )}

            {activeTab === 'optimizer' && (
              <OptimizerView
                sourceFile={sourceFile}
                sourceUrl={sourceUrl}
                metadata={metadata}
                recommendation={recommendation}
                capabilities={capabilities}
                settings={optimizerSettings}
                result={optimizationResult}
                onChangeSettings={setOptimizerSettings}
                onOptimizationComplete={handleOptimizationComplete}
                onRequestSelectVideo={openGlobalPicker}
                onSwitchToHome={() => setActiveTab('home')}
              />
            )}

            {activeTab === 'history' && (
              <HistoryView
                items={historyItems}
                saveHistoryEnabled={appSettings.saveHistory}
                onDeleteItem={handleDeleteHistoryItem}
                onClearAll={handleClearAllHistory}
                onOpenSettings={() => setActiveTab('settings')}
              />
            )}

            {activeTab === 'guide' && <GuideView />}

            {activeTab === 'settings' && (
              <SettingsView
                appSettings={appSettings}
                capabilities={capabilities}
                onUpdateSettings={handleUpdateAppSettings}
                onClearMemoryAndCache={handleClearMemoryAndCache}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Desktop Quiet Footer */}
      <footer className="hidden md:block border-t border-white/10 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-slate-500">
          <span>WA Status HD Pro — Pemrosesan video lokal di browser tanpa unggahan server</span>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className="hover:text-slate-300 transition cursor-pointer"
          >
            Panduan Instalasi PWA iPhone
          </button>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Thumb-Zone Navigation (<= 15% viewport height combined with top bar) */}
      <nav
        aria-label="Navigasi bawah iPhone"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0D1319]/95 backdrop-blur-md border-t border-white/10 pb-safe"
      >
        <div className="grid grid-cols-5 h-14 items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  active ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium tracking-tight whitespace-nowrap">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

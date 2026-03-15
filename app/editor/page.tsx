'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  Download,
  Music2,
  Sparkles,
  ArrowLeft,
  Clock,
  Scissors,
  Loader2,
  Volume2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const WaveformEditor = dynamic(() => import('../../components/WaveformEditor'), {
  ssr: false,
  loading: () => (
    <div className="waveform-container h-40 flex items-center justify-center">
      <Loader2 size={20} className="animate-spin text-[#7070A0]" />
    </div>
  ),
});

interface RingifyData {
  audioUrl: string;
  chorusStart: number;
  chorusEnd: number;
  title: string;
  platform: string;
  duration: number;
}

const PRESET_DURATIONS = [10, 20, 30] as const;

function formatTime(secs: number): string {
  if (isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function EditorPage() {
  const router = useRouter();
  const [data, setData] = useState<RingifyData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(30);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [trimming, setTrimming] = useState(false);
  const [trimError, setTrimError] = useState('');
  const [trimSuccess, setTrimSuccess] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadFormat, setDownloadFormat] = useState<'mp3' | 'm4r'>('mp3');
  const [previewMode, setPreviewMode] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(true);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ringify_data');
      if (!raw) {
        router.push('/');
        return;
      }
      const parsed: RingifyData = JSON.parse(raw);
      setData(parsed);

      if (parsed.chorusStart >= 0 && parsed.chorusEnd > parsed.chorusStart) {
        setTrimStart(parsed.chorusStart);
        setTrimEnd(parsed.chorusEnd);
      }
      if (parsed.duration) {
        setDuration(parsed.duration);
      }
    } catch {
      router.push('/');
    }
  }, [router]);

  const handleRegionChange = useCallback((start: number, end: number) => {
    setTrimStart(start);
    setTrimEnd(end);
    setTrimSuccess(false);
    setDownloadUrl('');
    if (aiSuggested) setAiSuggested(false);
  }, [aiSuggested]);

  const handleDurationReady = useCallback((d: number) => {
    setDuration(d);
  }, []);

  const handleTimeUpdate = useCallback((t: number) => {
    setCurrentTime(t);
  }, []);

  const handlePlayToggle = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const applyPreset = (secs: number) => {
    if (!data) return;
    const midpoint = data.chorusStart + (data.chorusEnd - data.chorusStart) / 2;
    const half = secs / 2;
    const newStart = Math.max(0, midpoint - half);
    const newEnd = Math.min(duration || 300, newStart + secs);
    setTrimStart(newStart);
    setTrimEnd(newEnd);
    setAiSuggested(false);
    setTrimSuccess(false);
    setDownloadUrl('');
  };

  const resetToAI = () => {
    if (!data) return;
    setTrimStart(data.chorusStart);
    setTrimEnd(data.chorusEnd);
    setAiSuggested(true);
    setTrimSuccess(false);
    setDownloadUrl('');
  };

  const handleTrim = async () => {
    if (!data || trimming) return;
    setTrimming(true);
    setTrimError('');
    setTrimSuccess(false);

    try {
      const res = await fetch('/api/trim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: data.audioUrl,
          startTime: trimStart,
          endTime: trimEnd,
          format: downloadFormat,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Trim failed');
      }

      setDownloadUrl(result.ringtoneUrl);
      setTrimSuccess(true);

      // Store ringtone data for download page
      sessionStorage.setItem(
        'ringify_ringtone',
        JSON.stringify({
          ringtoneUrl: result.ringtoneUrl,
          title: data.title,
          duration: trimEnd - trimStart,
          format: downloadFormat,
        })
      );
    } catch (err: unknown) {
      setTrimError(err instanceof Error ? err.message : 'Trim failed. Please try again.');
    } finally {
      setTrimming(false);
    }
  };

  const trimDuration = trimEnd - trimStart;

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#FF3B5C]" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-[#E8E8F0]">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-[0.06]"
          style={{ background: 'radial-gradient(ellipse, #FF3B5C, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-10"
        >
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-[#7070A0] hover:text-[#E8E8F0] transition-colors text-sm font-mono"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF8C42)' }}
            >
              <Music2 size={15} className="text-white" />
            </div>
            <span className="font-display text-lg font-700 tracking-tight">Ringify</span>
          </div>

          <div className="text-xs font-mono text-[#3A3A5C]">
            Editor
          </div>
        </motion.div>

        {/* Track Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-5 mb-6 flex items-center gap-4"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(255,59,92,0.2), rgba(255,140,66,0.2))' }}
          >
            <Music2 size={20} className="text-[#FF3B5C]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-600 text-base truncate">{data.title}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-mono text-[#7070A0]">{data.platform}</span>
              {duration > 0 && (
                <span className="text-xs font-mono text-[#3A3A5C]">
                  {formatTime(duration)} total
                </span>
              )}
            </div>
          </div>

          {/* AI badge */}
          {aiSuggested && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(255,209,102,0.08)] border border-[rgba(255,209,102,0.2)] rounded-full text-xs font-mono text-[#FFD166] flex-shrink-0">
              <Sparkles size={11} />
              AI Selected
            </div>
          )}
        </motion.div>

        {/* Waveform Editor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-600 text-sm flex items-center gap-2">
              <Scissors size={14} className="text-[#06D6A0]" />
              Waveform Editor
            </h2>
            <div className="flex items-center gap-2">
              <Volume2 size={12} className="text-[#3A3A5C]" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20"
              />
            </div>
          </div>

          <WaveformEditor
            audioUrl={data.audioUrl}
            chorusStart={data.chorusStart}
            chorusEnd={data.chorusEnd}
            trimStart={trimStart}
            trimEnd={trimEnd}
            volume={volume}
            onRegionChange={handleRegionChange}
            onDurationReady={handleDurationReady}
            onTimeUpdate={handleTimeUpdate}
            onPlayToggle={handlePlayToggle}
          />

          {/* Time display */}
          <div className="flex items-center justify-between mt-4 text-xs font-mono">
            <span className="text-[#3A3A5C]">{formatTime(currentTime)}</span>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#1E1E2E] rounded-full">
              <Clock size={11} className="text-[#06D6A0]" />
              <span className="text-[#E8E8F0]">{trimDuration.toFixed(1)}s selected</span>
            </div>
            <span className="text-[#3A3A5C]">{formatTime(duration)}</span>
          </div>

          {/* AI Hint */}
          {data.chorusStart >= 0 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-[#3A3A5C] font-mono">
                <span className="text-[#FF3B5C]">▊</span> Red region = AI detected chorus
                &nbsp;&nbsp;
                <span className="text-[#06D6A0]">▊</span> Green handles = your selection
              </p>
              {!aiSuggested && (
                <button
                  onClick={resetToAI}
                  className="text-xs font-mono text-[#FFD166] hover:text-[#FFE08A] transition-colors flex items-center gap-1"
                >
                  <Sparkles size={11} />
                  Reset to AI
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* Controls Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"
        >
          {/* Manual time inputs */}
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-5">
            <h3 className="font-display font-600 text-sm mb-4 flex items-center gap-2">
              <Clock size={13} className="text-[#FF8C42]" />
              Manual Selection
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-[#7070A0] mb-2">Start (sec)</label>
                <input
                  type="number"
                  min="0"
                  max={trimEnd - 1}
                  step="0.1"
                  value={trimStart.toFixed(1)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v >= 0 && v < trimEnd) {
                      setTrimStart(v);
                      setAiSuggested(false);
                      setTrimSuccess(false);
                    }
                  }}
                  className="w-full bg-[#0E0E18] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm font-mono text-[#E8E8F0] outline-none focus:border-[#FF3B5C] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#7070A0] mb-2">End (sec)</label>
                <input
                  type="number"
                  min={trimStart + 1}
                  max={duration || 999}
                  step="0.1"
                  value={trimEnd.toFixed(1)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > trimStart) {
                      setTrimEnd(v);
                      setAiSuggested(false);
                      setTrimSuccess(false);
                    }
                  }}
                  className="w-full bg-[#0E0E18] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm font-mono text-[#E8E8F0] outline-none focus:border-[#FF3B5C] transition-colors"
                />
              </div>
            </div>

            {/* Start slider */}
            <div className="mt-3">
              <input
                type="range"
                min="0"
                max={duration || 300}
                step="0.1"
                value={trimStart}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (v < trimEnd) {
                    setTrimStart(v);
                    setAiSuggested(false);
                    setTrimSuccess(false);
                  }
                }}
                className="w-full"
              />
              <input
                type="range"
                min="0"
                max={duration || 300}
                step="0.1"
                value={trimEnd}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (v > trimStart) {
                    setTrimEnd(v);
                    setAiSuggested(false);
                    setTrimSuccess(false);
                  }
                }}
                className="w-full mt-2"
              />
            </div>
          </div>

          {/* Duration presets + format */}
          <div className="bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-5">
            <h3 className="font-display font-600 text-sm mb-4 flex items-center gap-2">
              <Scissors size={13} className="text-[#FFD166]" />
              Duration Presets
            </h3>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {PRESET_DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => applyPreset(d)}
                  className="py-2 rounded-lg text-sm font-mono transition-all border"
                  style={{
                    background: Math.abs(trimDuration - d) < 0.5 ? 'rgba(255,209,102,0.1)' : '#0E0E18',
                    borderColor: Math.abs(trimDuration - d) < 0.5 ? '#FFD166' : '#1E1E2E',
                    color: Math.abs(trimDuration - d) < 0.5 ? '#FFD166' : '#7070A0',
                  }}
                >
                  {d}s
                </button>
              ))}
            </div>

            <p className="text-xs font-mono text-[#3A3A5C] mb-3 uppercase tracking-widest">Output Format</p>
            <div className="grid grid-cols-2 gap-2">
              {(['mp3', 'm4r'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => { setDownloadFormat(fmt); setTrimSuccess(false); setDownloadUrl(''); }}
                  className="py-2 rounded-lg text-sm font-mono transition-all border flex flex-col items-center gap-0.5"
                  style={{
                    background: downloadFormat === fmt ? 'rgba(6,214,160,0.08)' : '#0E0E18',
                    borderColor: downloadFormat === fmt ? '#06D6A0' : '#1E1E2E',
                    color: downloadFormat === fmt ? '#06D6A0' : '#7070A0',
                  }}
                >
                  <span className="uppercase font-700">.{fmt}</span>
                  <span className="text-[10px] opacity-60">
                    {fmt === 'mp3' ? 'Android' : 'iPhone'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Trim & Download */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6"
        >
          <AnimatePresence>
            {trimError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-[#FF3B5C] text-sm mb-4 p-3 bg-[rgba(255,59,92,0.08)] rounded-lg border border-[rgba(255,59,92,0.2)]"
              >
                <AlertCircle size={14} />
                {trimError}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {trimSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 text-[#06D6A0] text-sm mb-4 p-3 bg-[rgba(6,214,160,0.08)] rounded-lg border border-[rgba(6,214,160,0.2)]"
              >
                <CheckCircle2 size={14} />
                Ringtone created! Ready to download.
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3">
            <motion.button
              onClick={handleTrim}
              disabled={trimming || trimDuration < 1}
              whileHover={!trimming ? { scale: 1.02 } : {}}
              whileTap={!trimming ? { scale: 0.98 } : {}}
              className="flex-1 py-3.5 rounded-xl font-display font-600 text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #FF3B5C, #FF8C42)',
                boxShadow: '0 6px 20px rgba(255,59,92,0.25)',
                color: '#fff',
              }}
            >
              {trimming ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Scissors size={16} />
                  Create Ringtone ({trimDuration.toFixed(1)}s)
                </>
              )}
            </motion.button>

            {downloadUrl && (
              <motion.a
                href={downloadUrl}
                download
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 py-3.5 rounded-xl font-display font-600 text-sm flex items-center justify-center gap-2 transition-all"
                style={{
                  background: 'rgba(6,214,160,0.1)',
                  border: '1px solid rgba(6,214,160,0.3)',
                  color: '#06D6A0',
                }}
              >
                <Download size={16} />
                Download .{downloadFormat}
              </motion.a>
            )}
          </div>

          <p className="text-xs font-mono text-[#3A3A5C] text-center mt-3">
            {downloadFormat === 'mp3' ? 'MP3 320kbps — Android compatible' : 'M4R High Quality — iPhone compatible'}
          </p>
        </motion.div>
      </div>
    </main>
  );
}

'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music2,
  Sparkles,
  ArrowRight,
  Youtube,
  Headphones,
  Zap,
  Scissors,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// Platform detection helpers
const PLATFORMS = [
  { name: 'YouTube', pattern: /youtube\.com|youtu\.be/, color: '#FF0000', icon: '▶' },
  { name: 'Spotify', pattern: /spotify\.com/, color: '#1DB954', icon: '♫' },
  { name: 'SoundCloud', pattern: /soundcloud\.com/, color: '#FF5500', icon: '☁' },
  { name: 'Apple Music', pattern: /music\.apple\.com/, color: '#FC3C44', icon: '♪' },
  { name: 'Instagram', pattern: /instagram\.com/, color: '#E1306C', icon: '◈' },
  { name: 'TikTok', pattern: /tiktok\.com/, color: '#69C9D0', icon: '♬' },
];

function detectPlatform(url: string) {
  return PLATFORMS.find((p) => p.pattern.test(url));
}

function isValidUrl(url: string) {
  try {
    new URL(url);
    return PLATFORMS.some((p) => p.pattern.test(url));
  } catch {
    return false;
  }
}

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const platform = detectPlatform(url);
  const valid = isValidUrl(url);

  const LOADING_STEPS = [
    'Detecting platform…',
    'Extracting audio…',
    'Converting to high quality MP3…',
    'Running AI chorus detection…',
    'Almost ready…',
  ];

  const handleConvert = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError('');

    // Simulate loading steps
    let step = 0;
    const stepInterval = setInterval(() => {
      step++;
      if (step < LOADING_STEPS.length) setLoadingStep(step);
    }, 1800);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract audio');
      }

      clearInterval(stepInterval);

      // Store data and navigate to editor
      sessionStorage.setItem(
        'ringify_data',
        JSON.stringify({
          audioUrl: data.audioUrl,
          chorusStart: data.chorusStart,
          chorusEnd: data.chorusEnd,
          title: data.title || 'Unknown Track',
          platform: data.platform || platform?.name,
          duration: data.duration,
        })
      );

      router.push('/editor');
    } catch (err: unknown) {
      clearInterval(stepInterval);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      setError('');
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-[#E8E8F0] overflow-hidden relative">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #FF3B5C, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-10%] right-[5%] w-[500px] h-[500px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #06D6A0, transparent 70%)' }}
        />
        <div
          className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #FF8C42, transparent 70%)' }}
        />

        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-24"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF8C42)' }}
            >
              <Music2 size={18} className="text-white" />
            </div>
            <span className="font-display text-xl font-700 tracking-tight">Ringify</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#7070A0]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#06D6A0] animate-pulse" />
            <span>v1.0 — PRODUCTION</span>
          </div>
        </motion.header>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#1E1E2E] bg-[#12121A] text-xs font-mono text-[#7070A0] mb-8">
            <Sparkles size={12} className="text-[#FFD166]" />
            AI-powered chorus detection
            <Sparkles size={12} className="text-[#FFD166]" />
          </div>

          <h1
            className="text-7xl md:text-8xl font-display font-800 tracking-tighter leading-none mb-6"
            style={{
              background: 'linear-gradient(135deg, #E8E8F0 0%, #7070A0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Turn any song
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #FF3B5C 0%, #FF8C42 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              into a ringtone.
            </span>
          </h1>

          <p className="text-[#7070A0] text-lg max-w-lg mx-auto leading-relaxed">
            Paste any link from YouTube, Spotify, SoundCloud, and more. AI finds the perfect moment.
            You customize it exactly how you want.
          </p>
        </motion.div>

        {/* Main Input Card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="max-w-2xl mx-auto mb-20"
        >
          <div
            className="relative rounded-2xl p-1"
            style={{
              background: 'linear-gradient(135deg, rgba(255,59,92,0.3), rgba(255,140,66,0.2), rgba(6,214,160,0.1))',
            }}
          >
            <div className="bg-[#0E0E18] rounded-[14px] p-6">
              {/* Platform indicator */}
              <AnimatePresence>
                {platform && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-2 mb-4"
                  >
                    <span
                      className="platform-badge"
                      style={{
                        background: `${platform.color}18`,
                        border: `1px solid ${platform.color}40`,
                        color: platform.color,
                      }}
                    >
                      <span>{platform.icon}</span>
                      {platform.name} detected
                    </span>
                    <CheckCircle2 size={14} style={{ color: platform.color }} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input */}
              <div className="flex gap-3 mb-4">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="url"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
                    placeholder="Paste song link here…"
                    className="w-full bg-[#12121A] border border-[#1E1E2E] rounded-xl px-4 py-3.5 text-[#E8E8F0] placeholder-[#3A3A5C] font-body text-sm outline-none transition-all focus:border-[#FF3B5C] focus:shadow-[0_0_0_3px_rgba(255,59,92,0.1)]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  />
                  {url && (
                    <button
                      onClick={() => { setUrl(''); setError(''); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3A3A5C] hover:text-[#7070A0] transition-colors text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>

                <button
                  onClick={handlePaste}
                  className="px-4 py-3.5 bg-[#1E1E2E] hover:bg-[#252535] text-[#7070A0] hover:text-[#E8E8F0] rounded-xl text-sm font-mono transition-all whitespace-nowrap"
                >
                  Paste
                </button>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-[#FF3B5C] text-sm mb-4 p-3 bg-[rgba(255,59,92,0.08)] rounded-lg border border-[rgba(255,59,92,0.2)]"
                  >
                    <AlertCircle size={14} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Convert Button */}
              <motion.button
                onClick={handleConvert}
                disabled={!valid || loading}
                whileHover={valid && !loading ? { scale: 1.02 } : {}}
                whileTap={valid && !loading ? { scale: 0.98 } : {}}
                className="w-full py-4 rounded-xl font-display font-600 text-base tracking-tight transition-all relative overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: valid && !loading
                    ? 'linear-gradient(135deg, #FF3B5C, #FF8C42)'
                    : '#1E1E2E',
                  color: valid && !loading ? '#fff' : '#7070A0',
                  boxShadow: valid && !loading ? '0 8px 30px rgba(255,59,92,0.3)' : 'none',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm">{LOADING_STEPS[loadingStep]}</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Convert to Ringtone
                    <ArrowRight size={18} />
                  </span>
                )}

                {/* Shimmer on hover */}
                {valid && !loading && (
                  <motion.div
                    className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity"
                    style={{
                      background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
                      backgroundSize: '200% 100%',
                    }}
                  />
                )}
              </motion.button>

              {/* Loading progress */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4"
                  >
                    <div className="h-1 bg-[#1E1E2E] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #FF3B5C, #FF8C42)' }}
                        initial={{ width: '5%' }}
                        animate={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <p className="text-[10px] font-mono text-[#3A3A5C] text-center mt-2">
                      Step {loadingStep + 1} of {LOADING_STEPS.length}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Supported Platforms */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="text-center mb-20"
        >
          <p className="text-xs font-mono text-[#3A3A5C] uppercase tracking-widest mb-5">
            Supported Platforms
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {PLATFORMS.map((p) => (
              <span
                key={p.name}
                className="platform-badge"
                style={{
                  background: `${p.color}12`,
                  border: `1px solid ${p.color}30`,
                  color: p.color,
                }}
              >
                <span>{p.icon}</span>
                {p.name}
              </span>
            ))}
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16"
        >
          {[
            {
              icon: <Zap size={20} />,
              color: '#FFD166',
              step: '01',
              title: 'AI Detects the Best Part',
              desc: 'Our algorithm analyzes energy, beat structure, and repetition to find the chorus automatically.',
            },
            {
              icon: <Scissors size={20} />,
              color: '#FF3B5C',
              step: '02',
              title: 'You Edit to Perfection',
              desc: 'Drag waveform markers to select any section. Full manual control over start, end, and duration.',
            },
            {
              icon: <Download size={20} />,
              color: '#06D6A0',
              step: '03',
              title: 'Download in Any Format',
              desc: 'Export as MP3 320kbps for Android or M4R high quality for iPhone. Ready to set.',
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
              className="bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6 hover:border-[#2E2E4E] transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${item.color}18`, color: item.color }}
                >
                  {item.icon}
                </div>
                <span
                  className="font-mono text-xs"
                  style={{ color: `${item.color}60` }}
                >
                  {item.step}
                </span>
              </div>
              <h3 className="font-display font-600 text-base mb-2">{item.title}</h3>
              <p className="text-[#7070A0] text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs font-mono text-[#3A3A5C]"
        >
          <p>Ringify — High quality ringtones from any platform</p>
          <p className="mt-1">Powered by yt-dlp · FFmpeg · WaveSurfer.js</p>
        </motion.footer>
      </div>
    </main>
  );
}

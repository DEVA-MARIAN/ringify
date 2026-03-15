'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Download,
  Music2,
  ArrowLeft,
  Smartphone,
  CheckCircle2,
  Clock,
  RotateCcw,
} from 'lucide-react';

interface RingtoneData {
  ringtoneUrl: string;
  title: string;
  duration: number;
  format: 'mp3' | 'm4r';
}

function formatTime(secs: number): string {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DownloadPage() {
  const router = useRouter();
  const [data, setData] = useState<RingtoneData | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('ringify_ringtone');
    if (!raw) {
      router.push('/');
      return;
    }
    try {
      setData(JSON.parse(raw));
    } catch {
      router.push('/');
    }
  }, [router]);

  if (!data) return null;

  const isIphone = data.format === 'm4r';

  const instructions = isIphone
    ? [
        'Connect your iPhone to Mac via USB or Finder',
        'Open Finder → iPhone → Music section',
        'Drag the downloaded .m4r file into Finder',
        'On iPhone: Settings → Sounds → Ringtone → select your tone',
      ]
    : [
        'Transfer the .mp3 to your Android phone',
        'Open Settings → Sound → Phone Ringtone',
        'Browse to the downloaded file and select it',
        'Tap OK to set as your default ringtone',
      ];

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-[#E8E8F0] flex flex-col items-center justify-center px-6 py-16">
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-[0.05] rounded-full"
          style={{ background: 'radial-gradient(circle, #06D6A0, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 max-w-lg w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-12"
        >
          <button
            onClick={() => router.push('/editor')}
            className="flex items-center gap-2 text-[#7070A0] hover:text-[#E8E8F0] transition-colors text-sm font-mono"
          >
            <ArrowLeft size={15} />
            Back to Editor
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF8C42)' }}
            >
              <Music2 size={13} className="text-white" />
            </div>
            <span className="font-display text-base font-700">Ringify</span>
          </div>
        </motion.div>

        {/* Success badge */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="flex justify-center mb-8"
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: 'rgba(6, 214, 160, 0.08)',
              border: '1px solid rgba(6, 214, 160, 0.2)',
              boxShadow: '0 0 40px rgba(6, 214, 160, 0.12)',
            }}
          >
            <CheckCircle2 size={36} className="text-[#06D6A0]" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-10"
        >
          <h1 className="font-display text-3xl font-700 tracking-tight mb-2">
            Ringtone Ready!
          </h1>
          <p className="text-[#7070A0] text-sm">{data.title}</p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs font-mono text-[#3A3A5C]">
              <Clock size={11} />
              {data.duration.toFixed(1)}s
            </span>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-full uppercase"
              style={{
                background: isIphone ? 'rgba(252,60,68,0.1)' : 'rgba(6,214,160,0.1)',
                border: `1px solid ${isIphone ? 'rgba(252,60,68,0.2)' : 'rgba(6,214,160,0.2)'}`,
                color: isIphone ? '#FC3C44' : '#06D6A0',
              }}
            >
              .{data.format} · {isIphone ? 'iPhone' : 'Android'}
            </span>
          </div>
        </motion.div>

        {/* Download button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <motion.a
            href={data.ringtoneUrl}
            download
            onClick={() => setDownloaded(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-xl font-display font-600 text-base text-white"
            style={{
              background: 'linear-gradient(135deg, #06D6A0, #0AB57F)',
              boxShadow: '0 8px 30px rgba(6,214,160,0.3)',
            }}
          >
            <Download size={20} />
            Download .{data.format}
          </motion.a>

          {downloaded && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-xs font-mono text-[#06D6A0] mt-3"
            >
              ✓ Download started
            </motion.p>
          )}
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-6 mb-6"
        >
          <h3 className="font-display font-600 text-sm flex items-center gap-2 mb-4">
            <Smartphone size={14} className="text-[#FF8C42]" />
            How to set as ringtone · {isIphone ? 'iPhone' : 'Android'}
          </h3>
          <ol className="space-y-2">
            {instructions.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[#7070A0]">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono flex-shrink-0 mt-0.5"
                  style={{
                    background: 'rgba(255,140,66,0.1)',
                    border: '1px solid rgba(255,140,66,0.2)',
                    color: '#FF8C42',
                  }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </motion.div>

        {/* Start over */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <button
            onClick={() => {
              sessionStorage.clear();
              router.push('/');
            }}
            className="flex items-center gap-2 mx-auto text-[#3A3A5C] hover:text-[#7070A0] transition-colors text-sm font-mono"
          >
            <RotateCcw size={13} />
            Convert another song
          </button>
        </motion.div>
      </div>
    </main>
  );
}

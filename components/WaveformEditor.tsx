'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Play, Pause, SkipBack } from 'lucide-react';

interface WaveformEditorProps {
  audioUrl: string;
  chorusStart: number;
  chorusEnd: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  onRegionChange: (start: number, end: number) => void;
  onDurationReady: (duration: number) => void;
  onTimeUpdate: (time: number) => void;
  onPlayToggle: (playing: boolean) => void;
}

export default function WaveformEditor({
  audioUrl,
  chorusStart,
  chorusEnd,
  trimStart,
  trimEnd,
  volume,
  onRegionChange,
  onDurationReady,
  onTimeUpdate,
  onPlayToggle,
}: WaveformEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const regionsRef = useRef<any>(null);
  const trimRegionRef = useRef<any>(null);
  const chorusRegionRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const isDragging = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let ws: any = null;

    const init = async () => {
      try {
        const WaveSurfer = (await import('wavesurfer.js')).default;
        const RegionsPlugin = (await import('wavesurfer.js/dist/plugins/regions.js')).default;

        const regions = RegionsPlugin.create();
        regionsRef.current = regions;

        ws = WaveSurfer.create({
          container: containerRef.current!,
          waveColor: '#2E2E4E',
          progressColor: '#FF3B5C',
          cursorColor: '#FF3B5C',
          cursorWidth: 2,
          height: 120,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          normalize: true,
          interact: true,
          fillParent: true,
          plugins: [regions],
        });

        wavesurferRef.current = ws;

        ws.on('ready', () => {
          const dur = ws.getDuration();
          setIsReady(true);
          setIsLoading(false);
          onDurationReady(dur);

          // Add chorus highlight region (non-draggable, just visual)
          if (chorusStart >= 0 && chorusEnd > chorusStart && chorusEnd <= dur) {
            const chorusRegion = regions.addRegion({
              start: chorusStart,
              end: chorusEnd,
              color: 'rgba(255, 59, 92, 0.12)',
              drag: false,
              resize: false,
              id: 'chorus',
            });
            chorusRegionRef.current = chorusRegion;

            // Style the chorus region
            if (chorusRegion.element) {
              chorusRegion.element.style.borderLeft = '2px solid rgba(255, 59, 92, 0.6)';
              chorusRegion.element.style.borderRight = '2px solid rgba(255, 59, 92, 0.6)';
            }
          }

          // Add trim region (user-draggable)
          const initStart = trimStart >= 0 ? Math.min(trimStart, dur) : chorusStart >= 0 ? Math.min(chorusStart, dur) : 0;
          const initEnd = trimEnd > initStart ? Math.min(trimEnd, dur) : Math.min(initStart + 30, dur);

          const trimReg = regions.addRegion({
            start: initStart,
            end: initEnd,
            color: 'rgba(6, 214, 160, 0.1)',
            drag: true,
            resize: true,
            id: 'trim',
          });
          trimRegionRef.current = trimReg;

          // Style the trim region
          if (trimReg.element) {
            trimReg.element.style.borderLeft = '3px solid rgba(6, 214, 160, 0.8)';
            trimReg.element.style.borderRight = '3px solid rgba(6, 214, 160, 0.8)';
            trimReg.element.style.borderTop = 'none';
            trimReg.element.style.borderBottom = 'none';
          }

          onRegionChange(initStart, initEnd);
        });

        ws.on('audioprocess', (t: number) => {
          onTimeUpdate(t);
        });

        ws.on('seeking', (t: number) => {
          onTimeUpdate(t);
        });

        ws.on('play', () => {
          setIsPlaying(true);
          onPlayToggle(true);
        });

        ws.on('pause', () => {
          setIsPlaying(false);
          onPlayToggle(false);
        });

        ws.on('finish', () => {
          setIsPlaying(false);
          onPlayToggle(false);
        });

        ws.on('error', (err: Error) => {
          setLoadError('Failed to load audio: ' + err.message);
          setIsLoading(false);
        });

        // Region updated
        regions.on('region-updated', (region: any) => {
          if (region.id === 'trim') {
            onRegionChange(region.start, region.end);
          }
        });

        ws.load(audioUrl);
      } catch (err: any) {
        setLoadError('Failed to initialize waveform: ' + (err.message || 'Unknown error'));
        setIsLoading(false);
      }
    };

    init();

    return () => {
      if (ws) {
        ws.destroy();
        wavesurferRef.current = null;
        regionsRef.current = null;
        trimRegionRef.current = null;
        chorusRegionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  // Sync volume
  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.setVolume(volume);
    }
  }, [volume, isReady]);

  // Sync trim region from external changes (sliders, number inputs)
  useEffect(() => {
    if (!isReady || !trimRegionRef.current || isDragging.current) return;
    const region = trimRegionRef.current;
    if (Math.abs(region.start - trimStart) > 0.1 || Math.abs(region.end - trimEnd) > 0.1) {
      try {
        region.setOptions({ start: trimStart, end: trimEnd });
      } catch {
        // Ignore if not supported
      }
    }
  }, [trimStart, trimEnd, isReady]);

  const handlePlayPause = () => {
    if (!wavesurferRef.current || !isReady) return;
    if (isPlaying) {
      wavesurferRef.current.pause();
    } else {
      // Play from trim start if current position is outside region
      const current = wavesurferRef.current.getCurrentTime();
      if (current < trimStart || current >= trimEnd) {
        wavesurferRef.current.setTime(trimStart);
      }
      wavesurferRef.current.play();
    }
  };

  const handleRestart = () => {
    if (!wavesurferRef.current || !isReady) return;
    wavesurferRef.current.setTime(trimStart);
    if (!isPlaying) {
      wavesurferRef.current.play();
    }
  };

  return (
    <div className="space-y-4">
      {/* Waveform */}
      <div className="relative">
        <div
          className="waveform-container"
          style={{ minHeight: 140, padding: '10px 0' }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0E0E18] rounded-xl z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-1">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full animate-pulse"
                      style={{
                        height: `${20 + Math.sin(i * 0.8) * 15}px`,
                        background: 'linear-gradient(to top, #FF3B5C, #FF8C42)',
                        animationDelay: `${i * 0.1}s`,
                        opacity: 0.4 + (i % 3) * 0.2,
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs font-mono text-[#3A3A5C]">Loading waveform…</p>
              </div>
            </div>
          )}

          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0E0E18] rounded-xl z-10">
              <p className="text-xs font-mono text-[#FF3B5C] text-center px-4">{loadError}</p>
            </div>
          )}

          <div ref={containerRef} className="px-2" />
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleRestart}
          disabled={!isReady}
          className="w-9 h-9 rounded-lg bg-[#1E1E2E] hover:bg-[#252535] flex items-center justify-center text-[#7070A0] hover:text-[#E8E8F0] transition-all disabled:opacity-40"
          title="Restart from selection start"
        >
          <SkipBack size={15} />
        </button>

        <button
          onClick={handlePlayPause}
          disabled={!isReady}
          className="w-12 h-12 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, #FF3B5C, #FF8C42)',
            boxShadow: isReady ? '0 4px 15px rgba(255,59,92,0.35)' : 'none',
          }}
        >
          {isPlaying ? (
            <Pause size={18} className="text-white" />
          ) : (
            <Play size={18} className="text-white ml-0.5" />
          )}
        </button>

        <div className="w-9 h-9" /> {/* Spacer */}
      </div>
    </div>
  );
}

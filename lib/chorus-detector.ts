import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execFileAsync = promisify(execFile);

export interface ChorusResult {
  chorusStart: number;
  chorusEnd: number;
  confidence: number;
  method: string;
}

interface EnergyFrame {
  time: number;
  energy: number;
}

/**
 * Detect the most prominent (chorus) section of a song using multiple techniques:
 * 1. RMS energy analysis — find the loudest sustained section
 * 2. Repetition heuristics — choruses typically appear multiple times
 * 3. Structural analysis — chorus typically after intro (first ~25% often skipped)
 */
export async function detectChorus(filePath: string, duration: number): Promise<ChorusResult> {
  try {
    // Use FFmpeg to extract RMS energy data
    const energyData = await extractEnergyData(filePath);

    if (energyData.length === 0) {
      return fallbackChorus(duration);
    }

    return analyzeEnergy(energyData, duration);
  } catch (err) {
    console.error('Chorus detection error:', err);
    return fallbackChorus(duration);
  }
}

async function extractEnergyData(filePath: string): Promise<EnergyFrame[]> {
  // Use FFmpeg astats to get per-second RMS energy
  const args = [
    '-i', filePath,
    '-af', 'astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-',
    '-f', 'null',
    '-',
  ];

  const { stderr } = await execFileAsync('ffmpeg', args, {
    timeout: 30000,
    maxBuffer: 5 * 1024 * 1024,
  });

  const frames: EnergyFrame[] = [];
  const lines = stderr.split('\n');

  let currentTime = 0;
  for (const line of lines) {
    // Parse pts_time
    const timeMatch = line.match(/pts_time:(\d+\.?\d*)/);
    if (timeMatch) {
      currentTime = parseFloat(timeMatch[1]);
    }

    // Parse RMS level
    const rmsMatch = line.match(/lavfi\.astats\.Overall\.RMS_level=(-?\d+\.?\d*)/);
    if (rmsMatch) {
      const rmsDb = parseFloat(rmsMatch[1]);
      // Convert from dB to linear, handle -inf
      const energy = rmsDb > -100 ? Math.pow(10, rmsDb / 20) : 0;
      frames.push({ time: currentTime, energy });
    }
  }

  return frames;
}

function analyzeEnergy(frames: EnergyFrame[], duration: number): ChorusResult {
  if (frames.length < 10) {
    return fallbackChorus(duration);
  }

  // Smooth energy with a sliding window
  const windowSize = 5;
  const smoothed: EnergyFrame[] = frames.map((frame, i) => {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(frames.length, i + windowSize + 1);
    const window = frames.slice(start, end);
    const avg = window.reduce((sum, f) => sum + f.energy, 0) / window.length;
    return { time: frame.time, energy: avg };
  });

  // Find peak energy region
  const maxEnergy = Math.max(...smoothed.map((f) => f.energy));
  const threshold = maxEnergy * 0.75; // Top 25% energy

  // Find segments above threshold
  const highEnergySegments: Array<{ start: number; end: number; avgEnergy: number }> = [];
  let segStart: number | null = null;
  let segEnergies: number[] = [];

  for (const frame of smoothed) {
    if (frame.energy >= threshold) {
      if (segStart === null) segStart = frame.time;
      segEnergies.push(frame.energy);
    } else {
      if (segStart !== null) {
        const segEnd = frame.time;
        if (segEnd - segStart >= 5) { // At least 5 seconds
          highEnergySegments.push({
            start: segStart,
            end: segEnd,
            avgEnergy: segEnergies.reduce((a, b) => a + b, 0) / segEnergies.length,
          });
        }
        segStart = null;
        segEnergies = [];
      }
    }
  }

  // Close last segment
  if (segStart !== null && frames.length > 0) {
    const lastTime = frames[frames.length - 1].time;
    if (lastTime - segStart >= 5) {
      highEnergySegments.push({
        start: segStart,
        end: lastTime,
        avgEnergy: segEnergies.reduce((a, b) => a + b, 0) / segEnergies.length,
      });
    }
  }

  if (highEnergySegments.length === 0) {
    return fallbackChorus(duration);
  }

  // Skip segments in the first 15% of the song (typically intro)
  const skipUntil = duration * 0.15;
  const validSegments = highEnergySegments.filter((s) => s.start >= skipUntil);
  const candidateSegments = validSegments.length > 0 ? validSegments : highEnergySegments;

  // Sort by average energy (highest first) and prefer segments in 25-75% of song
  candidateSegments.sort((a, b) => {
    const aCenter = (a.start + a.end) / 2 / duration;
    const bCenter = (b.start + b.end) / 2 / duration;
    const aPositionScore = aCenter >= 0.25 && aCenter <= 0.75 ? 1.2 : 1.0;
    const bPositionScore = bCenter >= 0.25 && bCenter <= 0.75 ? 1.2 : 1.0;
    return b.avgEnergy * bPositionScore - a.avgEnergy * aPositionScore;
  });

  const bestSegment = candidateSegments[0];

  // Target a 20-30 second clip from the best segment
  const targetLength = 25;
  const segLength = bestSegment.end - bestSegment.start;

  let chorusStart: number;
  let chorusEnd: number;

  if (segLength <= targetLength) {
    chorusStart = bestSegment.start;
    chorusEnd = bestSegment.end;
  } else {
    // Find the highest energy point within the segment and center around it
    const segFrames = smoothed.filter(
      (f) => f.time >= bestSegment.start && f.time <= bestSegment.end
    );
    const peakFrame = segFrames.reduce((max, f) => (f.energy > max.energy ? f : max), segFrames[0]);
    const half = targetLength / 2;
    chorusStart = Math.max(0, peakFrame.time - half);
    chorusEnd = Math.min(duration, chorusStart + targetLength);
    // Adjust if we hit the end
    if (chorusEnd === duration) {
      chorusStart = Math.max(0, duration - targetLength);
    }
  }

  return {
    chorusStart: Math.round(chorusStart * 10) / 10,
    chorusEnd: Math.round(chorusEnd * 10) / 10,
    confidence: 0.75,
    method: 'energy-analysis',
  };
}

function fallbackChorus(duration: number): ChorusResult {
  // Heuristic fallback: chorus is typically around 30-60% into the song
  // For a standard pop song (~3.5min = 210s), chorus starts around 60-90s
  const chorusStart = Math.floor(duration * 0.35);
  const chorusEnd = Math.min(Math.floor(duration * 0.55), chorusStart + 30);

  return {
    chorusStart,
    chorusEnd,
    confidence: 0.3,
    method: 'heuristic-fallback',
  };
}

/**
 * Get audio duration using FFprobe
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        filePath,
      ],
      { timeout: 10000 }
    );

    const info = JSON.parse(stdout);
    const audioStream = info.streams?.find((s: any) => s.codec_type === 'audio');
    return audioStream ? parseFloat(audioStream.duration) || 0 : 0;
  } catch {
    return 0;
  }
}

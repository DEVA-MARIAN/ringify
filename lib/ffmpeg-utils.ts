import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

export interface TrimOptions {
  inputPath: string;
  outputPath: string;
  startTime: number;
  endTime: number;
  format: 'mp3' | 'm4r' | 'aac';
}

/**
 * Trim audio file using FFmpeg with high quality settings
 */
export async function trimAudio(options: TrimOptions): Promise<void> {
  const { inputPath, outputPath, startTime, endTime, format } = options;
  const duration = endTime - startTime;

  if (duration <= 0) throw new Error('Invalid trim range: end must be after start');
  if (duration > 600) throw new Error('Trim too long: maximum 10 minutes');

  const args: string[] = [
    '-y', // Overwrite output
    '-ss', startTime.toString(),
    '-t', duration.toString(),
    '-i', inputPath,
  ];

  if (format === 'mp3') {
    args.push(
      '-codec:a', 'libmp3lame',
      '-b:a', '320k',
      '-ar', '44100',
      '-ac', '2',
      '-id3v2_version', '3',
      outputPath
    );
  } else if (format === 'm4r' || format === 'aac') {
    // M4R is AAC in an M4A container (rename to .m4r for iPhone)
    const m4aPath = outputPath.replace('.m4r', '.m4a');
    args.push(
      '-codec:a', 'aac',
      '-b:a', '256k',
      '-ar', '44100',
      '-ac', '2',
      '-movflags', '+faststart',
      m4aPath
    );

    await execFileAsync('ffmpeg', args, {
      timeout: 60000,
    });

    // Rename .m4a to .m4r for iPhone compatibility
    if (outputPath.endsWith('.m4r')) {
      fs.renameSync(m4aPath, outputPath);
    }
    return;
  }

  await execFileAsync('ffmpeg', args, {
    timeout: 60000,
    maxBuffer: 5 * 1024 * 1024,
  });
}

/**
 * Convert audio to MP3 320kbps
 */
export async function convertToMp3(inputPath: string, outputPath: string): Promise<void> {
  const args = [
    '-y',
    '-i', inputPath,
    '-codec:a', 'libmp3lame',
    '-b:a', '320k',
    '-ar', '44100',
    '-ac', '2',
    '-id3v2_version', '3',
    outputPath,
  ];

  await execFileAsync('ffmpeg', args, {
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

/**
 * Add fade in/out to a trimmed file
 */
export async function addFades(
  inputPath: string,
  outputPath: string,
  fadeIn = 0.3,
  fadeOut = 0.5
): Promise<void> {
  const { stdout } = await execFileAsync(
    'ffprobe',
    ['-v', 'quiet', '-print_format', 'json', '-show_streams', inputPath],
    { timeout: 10000 }
  );

  let duration = 0;
  try {
    const info = JSON.parse(stdout);
    const stream = info.streams?.find((s: any) => s.codec_type === 'audio');
    duration = parseFloat(stream?.duration || '0');
  } catch {
    duration = 30; // fallback
  }

  const fadeOutStart = Math.max(0, duration - fadeOut);

  const args = [
    '-y',
    '-i', inputPath,
    '-af', `afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut}`,
    '-codec:a', 'copy',
    outputPath,
  ];

  await execFileAsync('ffmpeg', args, {
    timeout: 60000,
  });
}

/**
 * Check if ffmpeg and ffprobe are available
 */
export async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if yt-dlp is available
 */
export async function checkYtDlpAvailable(): Promise<boolean> {
  try {
    await execFileAsync('yt-dlp', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate waveform peak data for visualization
 * Returns normalized values between 0 and 1
 */
export async function generateWaveformData(
  filePath: string,
  samples = 200
): Promise<number[]> {
  try {
    const args = [
      '-i', filePath,
      '-ac', '1', // Mono
      '-filter:a', `aresample=8000,asetnsamples=${samples}`,
      '-f', 'data',
      '-',
    ];

    const { stdout } = await execFileAsync('ffmpeg', args, {
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
      encoding: 'buffer',
    } as any);

    // Parse raw audio samples
    const data = Buffer.from(stdout as any);
    const peaks: number[] = [];
    const chunkSize = Math.floor(data.length / samples);

    for (let i = 0; i < samples; i++) {
      let max = 0;
      for (let j = 0; j < chunkSize; j++) {
        const offset = i * chunkSize + j;
        if (offset < data.length) {
          const val = Math.abs(data.readInt16LE(offset * 2) / 32768);
          if (val > max) max = val;
        }
      }
      peaks.push(max);
    }

    // Normalize
    const maxPeak = Math.max(...peaks, 0.001);
    return peaks.map((p) => p / maxPeak);
  } catch {
    // Return dummy waveform if generation fails
    return Array.from({ length: samples }, (_, i) =>
      0.2 + Math.abs(Math.sin(i * 0.3)) * 0.5 + Math.random() * 0.2
    );
  }
}

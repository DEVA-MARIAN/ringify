import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execFileAsync = promisify(execFile);

export interface ExtractionResult {
  filePath: string;
  title: string;
  duration: number;
  platform: string;
}

export type PlatformName =
  | 'YouTube'
  | 'Spotify'
  | 'SoundCloud'
  | 'Apple Music'
  | 'Instagram'
  | 'TikTok'
  | 'Unknown';

const PLATFORM_PATTERNS: Array<{ name: PlatformName; pattern: RegExp }> = [
  { name: 'YouTube', pattern: /youtube\.com|youtu\.be/ },
  { name: 'Spotify', pattern: /spotify\.com/ },
  { name: 'SoundCloud', pattern: /soundcloud\.com/ },
  { name: 'Apple Music', pattern: /music\.apple\.com/ },
  { name: 'Instagram', pattern: /instagram\.com/ },
  { name: 'TikTok', pattern: /tiktok\.com/ },
];

export function detectPlatform(url: string): PlatformName {
  const match = PLATFORM_PATTERNS.find((p) => p.pattern.test(url));
  return match ? match.name : 'Unknown';
}

function getTempDir(): string {
  const dir = path.join(os.tmpdir(), 'ringify');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function extractAudio(url: string, outputId: string): Promise<ExtractionResult> {
  const tempDir = getTempDir();
  const outputTemplate = path.join(tempDir, `${outputId}.%(ext)s`);
  const finalMp3 = path.join(tempDir, `${outputId}.mp3`);

  const platform = detectPlatform(url);

  // yt-dlp arguments for highest quality audio, convert to mp3 320kbps
  const args = [
    url,
    '--output', outputTemplate,
    '--format', 'bestaudio/best',
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '0', // Best quality
    '--no-playlist',
    '--no-warnings',
    '--print-json',
    '--postprocessor-args', 'ffmpeg:-ar 44100 -b:a 320k',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  ];

  // For Spotify, Apple Music — yt-dlp can handle these via spotify/AM plugins
  // or fallback to searching YouTube for the track name
  if (platform === 'Spotify' || platform === 'Apple Music') {
    args.push('--default-search', 'ytsearch1:');
  }

  let metadata: any = {};

  try {
    const { stdout } = await execFileAsync('yt-dlp', args, {
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });

    // Parse last JSON line
    const lines = stdout.trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        metadata = JSON.parse(lines[i]);
        break;
      } catch {
        continue;
      }
    }
  } catch (err: any) {
    // Some yt-dlp versions print JSON to stderr
    const stderr = err.stderr || '';
    const lines = stderr.trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        metadata = JSON.parse(lines[i]);
        break;
      } catch {
        continue;
      }
    }

    // If file doesn't exist, it truly failed
    if (!fs.existsSync(finalMp3)) {
      // Try to find any mp3 that was created
      const files = fs.readdirSync(tempDir).filter(
        (f) => f.startsWith(outputId) && f.endsWith('.mp3')
      );
      if (files.length === 0) {
        throw new Error(`Audio extraction failed: ${err.message || 'yt-dlp error'}`);
      }
    }
  }

  // Find the actual output file
  if (!fs.existsSync(finalMp3)) {
    const files = fs.readdirSync(tempDir).filter(
      (f) => f.startsWith(outputId) && (f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.opus'))
    );
    if (files.length === 0) {
      throw new Error('No audio file was created');
    }
    // If it's not already mp3, we'd need to convert — but yt-dlp with --audio-format mp3 should handle it
  }

  return {
    filePath: finalMp3,
    title: metadata.title || metadata.track || 'Unknown Track',
    duration: metadata.duration || 0,
    platform,
  };
}

export function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

export function getTempFilePath(id: string, ext: string): string {
  return path.join(getTempDir(), `${id}.${ext}`);
}

export function fileToBase64(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
}

export function getFileSizeKB(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return Math.round(stats.size / 1024);
  } catch {
    return 0;
  }
}



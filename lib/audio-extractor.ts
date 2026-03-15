import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execFileAsync = promisify(execFile);

export type PlatformName = 'YouTube' | 'Spotify' | 'SoundCloud' | 'Apple Music' | 'Instagram' | 'TikTok' | 'Unknown';

export interface ExtractionResult {
  filePath: string;
  title: string;
  duration: number;
  platform: string;
}

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
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getFfmpegPath(): string {
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) return ffmpegStatic;
  } catch {}
  return 'ffmpeg';
}

export async function extractAudio(url: string, outputId: string): Promise<ExtractionResult> {
  const tempDir = getTempDir();
  const outputTemplate = path.join(tempDir, `${outputId}.%(ext)s`);
  const finalMp3 = path.join(tempDir, `${outputId}.mp3`);
  const platform = detectPlatform(url);
  const ffmpegPath = getFfmpegPath();

  // Use youtube-dl-exec which bundles yt-dlp as an npm package
  const youtubeDl = require('youtube-dl-exec');

  const options: Record<string, any> = {
    output: outputTemplate,
    format: 'bestaudio/best',
    extractAudio: true,
    audioFormat: 'mp3',
    audioQuality: 0,
    noPlaylist: true,
    noWarnings: true,
    printJson: true,
    ffmpegLocation: ffmpegPath,
    postprocessorArgs: 'ffmpeg:-ar 44100 -b:a 320k',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  let metadata: any = {};

  try {
    const result = await youtubeDl(url, options);
    if (typeof result === 'object') metadata = result;
  } catch (err: any) {
    // Check if file was created despite error
    if (!fs.existsSync(finalMp3)) {
      const files = fs.readdirSync(tempDir).filter(
        (f) => f.startsWith(outputId) && f.endsWith('.mp3')
      );
      if (files.length === 0) {
        throw new Error(`Audio extraction failed: ${err.message || 'unknown error'}`);
      }
    }
  }

  return {
    filePath: finalMp3,
    title: metadata.title || metadata.track || 'Unknown Track',
    duration: metadata.duration || 0,
    platform,
  };
}

export function cleanupFile(filePath: string): void {
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
}

export function getTempFilePath(id: string, ext: string): string {
  return path.join(getTempDir(), `${id}.${ext}`);
}

export function fileToBase64(filePath: string): string {
  return fs.readFileSync(filePath).toString('base64');
}

export function getFileSizeKB(filePath: string): number {
  try { return Math.round(fs.statSync(filePath).size / 1024); } catch { return 0; }
}

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execFileAsync = promisify(execFile);

export type PlatformName = 'YouTube' | 'Spotify' | 'SoundCloud' | 'Apple Music' | 'Instagram' | 'TikTok' | 'Unknown';
export interface ExtractionResult { filePath: string; title: string; duration: number; platform: string; }

const PLATFORM_PATTERNS = [
  { name: 'YouTube' as PlatformName, pattern: /youtube\.com|youtu\.be/ },
  { name: 'Spotify' as PlatformName, pattern: /spotify\.com/ },
  { name: 'SoundCloud' as PlatformName, pattern: /soundcloud\.com/ },
  { name: 'Apple Music' as PlatformName, pattern: /music\.apple\.com/ },
  { name: 'Instagram' as PlatformName, pattern: /instagram\.com/ },
  { name: 'TikTok' as PlatformName, pattern: /tiktok\.com/ },
];

export function detectPlatform(url: string): PlatformName {
  return PLATFORM_PATTERNS.find((p) => p.pattern.test(url))?.name ?? 'Unknown';
}

function getTempDir(): string {
  const dir = path.join(os.tmpdir(), 'ringify');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getFfmpegPath(): string {
  try { const s = require('ffmpeg-static'); if (s && fs.existsSync(s)) return s; } catch {}
  return 'ffmpeg';
}

export async function extractAudio(url: string, outputId: string): Promise<ExtractionResult> {
  const tempDir = getTempDir();
  const outputTemplate = path.join(tempDir, `${outputId}.%(ext)s`);
  const finalMp3 = path.join(tempDir, `${outputId}.mp3`);
  const platform = detectPlatform(url);
  const ffmpegPath = getFfmpegPath();

  const args = [
    url,
    '--output', outputTemplate,
    '--format', 'bestaudio/best',
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--no-playlist',
    '--no-warnings',
    '--print-json',
    '--ffmpeg-location', ffmpegPath,
    '--postprocessor-args', 'ffmpeg:-ar 44100 -b:a 320k',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    '--cookies', '/app/cookies.txt',
  ];

  let metadata: any = {};
  try {
    const { stdout } = await execFileAsync('yt-dlp', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
    const lines = stdout.trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) { try { metadata = JSON.parse(lines[i]); break; } catch {} }
  } catch (err: any) {
    if (!fs.existsSync(finalMp3)) {
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith(outputId) && f.endsWith('.mp3'));
      if (!files.length) throw new Error(`Extraction failed: ${err.message}`);
    }
  }

  return { filePath: finalMp3, title: metadata.title || 'Unknown Track', duration: metadata.duration || 0, platform };
}

export function cleanupFile(filePath: string): void { try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {} }
export function getTempFilePath(id: string, ext: string): string { return path.join(getTempDir(), `${id}.${ext}`); }
export function fileToBase64(filePath: string): string { return fs.readFileSync(filePath).toString('base64'); }
export function getFileSizeKB(filePath: string): number { try { return Math.round(fs.statSync(filePath).size / 1024); } catch { return 0; } }


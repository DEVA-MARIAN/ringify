import path from 'path';
import fs from 'fs';
import os from 'os';

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
  const platform = detectPlatform(url);
  const outputPath = path.join(tempDir, `${outputId}.mp3`);
  const ffmpegPath = getFfmpegPath();

  if (platform === 'YouTube') {
    return extractYouTube(url, outputId, outputPath, ffmpegPath);
  }

  throw new Error('Only YouTube is supported on the hosted version. For other platforms, run locally.');
}

async function extractYouTube(url: string, outputId: string, outputPath: string, ffmpegPath: string): Promise<ExtractionResult> {
  const ytdl = require('@distube/ytdl-core');
  const ffmpeg = require('fluent-ffmpeg');
  ffmpeg.setFfmpegPath(ffmpegPath);

  const agent = ytdl.createProxyAgent({ uri: 'https://www.youtube.com' });

  const info = await ytdl.getInfo(url, {
    agent,
    requestOptions: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    },
  });

  const title = info.videoDetails.title || 'Unknown Track';
  const duration = parseInt(info.videoDetails.lengthSeconds) || 0;

  const audioFormat = ytdl.chooseFormat(info.formats, {
    quality: 'highestaudio',
    filter: 'audioonly',
  });

  await new Promise<void>((resolve, reject) => {
    const audioStream = ytdl.downloadFromInfo(info, { format: audioFormat });
    ffmpeg(audioStream)
      .audioBitrate(320)
      .audioFrequency(44100)
      .audioChannels(2)
      .format('mp3')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });

  return { filePath: outputPath, title, duration, platform: 'YouTube' };
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

import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

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

async function runYtDlp(url: string, outputId: string, platform: string, extraArgs: string[] = []): Promise<ExtractionResult> {
  const tempDir = getTempDir();
  const outputTemplate = path.join(tempDir, `${outputId}.%(ext)s`);
  const finalMp3 = path.join(tempDir, `${outputId}.mp3`);
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
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ...extraArgs,
  ];

  console.log(`[yt-dlp] Running for ${platform}: ${url.substring(0, 60)}`);

  let metadata: any = {};
  try {
    const { stdout } = await execFileAsync('yt-dlp', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
    const lines = stdout.trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) { try { metadata = JSON.parse(lines[i]); break; } catch {} }
  } catch (err: any) {
    console.log(`[yt-dlp] Error: ${err.message}`);
    if (!fs.existsSync(finalMp3)) {
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith(outputId) && f.endsWith('.mp3'));
      if (!files.length) throw new Error(err.stderr || err.message || 'Extraction failed');
    }
  }

  if (!fs.existsSync(finalMp3)) throw new Error('Audio file was not created');

  return {
    filePath: finalMp3,
    title: metadata.title || metadata.track || 'Unknown Track',
    duration: metadata.duration || 0,
    platform,
  };
}

export async function extractAudio(url: string, outputId: string): Promise<ExtractionResult> {
  const platform = detectPlatform(url);
  console.log(`[extract] Platform: ${platform}`);

  switch (platform) {
    case 'YouTube': {
      // Try multiple player clients to bypass bot detection
      const ytClients = [
        ['--extractor-args', 'youtube:player_client=web_creator'],
        ['--extractor-args', 'youtube:player_client=android'],
        ['--extractor-args', 'youtube:player_client=ios'],
        ['--extractor-args', 'youtube:player_client=web_embedded'],
        [], // fallback: no extra args
      ];
      let lastErr = '';
      for (const clientArgs of ytClients) {
        try {
          console.log(`[youtube] Trying client args: ${clientArgs.join(' ') || 'default'}`);
          return await runYtDlp(url, outputId, 'YouTube', clientArgs);
        } catch (err: any) {
          lastErr = err.message;
          console.log(`[youtube] Client failed: ${err.message}`);
          // Clean up any partial files
          try {
            const tempDir = getTempDir();
            fs.readdirSync(tempDir).filter(f => f.startsWith(outputId)).forEach(f => {
              try { fs.unlinkSync(path.join(tempDir, f)); } catch {}
            });
          } catch {}
        }
      }
      throw new Error(`YouTube extraction failed: ${lastErr}`);
    }

    case 'Spotify': {
      // Get track name from Spotify oEmbed then search YouTube
      try {
        const https = require('https');
        const trackInfo = await new Promise<any>((resolve, reject) => {
          const req = https.get(
            `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } },
            (res: any) => {
              let data = '';
              res.on('data', (c: any) => data += c);
              res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Parse error')); } });
            }
          );
          req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
          req.on('error', reject);
        });
        const trackName = trackInfo.title || '';
        console.log(`[spotify] Searching YouTube for: ${trackName}`);
        if (trackName) {
          return await runYtDlp(
            `ytsearch1:${trackName} audio`,
            outputId, 'Spotify',
            ['--default-search', 'ytsearch', '--extractor-args', 'youtube:player_client=android']
          );
        }
      } catch (e: any) {
        console.log(`[spotify] oEmbed failed: ${e.message}`);
      }
      // Fallback
      return runYtDlp(url, outputId, 'Spotify');
    }

    case 'SoundCloud':
      return runYtDlp(url, outputId, 'SoundCloud');

    case 'TikTok':
      return runYtDlp(url, outputId, 'TikTok', ['--extractor-args', 'tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com']);

    case 'Instagram':
      return runYtDlp(url, outputId, 'Instagram');

    case 'Apple Music': {
      const parts = url.split('/');
      const trackSlug = parts[parts.length - 1]?.split('?')[0]?.replace(/-/g, ' ') || '';
      return runYtDlp(
        `ytsearch1:${trackSlug} apple music`,
        outputId, 'Apple Music',
        ['--default-search', 'ytsearch', '--extractor-args', 'youtube:player_client=android']
      );
    }

    default:
      throw new Error('Unsupported platform. Please use YouTube, Spotify, SoundCloud, Apple Music, Instagram or TikTok.');
  }
}

export function cleanupFile(filePath: string): void { try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {} }
export function getTempFilePath(id: string, ext: string): string { return path.join(getTempDir(), `${id}.${ext}`); }
export function fileToBase64(filePath: string): string { return fs.readFileSync(filePath).toString('base64'); }
export function getFileSizeKB(filePath: string): number { try { return Math.round(fs.statSync(filePath).size / 1024); } catch { return 0; } }

import path from 'path';
import fs from 'fs';
import os from 'os';
import https from 'https';
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

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

function fetchJson(reqUrl: string, timeout = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = reqUrl.startsWith('https') ? https : require('http');
    const req = client.get(reqUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    }, (res: any) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchJson(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (c: any) => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } });
    });
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
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
    '--extract-audio', '--audio-format', 'mp3',
    '--audio-quality', '0', '--no-playlist', '--no-warnings', '--print-json',
    '--ffmpeg-location', ffmpegPath,
    '--postprocessor-args', 'ffmpeg:-ar 44100 -b:a 320k',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ...extraArgs,
  ];

  let metadata: any = {};
  try {
    const { stdout } = await execFileAsync('yt-dlp', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
    const lines = stdout.trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) { try { metadata = JSON.parse(lines[i]); break; } catch {} }
  } catch (err: any) {
    if (!fs.existsSync(finalMp3)) {
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith(outputId) && f.endsWith('.mp3'));
      if (!files.length) throw new Error(err.stderr || err.message || 'Extraction failed');
    }
  }

  if (!fs.existsSync(finalMp3)) throw new Error('Audio file was not created');
  return { filePath: finalMp3, title: metadata.title || 'Unknown Track', duration: metadata.duration || 0, platform };
}

async function extractYouTubeWithApi(url: string, outputId: string): Promise<ExtractionResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('Could not extract video ID');
  if (!apiKey) throw new Error('YouTube API key not configured');

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails`;
  const data = await fetchJson(apiUrl);

  if (!data.items || data.items.length === 0) throw new Error('Video not found');

  const video = data.items[0];
  const title = video.snippet?.title || 'Unknown Track';
  const isoDuration = video.contentDetails?.duration || 'PT0S';
  const durationMatch = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const duration = durationMatch
    ? (parseInt(durationMatch[1] || '0') * 3600) + (parseInt(durationMatch[2] || '0') * 60) + parseInt(durationMatch[3] || '0')
    : 0;

  console.log(`[youtube-api] Found: ${title} (${duration}s)`);

  const tempDir = getTempDir();
  const outputTemplate = path.join(tempDir, `${outputId}.%(ext)s`);
  const finalMp3 = path.join(tempDir, `${outputId}.mp3`);
  const ffmpegPath = getFfmpegPath();

  const ytdlpArgs = [
    `https://www.youtube.com/watch?v=${videoId}`,
    '--output', outputTemplate,
    '--format', 'bestaudio/best',
    '--extract-audio', '--audio-format', 'mp3',
    '--audio-quality', '0', '--no-playlist', '--no-warnings',
    '--ffmpeg-location', ffmpegPath,
    '--postprocessor-args', 'ffmpeg:-ar 44100 -b:a 320k',
    '--extractor-args', 'youtube:player_client=android,web_creator',
    '--user-agent', 'com.google.android.youtube/17.36.4 (Linux; U; Android 12; GB) gzip',
  ];

  try {
    await execFileAsync('yt-dlp', ytdlpArgs, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
  } catch (err: any) {
    if (!fs.existsSync(finalMp3)) {
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith(outputId) && f.endsWith('.mp3'));
      if (!files.length) throw new Error(`Download failed: ${err.stderr || err.message}`);
    }
  }

  if (!fs.existsSync(finalMp3)) throw new Error('Audio file was not created');
  return { filePath: finalMp3, title, duration, platform: 'YouTube' };
}

export async function extractAudio(url: string, outputId: string): Promise<ExtractionResult> {
  const platform = detectPlatform(url);
  console.log(`[extract] Platform: ${platform}`);

  switch (platform) {
    case 'YouTube':
      return extractYouTubeWithApi(url, outputId);

    case 'Spotify': {
      try {
        const oembedData = await fetchJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, 8000);
        const trackName = oembedData.title || '';
        if (trackName) {
          console.log(`[spotify] Searching for: ${trackName}`);
          return await runYtDlp(`ytsearch1:${trackName} audio`, outputId, 'Spotify',
            ['--default-search', 'ytsearch', '--extractor-args', 'youtube:player_client=android']);
        }
      } catch (e: any) { console.log(`[spotify] oEmbed failed: ${e.message}`); }
      return runYtDlp(url, outputId, 'Spotify');
    }

    case 'SoundCloud':
      return runYtDlp(url, outputId, 'SoundCloud');

    case 'TikTok':
      return runYtDlp(url, outputId, 'TikTok');

    case 'Instagram':
      return runYtDlp(url, outputId, 'Instagram');

    case 'Apple Music': {
      const parts = url.split('/');
      const trackSlug = parts[parts.length - 1]?.split('?')[0]?.replace(/-/g, ' ') || '';
      return runYtDlp(`ytsearch1:${trackSlug}`, outputId, 'Apple Music',
        ['--default-search', 'ytsearch', '--extractor-args', 'youtube:player_client=android']);
    }

    default:
      throw new Error('Unsupported platform.');
  }
}

export function cleanupFile(filePath: string): void { try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {} }
export function getTempFilePath(id: string, ext: string): string { return path.join(getTempDir(), `${id}.${ext}`); }
export function fileToBase64(filePath: string): string { return fs.readFileSync(filePath).toString('base64'); }
export function getFileSizeKB(filePath: string): number { try { return Math.round(fs.statSync(filePath).size / 1024); } catch { return 0; } }

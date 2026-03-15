import path from 'path';
import fs from 'fs';
import os from 'os';
import https from 'https';
import http from 'http';
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

function fetchJson(url: string, timeout = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchJson(res.headers.location!, timeout).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Invalid JSON from ${url}: ${data.substring(0, 100)}`)); }
      });
    });
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const request = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://piped.video/',
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlink(dest, () => {});
        downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    });
    request.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.yt',
  'https://piped.syncpundit.io/api',
  'https://piped.video/api',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.moomoo.me',
];

async function extractYouTubeViaPiped(url: string, outputId: string): Promise<ExtractionResult> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('Could not extract YouTube video ID');

  const tempDir = getTempDir();
  const tempAudio = path.join(tempDir, `${outputId}.webm`);
  const finalMp3 = path.join(tempDir, `${outputId}.mp3`);
  const ffmpegPath = getFfmpegPath();

  let videoData: any = null;
  let lastError = '';

  for (const instance of PIPED_INSTANCES) {
    try {
      console.log(`[piped] Trying ${instance}/streams/${videoId}`);
      const data = await fetchJson(`${instance}/streams/${videoId}`, 8000);
      if (data && data.audioStreams && data.audioStreams.length > 0) {
        videoData = data;
        console.log(`[piped] Success with ${instance}`);
        break;
      }
    } catch (err: any) {
      lastError = err.message;
      console.log(`[piped] Failed ${instance}: ${err.message}`);
    }
  }

  if (!videoData || !videoData.audioStreams?.length) {
    throw new Error(`All Piped instances failed. Last error: ${lastError}`);
  }

  const audioStreams = videoData.audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
  const bestAudio = audioStreams[0];
  console.log(`[piped] Downloading: ${bestAudio.mimeType} ${bestAudio.bitrate}bps`);

  await downloadFile(bestAudio.url, tempAudio);

  await execFileAsync(ffmpegPath, [
    '-y', '-i', tempAudio,
    '-codec:a', 'libmp3lame', '-b:a', '320k', '-ar', '44100', '-ac', '2',
    finalMp3
  ], { timeout: 120000 });

  try { fs.unlinkSync(tempAudio); } catch {}

  return {
    filePath: finalMp3,
    title: videoData.title || 'Unknown Track',
    duration: videoData.duration || 0,
    platform: 'YouTube'
  };
}

async function extractWithYtDlp(url: string, outputId: string, platform: string, extraArgs: string[] = []): Promise<ExtractionResult> {
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
      if (!files.length) throw new Error(`Extraction failed: ${err.message}`);
    }
  }

  return { filePath: finalMp3, title: metadata.title || 'Unknown Track', duration: metadata.duration || 0, platform };
}

async function extractSpotify(url: string, outputId: string): Promise<ExtractionResult> {
  // Extract track info from Spotify oEmbed API (no auth needed)
  try {
    const oembedData = await fetchJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, 8000);
    const trackName = oembedData.title || '';
    console.log(`[spotify] Track name: ${trackName}`);

    if (trackName) {
      // Search YouTube for the track and download it
      return extractWithYtDlp(
        `ytsearch1:${trackName} official audio`,
        outputId,
        'Spotify',
        ['--default-search', 'ytsearch']
      );
    }
  } catch (err: any) {
    console.log(`[spotify] oEmbed failed: ${err.message}`);
  }

  // Fallback: try direct yt-dlp with Spotify URL
  return extractWithYtDlp(url, outputId, 'Spotify');
}

export async function extractAudio(url: string, outputId: string): Promise<ExtractionResult> {
  const platform = detectPlatform(url);
  console.log(`[extract] Platform: ${platform}, URL: ${url.substring(0, 60)}`);

  switch (platform) {
    case 'YouTube':
      return extractYouTubeViaPiped(url, outputId);
    case 'Spotify':
      return extractSpotify(url, outputId);
    case 'SoundCloud':
      return extractWithYtDlp(url, outputId, 'SoundCloud');
    case 'TikTok':
      return extractWithYtDlp(url, outputId, 'TikTok');
    case 'Instagram':
      return extractWithYtDlp(url, outputId, 'Instagram');
    case 'Apple Music': {
      const trackName = url.split('/').pop()?.replace(/-/g, ' ') || '';
      return extractWithYtDlp(`ytsearch1:${trackName}`, outputId, 'Apple Music', ['--default-search', 'ytsearch']);
    }
    default:
      throw new Error('Unsupported platform');
  }
}

export function cleanupFile(filePath: string): void { try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {} }
export function getTempFilePath(id: string, ext: string): string { return path.join(getTempDir(), `${id}.${ext}`); }
export function fileToBase64(filePath: string): string { return fs.readFileSync(filePath).toString('base64'); }
export function getFileSizeKB(filePath: string): number { try { return Math.round(fs.statSync(filePath).size / 1024); } catch { return 0; } }

import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { extractAudio, detectPlatform } from '../../lib/audio-extractor';
import { detectChorus, getAudioDuration } from '../../lib/chorus-detector';
import { getServedUrl, getTempDir } from '../../lib/file-storage';
import path from 'path';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: false,
  },
};

interface ExtractRequest {
  url: string;
}

interface ExtractResponse {
  success: boolean;
  audioUrl?: string;
  chorusStart?: number;
  chorusEnd?: number;
  title?: string;
  platform?: string;
  duration?: number;
  confidence?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExtractResponse>
) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { url } = req.body as ExtractRequest;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid URL format' });
  }

  const platform = detectPlatform(url);
  if (platform === 'Unknown') {
    return res.status(400).json({
      success: false,
      error: 'Unsupported platform. Supported: YouTube, Spotify, SoundCloud, Apple Music, Instagram, TikTok',
    });
  }

  const extractionId = uuidv4();

  try {
    console.log(`[extract] Starting extraction for ${platform}: ${url.substring(0, 60)}...`);

    // Extract audio
    const result = await extractAudio(url, extractionId);

    if (!fs.existsSync(result.filePath)) {
      throw new Error('Audio file was not created');
    }

    // Get duration if not provided
    let duration = result.duration;
    if (!duration || duration === 0) {
      duration = await getAudioDuration(result.filePath);
    }

    console.log(`[extract] Audio extracted: ${result.title} (${duration}s)`);

    // Run chorus detection
    let chorusResult = { chorusStart: -1, chorusEnd: -1, confidence: 0, method: 'none' };
    try {
      chorusResult = await detectChorus(result.filePath, duration);
      console.log(
        `[extract] Chorus detected: ${chorusResult.chorusStart}s - ${chorusResult.chorusEnd}s (${chorusResult.method})`
      );
    } catch (chorusErr) {
      console.error('[extract] Chorus detection failed:', chorusErr);
      // Use fallback
      chorusResult.chorusStart = Math.floor(duration * 0.35);
      chorusResult.chorusEnd = Math.min(Math.floor(duration * 0.55), chorusResult.chorusStart + 30);
    }

    // Generate a served URL for the audio file
    const filename = path.basename(result.filePath);
    const host = req.headers.host || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const audioUrl = getServedUrl(filename, `${protocol}://${host}`);

    return res.status(200).json({
      success: true,
      audioUrl,
      chorusStart: chorusResult.chorusStart,
      chorusEnd: chorusResult.chorusEnd,
      title: result.title,
      platform: result.platform,
      duration,
      confidence: chorusResult.confidence,
    });
  } catch (err: unknown) {
    console.error('[extract] Error:', err);

    // Clean up on failure
    const tempDir = getTempDir();
    try {
      const files = fs.readdirSync(tempDir).filter((f) => f.startsWith(extractionId));
      files.forEach((f) => fs.unlinkSync(path.join(tempDir, f)));
    } catch {
      // Ignore cleanup errors
    }

    const message = err instanceof Error ? err.message : 'Extraction failed';
    return res.status(500).json({
      success: false,
      error: message.includes('yt-dlp')
        ? 'Could not extract audio. The link may be unavailable, private, or region-restricted.'
        : message,
    });
  }
}

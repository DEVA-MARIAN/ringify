import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { trimAudio } from '../../lib/ffmpeg-utils';
import { getTempDir, getServedUrl, getTempFilePath } from '../../lib/file-storage';
import path from 'path';
import fs from 'fs';
import url from 'url';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: false,
  },
};

interface TrimRequest {
  audioUrl: string;
  startTime: number;
  endTime: number;
  format?: 'mp3' | 'm4r';
}

interface TrimResponse {
  success: boolean;
  ringtoneUrl?: string;
  duration?: number;
  format?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TrimResponse>
) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { audioUrl, startTime, endTime, format = 'mp3' } = req.body as TrimRequest;

  // Validation
  if (!audioUrl || typeof audioUrl !== 'string') {
    return res.status(400).json({ success: false, error: 'audioUrl is required' });
  }

  if (typeof startTime !== 'number' || typeof endTime !== 'number') {
    return res.status(400).json({ success: false, error: 'startTime and endTime must be numbers' });
  }

  if (startTime < 0 || endTime <= startTime) {
    return res.status(400).json({ success: false, error: 'Invalid time range' });
  }

  const duration = endTime - startTime;
  if (duration > 600) {
    return res.status(400).json({ success: false, error: 'Maximum ringtone length is 10 minutes' });
  }

  // Resolve the input file from the URL
  let inputFilePath: string;
  try {
    const parsedUrl = new URL(audioUrl);
    const filename = decodeURIComponent(path.basename(parsedUrl.pathname));
    inputFilePath = getTempFilePath(filename);

    if (!fs.existsSync(inputFilePath)) {
      return res.status(404).json({
        success: false,
        error: 'Source audio not found. Please extract the audio again.',
      });
    }
  } catch (err) {
    return res.status(400).json({ success: false, error: 'Invalid audioUrl' });
  }

  const outputId = uuidv4();
  const ext = format === 'm4r' ? 'm4r' : 'mp3';
  const outputFilename = `${outputId}.${ext}`;
  const outputFilePath = path.join(getTempDir(), outputFilename);

  try {
    console.log(`[trim] Trimming ${startTime}s - ${endTime}s as .${format}`);

    await trimAudio({
      inputPath: inputFilePath,
      outputPath: outputFilePath,
      startTime,
      endTime,
      format,
    });

    if (!fs.existsSync(outputFilePath)) {
      throw new Error('Output file was not created');
    }

    const host = req.headers.host || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const ringtoneUrl = getServedUrl(outputFilename, `${protocol}://${host}`);

    console.log(`[trim] Success: ${outputFilename}`);

    return res.status(200).json({
      success: true,
      ringtoneUrl,
      duration,
      format: ext,
    });
  } catch (err: unknown) {
    console.error('[trim] Error:', err);

    // Clean up failed output
    try {
      if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
    } catch {
      // Ignore
    }

    const message = err instanceof Error ? err.message : 'Trim failed';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}

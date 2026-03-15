import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';
import { getTempFilePath } from '../../../lib/file-storage';

const MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4r: 'audio/x-m4r',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
};

export const config = {
  api: {
    responseLimit: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const { filename } = req.query;

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: 'Filename required' });
  }

  // Security: prevent path traversal
  const sanitizedFilename = path.basename(decodeURIComponent(filename));
  if (sanitizedFilename !== decodeURIComponent(filename) && sanitizedFilename !== filename) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  // Only allow known extensions
  const ext = sanitizedFilename.split('.').pop()?.toLowerCase();
  if (!ext || !MIME_TYPES[ext]) {
    return res.status(400).json({ error: 'Unsupported file type' });
  }

  const filePath = getTempFilePath(sanitizedFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stats = fs.statSync(filePath);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  // Support range requests (needed for audio streaming in browsers)
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stats.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
    });

    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': stats.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
      'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}

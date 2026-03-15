import type { NextApiRequest, NextApiResponse } from 'next';
import { checkFFmpegAvailable, checkYtDlpAvailable } from '../../lib/ffmpeg-utils';

interface HealthResponse {
  status: string;
  ffmpeg: boolean;
  ytdlp: boolean;
  timestamp: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  const [ffmpeg, ytdlp] = await Promise.all([
    checkFFmpegAvailable(),
    checkYtDlpAvailable(),
  ]);

  const status = ffmpeg && ytdlp ? 'healthy' : 'degraded';

  return res.status(ffmpeg && ytdlp ? 200 : 503).json({
    status,
    ffmpeg,
    ytdlp,
    timestamp: new Date().toISOString(),
  });
}

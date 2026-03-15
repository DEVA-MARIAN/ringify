import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * In production (Vercel), we'd use cloud storage (S3, Cloudinary, etc.)
 * For local dev, we serve files from the temp directory via a dedicated API route.
 * 
 * This module abstracts the URL generation so it can be swapped for cloud storage.
 */

const TEMP_DIR = path.join(os.tmpdir(), 'ringify');

export function getTempDir(): string {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  return TEMP_DIR;
}

/**
 * Generate a served URL for a temp file.
 * In development: /api/audio/[filename]
 * In production: would be a CDN URL
 */
export function getServedUrl(filename: string, baseUrl: string): string {
  // For Vercel/production, swap this for your CDN/storage URL
  return `${baseUrl}/api/audio/${encodeURIComponent(filename)}`;
}

/**
 * Get the full path of a file in the temp dir
 */
export function getTempFilePath(filename: string): string {
  return path.join(TEMP_DIR, filename);
}

/**
 * Check if a file exists in temp storage
 */
export function tempFileExists(filename: string): boolean {
  return fs.existsSync(getTempFilePath(filename));
}

/**
 * List temp files older than maxAgeMs and delete them (cleanup)
 */
export function cleanupOldFiles(maxAgeMs = 3600000): void {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Ignore individual file errors
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

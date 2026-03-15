const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
const YTDLP_PATH = path.join(process.cwd(), 'bin', 'yt-dlp');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (url) => {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) { follow(res.headers.location); return; }
        if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  if (process.platform !== 'linux') { console.log('Skipping on ' + process.platform); return; }
  const binDir = path.join(process.cwd(), "bin");
  const binDir2 = path.join(process.cwd(), "public", "bin");
  if (!fs.existsSync(binDir2)) fs.mkdirSync(binDir2, { recursive: true });
  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
  const YTDLP_PATH2 = path.join(binDir2, "yt-dlp");
  if (!fs.existsSync(YTDLP_PATH)) {
    console.log('Downloading yt-dlp...');
    await download(YTDLP_URL, YTDLP_PATH);
    fs.chmodSync(YTDLP_PATH, '755');
    if (!fs.existsSync(YTDLP_PATH2)) { fs.copyFileSync(YTDLP_PATH, YTDLP_PATH2); fs.chmodSync(YTDLP_PATH2, '755'); }
    console.log('Done!');
  }
}

main().catch(err => { console.error(err); process.exit(0); });


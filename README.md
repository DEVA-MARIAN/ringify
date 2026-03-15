# 🎵 Ringify

**Turn any song link into a perfect ringtone.**

Paste a link from YouTube, Spotify, SoundCloud, Apple Music, Instagram, or TikTok. AI detects the most recognizable part (chorus). You customize it. Download as MP3 or M4R.

---

## ✨ Features

- **Multi-platform support** — YouTube, Spotify, SoundCloud, Apple Music, Instagram Reels, TikTok
- **AI chorus detection** — Energy-peak + structural analysis to find the best part automatically
- **Interactive waveform editor** — WaveSurfer.js with draggable start/end region handles
- **Manual trimming** — Override AI at any time; drag markers, use sliders or numeric inputs
- **Duration presets** — 10s, 20s, 30s, or fully custom
- **High quality output** — MP3 320kbps (Android) or M4R AAC (iPhone)
- **Fade in/out** — Professional ringtone polish
- **Download page** — Per-platform setup instructions

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Waveform | WaveSurfer.js v7 with Regions plugin |
| Animation | Framer Motion |
| Backend | Next.js API Routes (Pages Router) |
| Audio extraction | yt-dlp |
| Audio processing | FFmpeg |
| Chorus detection | Custom energy analysis module |
| Deployment | Vercel |

---

## 📋 Prerequisites

Install these system dependencies before running locally:

### macOS
```bash
brew install ffmpeg yt-dlp
```

### Ubuntu / Debian
```bash
# FFmpeg
sudo apt-get update && sudo apt-get install -y ffmpeg

# yt-dlp
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### Windows
```powershell
# Using winget
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp

# Or using choco
choco install ffmpeg yt-dlp
```

Verify installations:
```bash
ffmpeg -version
yt-dlp --version
```

---

## 🚀 Local Development

```bash
# 1. Clone the repo
git clone https://github.com/yourname/ringify.git
cd ringify

# 2. Install Node dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local if needed (defaults work for local dev)

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🌐 Deploying to Vercel

### Option A — Vercel CLI (recommended)

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Option B — GitHub integration

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Set environment variables in Vercel dashboard (see below)
4. Deploy

### ⚠️ Important: FFmpeg on Vercel

Vercel Serverless Functions don't include FFmpeg or yt-dlp by default. Use one of these approaches:

#### Option 1: ffmpeg-static (recommended for quick deploy)

```bash
npm install ffmpeg-static @ffmpeg-installer/ffmpeg
```

Then in `lib/ffmpeg-utils.ts`, configure fluent-ffmpeg:
```typescript
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
ffmpeg.setFfmpegPath(ffmpegPath!);
```

#### Option 2: Vercel Build Script

Add a `build.sh` that downloads ffmpeg binaries:
```bash
#!/bin/bash
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
  -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp
```

#### Option 3: External Processing (Production-grade)

For high-traffic production use, offload audio processing to:
- A dedicated VPS / EC2 instance running the extraction worker
- A queue (BullMQ + Redis) for async job processing
- Cloud storage (S3 / Cloudinary) for serving processed files

The API routes are already structured to support this — swap `extractAudio()` and `trimAudio()` implementations.

### Environment Variables (Vercel Dashboard)

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Your Vercel URL |

---

## 📁 Project Structure

```
ringify/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── globals.css         # Global styles + WaveSurfer overrides
│   ├── page.tsx            # Home page (link input)
│   ├── editor/
│   │   └── page.tsx        # Waveform editor page
│   └── download/
│       └── page.tsx        # Download + install instructions page
├── components/
│   └── WaveformEditor.tsx  # WaveSurfer.js waveform + region editor
├── pages/
│   └── api/
│       ├── extract.ts      # POST /api/extract — extract + chorus detect
│       ├── trim.ts         # POST /api/trim — FFmpeg trim + export
│       ├── health.ts       # GET /api/health — dependency health check
│       └── audio/
│           └── [filename].ts # GET /api/audio/:file — serve audio files
├── lib/
│   ├── audio-extractor.ts  # yt-dlp wrapper, platform detection
│   ├── chorus-detector.ts  # Energy analysis chorus detection
│   ├── ffmpeg-utils.ts     # FFmpeg trim, convert, waveform utils
│   └── file-storage.ts     # Temp file management + URL generation
├── public/                 # Static assets
├── next.config.js
├── tailwind.config.js
├── vercel.json
└── .env.example
```

---

## 🔌 API Reference

### `POST /api/extract`

Extract audio and detect chorus from a song link.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response:**
```json
{
  "success": true,
  "audioUrl": "http://localhost:3000/api/audio/uuid.mp3",
  "chorusStart": 74.2,
  "chorusEnd": 99.8,
  "title": "Never Gonna Give You Up",
  "platform": "YouTube",
  "duration": 212,
  "confidence": 0.75
}
```

---

### `POST /api/trim`

Trim audio to create ringtone.

**Request:**
```json
{
  "audioUrl": "http://localhost:3000/api/audio/uuid.mp3",
  "startTime": 74.2,
  "endTime": 99.8,
  "format": "mp3"
}
```

**Response:**
```json
{
  "success": true,
  "ringtoneUrl": "http://localhost:3000/api/audio/trim-uuid.mp3",
  "duration": 25.6,
  "format": "mp3"
}
```

**Supported formats:** `mp3` (Android, 320kbps) · `m4r` (iPhone, AAC 256kbps)

---

### `GET /api/health`

Check system dependency status.

**Response:**
```json
{
  "status": "healthy",
  "ffmpeg": true,
  "ytdlp": true,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

## 🎨 Chorus Detection Algorithm

The chorus detector uses a multi-pass energy analysis:

1. **FFmpeg `astats` filter** — extracts per-second RMS energy data
2. **Smoothing window** — reduces noise in energy signal (5-frame average)
3. **Peak segmentation** — identifies sustained high-energy sections (≥ top 25%)
4. **Position scoring** — segments in 25–75% of song duration get a 1.2× boost (chorus position heuristic)
5. **Target clipping** — extracts a ~25s window centered on the energy peak
6. **Fallback** — if analysis fails, defaults to the 35–55% position of the song

**Confidence levels:**
- `0.75+` — Energy analysis succeeded
- `0.3` — Heuristic fallback used

---

## 🔒 Security Notes

- **Path traversal prevention** — `[filename].ts` uses `path.basename()` to sanitize filenames
- **Extension allowlist** — Only `mp3`, `m4r`, `m4a`, `aac`, `wav`, `ogg` are served
- **URL validation** — Platform patterns checked before any processing
- **Temp file cleanup** — Files older than 1 hour are automatically deleted

---

## 🐛 Troubleshooting

**"yt-dlp not found"**
```bash
which yt-dlp   # Should show a path
yt-dlp --version  # Should print version
```
If not found, reinstall yt-dlp and ensure it's in your PATH.

**"ffmpeg not found"**
```bash
which ffmpeg
ffmpeg -version
```

**"Audio extraction failed" for Spotify/Apple Music**
yt-dlp can extract from Spotify/Apple Music using their web players or by falling back to a YouTube search. Some tracks may not be available. For best results, use YouTube or SoundCloud links.

**Waveform not loading**
Check browser console for CORS errors. Ensure the `/api/audio/[filename]` route is returning proper `Access-Control-Allow-Origin` headers.

**Large audio files / slow processing**
Processing time scales with song duration. The `/api/extract` route has a 300s timeout (Vercel Pro). For longer content, consider pre-trimming with yt-dlp's `--download-sections` flag.

---

## 📄 License

MIT © Ringify

---

Built with ❤️ using Next.js, FFmpeg, yt-dlp, and WaveSurfer.js

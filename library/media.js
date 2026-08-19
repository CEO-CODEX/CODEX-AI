const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// Resolve a real ffmpeg binary instead of assuming one is on the system PATH.
// Prefer the bundled @ffmpeg-installer/ffmpeg binary (same one library/exif.js
// uses), fall back to ffmpeg-static, and only fall back to the bare 'ffmpeg'
// command (relying on PATH) if neither package is available.
function resolveFfmpegPath() {
  try {
    return require('@ffmpeg-installer/ffmpeg').path;
  } catch {}
  try {
    return require('ffmpeg-static');
  } catch {}
  return 'ffmpeg';
}

const ffmpegBinary = resolveFfmpegPath();

function quotedMessage(message) {
  return message?.quoted || message;
}

function mimeOf(message) {
  return message?.mimetype || message?.msg?.mimetype || '';
}

async function download(message) {
  if (typeof message?.download !== 'function') throw new Error('Reply to media');
  return message.download();
}

function tempDir() {
  const directory = path.join(process.cwd(), 'temp');
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

// ffmpeg's built-in WebP demuxer only supports still-image WebP — it does
// NOT understand the ANIM/ANMF chunks that make a WhatsApp sticker animated.
// Feeding it an animated sticker fails with "skipping unsupported chunk:
// ANIM/ANMF" followed by "image data not found", no matter how ffmpeg is
// installed or configured. Detect that case and pre-decode with sharp
// (already a project dependency, backed by libvips, which handles animated
// WebP correctly) into a GIF, which ffmpeg reads natively and reliably.
// Static/non-animated WebP and non-WebP input pass through unchanged.
async function normalizeInput(buffer, mime) {
  if (!/webp/.test(mime || '')) return { buffer, ext: null };
  try {
    const sharp = require('sharp');
    const img = sharp(buffer, { animated: true });
    const meta = await img.metadata();
    if (meta.pages && meta.pages > 1) {
      const gifBuffer = await img.gif().toBuffer();
      return { buffer: gifBuffer, ext: 'gif' };
    }
  } catch {
    // sharp missing, or decode failed — fall through and let ffmpeg try
    // the original buffer (works fine for static WebP).
  }
  return { buffer, ext: null };
}

async function ffmpeg(input, output, args) {
  try {
    await execFileAsync(ffmpegBinary, ['-y', '-i', input, ...args, output]);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('ffmpeg binary not found — run "npm install" so @ffmpeg-installer/ffmpeg is available.');
    }
    throw err;
  }
}

function cleanup(...files) {
  for (const file of files) {
    try { fs.rmSync(file, { recursive: true, force: true }); } catch {}
  }
}

module.exports = { fs, path, quotedMessage, mimeOf, download, tempDir, ffmpeg, cleanup, normalizeInput };

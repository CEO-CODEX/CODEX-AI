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

module.exports = { fs, path, quotedMessage, mimeOf, download, tempDir, ffmpeg, cleanup };

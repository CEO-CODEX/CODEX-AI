const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

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
  await execFileAsync('ffmpeg', ['-y', '-i', input, ...args, output]);
}

function cleanup(...files) {
  for (const file of files) {
    try { fs.rmSync(file, { recursive: true, force: true }); } catch {}
  }
}

module.exports = { fs, path, quotedMessage, mimeOf, download, tempDir, ffmpeg, cleanup };

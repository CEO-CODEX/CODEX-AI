const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

function quotedMessage(m) { return m?.quoted || m; }
function mimeOf(msg) { return msg?.mimetype || msg?.msg?.mimetype || ''; }
async function download(msg) { if (typeof msg?.download === 'function') return msg.download(); throw new Error('Reply to media'); }
function tempDir() { const dir = path.join(process.cwd(), 'temp'); fs.mkdirSync(dir, { recursive: true }); return dir; }
async function ffmpeg(input, output, args) { await execFileAsync('ffmpeg', ['-y', '-i', input, ...args, output]); }
function cleanup(...files) { for (const file of files) { try { fs.rmSync(file, { recursive: true, force: true }); } catch {} } }
module.exports = { fs, path, quotedMessage, mimeOf, download, tempDir, ffmpeg, cleanup }; 

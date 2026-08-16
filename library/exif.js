const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const webp = require('node-webpmux');

ffmpeg.setFfmpegPath(ffmpegPath);

function tempPath(extension) {
  return path.join(os.tmpdir(), `codex-${crypto.randomBytes(8).toString('hex')}.${extension}`);
}

async function transcodeToWebp(media, inputExtension, options = {}) {
  const input = tempPath(inputExtension);
  const output = tempPath('webp');
  fs.writeFileSync(input, media);

  try {
    await new Promise((resolve, reject) => {
      const command = ffmpeg(input)
        .outputOptions([
          '-vcodec', 'libwebp',
          '-vf', "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0,format=yuva420p",
          ...(options.animated ? ['-loop', '0', '-t', '10', '-an', '-vsync', '0'] : ['-an'])
        ])
        .toFormat('webp')
        .on('end', resolve)
        .on('error', reject);
      command.save(output);
    });
    return fs.readFileSync(output);
  } finally {
    fs.rmSync(input, { force: true });
    fs.rmSync(output, { force: true });
  }
}

async function imageToWebp(media) {
  return transcodeToWebp(media, 'jpg');
}

async function videoToWebp(media) {
  return transcodeToWebp(media, 'mp4', { animated: true });
}

function buildExif(packname, author, categories = ['']) {
  const json = {
    'sticker-pack-id': `com.codexai.${crypto.randomUUID()}`,
    'sticker-pack-name': packname || 'CODEX AI',
    'sticker-pack-publisher': author || 'CODEX',
    emojis: categories,
  };
  const header = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
  const payload = Buffer.from(JSON.stringify(json), 'utf8');
  const exif = Buffer.concat([header, payload]);
  exif.writeUInt32LE(payload.length, 14);
  return exif;
}

async function addExif(webpBuffer, packname = 'CODEX AI', author = 'CODEX', categories = ['']) {
  const image = new webp.Image();
  await image.load(webpBuffer);
  image.exif = buildExif(packname, author, categories);
  return image.save(null);
}

async function writeExif(media, metadata = {}) {
  const mime = media.mimetype || '';
  const converted = /webp/.test(mime)
    ? media.data
    : /image/.test(mime)
      ? await imageToWebp(media.data)
      : /video/.test(mime)
        ? await videoToWebp(media.data)
        : null;
  if (!converted) throw new Error('Unsupported media type');
  return addExif(converted, metadata.packname, metadata.author, metadata.categories);
}

async function writeExifImg(media, metadata = {}) {
  return addExif(await imageToWebp(media), metadata.packname, metadata.author, metadata.categories);
}

async function writeExifVid(media, metadata = {}) {
  return addExif(await videoToWebp(media), metadata.packname, metadata.author, metadata.categories);
}

async function exifAvatar(buffer, packname, author, categories = [''], extra = {}) {
  const image = new webp.Image();
  const exif = buildExif(packname, author, categories);
  const json = { ...JSON.parse(exif.subarray(22).toString()), 'is-avatar-sticker': 1, ...extra };
  const payload = Buffer.from(JSON.stringify(json));
  const header = exif.subarray(0, 22);
  const finalExif = Buffer.concat([header, payload]);
  finalExif.writeUInt32LE(payload.length, 14);
  await image.load(buffer);
  image.exif = finalExif;
  return image.save(null);
}

module.exports = { imageToWebp, videoToWebp, writeExifImg, writeExifVid, writeExif, exifAvatar, addExif };

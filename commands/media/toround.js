const { quotedMessage, mimeOf, download, tempDir, ffmpeg, cleanup, fs, path } = require('./_utils');
const { addExif } = require('../../library/exif');
module.exports = { name: 'toround', alias: ['2round', 'makeround', 'tround'], category: 'Media', desc: 'Convert video or sticker to a round sticker', usage: '.toround (reply to video or sticker)', execute: async (sock, m, { reply }) => {
  const q = quotedMessage(m), mime = mimeOf(q); if (!/video|webp/.test(mime)) return reply('Reply to a video or sticker.');
  const dir = tempDir(), input = path.join(dir, `toround-${Date.now()}.input`), output = path.join(dir, `toround-${Date.now()}.webp`);
  try { fs.writeFileSync(input, await download(q)); await ffmpeg(input, output, ['-t','10','-vf',"scale=512:512:force_original_aspect_ratio=increase,crop=512:512,format=rgba,geq=r=r(X,Y):g=g(X,Y):b=b(X,Y):a=if(lt(sqrt((X-256)^2+(Y-256)^2),256),255,0)",'-c:v','libwebp','-q:v','60','-loop','0','-an']); const sticker = await addExif(fs.readFileSync(output), 'CODEX AI', 'CODEX', ['']); await sock.sendMessage(m.chat, { sticker }, { quoted: m }); } catch (e) { return reply(`Failed: ${e.message}`); } finally { cleanup(input, output); }
} };

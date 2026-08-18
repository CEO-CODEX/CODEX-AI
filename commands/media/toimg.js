const { quotedMessage, mimeOf, download, tempDir, ffmpeg, cleanup, fs, path } = require('../../library/media');

module.exports = {
  name: 'toimg',
  alias: ['stickertoimg', 'toimage'],
  category: 'Media',
    reactions: { start: '📸' },
  desc: 'Convert a sticker to an image or video',
  execute: async (client, m, { reply }) => {
    const quoted = quotedMessage(m);
    if (!/webp/.test(mimeOf(quoted))) return reply('Reply to a sticker.');
    const dir = tempDir();
    const input = path.join(dir, `toimg-${Date.now()}.webp`);
    const output = path.join(dir, `toimg-${Date.now()}.mp4`);
    try {
      fs.writeFileSync(input, await download(quoted));
      await ffmpeg(input, output, ['-movflags', '+faststart', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an']);
      await client.sendMessage(m.chat, { video: fs.readFileSync(output), mimetype: 'video/mp4' }, { quoted: m });
    } catch (error) {
      return reply(`Failed: ${error.message}`);
    } finally {
      cleanup(input, output);
    }
  },
};

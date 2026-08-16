const { quotedMessage, mimeOf, download, tempDir, ffmpeg, cleanup, fs, path } = require('../../library/media');

module.exports = {
  name: 'togif',
  alias: ['sticker2gif', 'stktogif', 'video2gif', 'v2gif'],
  category: 'Media',
  desc: 'Convert a sticker or video to GIF playback',
  execute: async (sock, m, { reply }) => {
    const quoted = quotedMessage(m);
    const mime = mimeOf(quoted);
    if (!/webp|video/.test(mime)) return reply('Reply to a sticker or video.');
    const dir = tempDir();
    const input = path.join(dir, `togif-${Date.now()}.input`);
    const output = path.join(dir, `togif-${Date.now()}.mp4`);
    try {
      fs.writeFileSync(input, await download(quoted));
      await ffmpeg(input, output, ['-vf', 'fps=15,scale=512:-2:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-movflags', '+faststart', '-an']);
      await sock.sendMessage(m.chat, { video: fs.readFileSync(output), mimetype: 'video/mp4', gifPlayback: true }, { quoted: m });
    } catch (error) {
      return reply(`Failed: ${error.message}`);
    } finally {
      cleanup(input, output);
    }
  },
};

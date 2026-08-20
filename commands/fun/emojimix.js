const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function run(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error) => (error ? reject(error) : resolve()));
  });
}

module.exports = {
  name: 'emojimix',
  aliases: ['mixemoji', 'emoji'],
  description: 'Mix two emojis into a sticker',
  category: 'Fun',
  usage: 'emojimix 😀+🥰',
  reactions: { start: '👌', success: '✨' },

  async execute(sock, m, { args, reply }) {
    const input = args.join(' ');
    if (!input.includes('+')) return reply('Example: .emojimix 😎+🥰');

    const [emoji1, emoji2] = input.split('+').map((item) => item.trim());
    const key = process.env.TENOR_API_KEY;
    if (!key) return reply('✘ Emoji Mix is unavailable because TENOR_API_KEY is not configured.');

    const url = `https://tenor.googleapis.com/v2/featured?key=${encodeURIComponent(key)}&contentfilter=high&media_filter=png_transparent&collection=emoji_kitchen_v5&q=${encodeURIComponent(`${emoji1}_${emoji2}`)}`;
    let tempFile;
    let outputFile;

    try {
      const response = await fetch(url);
      const data = await response.json();
      const imageUrl = data.results?.[0]?.url;
      if (!imageUrl) return reply('𓉤 These emojis cannot be mixed.');

      const directory = path.join(process.cwd(), 'tmp');
      fs.mkdirSync(directory, { recursive: true });
      const stamp = Date.now();
      tempFile = path.join(directory, `mix_${stamp}.png`);
      outputFile = path.join(directory, `mix_${stamp}.webp`);
      fs.writeFileSync(tempFile, Buffer.from(await (await fetch(imageUrl)).arrayBuffer()));

      await run(`ffmpeg -y -i "${tempFile}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" "${outputFile}"`);
      await sock.sendMessage(m.chat, { sticker: fs.readFileSync(outputFile) }, { quoted: m });
      await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
    } catch (error) {
      console.error('[emojimix]', error.message);
      await reply('❌ Failed to mix those emojis.');
    } finally {
      for (const file of [tempFile, outputFile]) {
        if (file) try { fs.unlinkSync(file); } catch {}
      }
    }
  },
};

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
  category: 'Fun',
  description: 'Mix two emojis into a sticker',
  usage: 'emojimix 😎+🥰',
  reactions: { start: '👌', success: '✨' },

  async execute(sock, m, { args, reply }) {
    try {
      const text = args.join(' ');
      if (!text || !text.includes('+')) {
        return reply('🎴 _*Example:\n.emojimix 😎+🥰*_');
      }

      const [emoji1, emoji2] = text.split('+').map((emoji) => emoji.trim());
      const tenorApiKey = process.env.TENOR_API_KEY;
      if (!tenorApiKey) {
        return reply('✘ Emoji Mix is unavailable because TENOR_API_KEY is not configured.');
      }

      const url =
        `https://tenor.googleapis.com/v2/featured?` +
        `key=${encodeURIComponent(tenorApiKey)}` +
        '&contentfilter=high' +
        '&media_filter=png_transparent' +
        '&collection=emoji_kitchen_v5' +
        `&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;

      const response = await fetch(url);
      const data = await response.json();
      if (!data.results?.length) return reply('𓉤 _*Emoji cannot be mixed*_.');

      const imageUrl = data.results[0].url;
      const tmpDir = path.join(process.cwd(), 'tmp');
      fs.mkdirSync(tmpDir, { recursive: true });
      const stamp = Date.now();
      const tempFile = path.join(tmpDir, `mix_${stamp}.png`);
      const outputFile = path.join(tmpDir, `mix_${stamp}.webp`);

      fs.writeFileSync(tempFile, Buffer.from(await (await fetch(imageUrl)).arrayBuffer()));
      await run(
        `ffmpeg -y -i "${tempFile}" ` +
          '-vf "scale=512:512:force_original_aspect_ratio=decrease,' +
          'format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" ' +
          `"${outputFile}"`,
      );

      if (!fs.existsSync(outputFile)) return reply('✘ *Sticker generation failed*.');
      await sock.sendMessage(m.chat, { sticker: fs.readFileSync(outputFile) }, { quoted: m });

      for (const file of [tempFile, outputFile]) {
        try { fs.unlinkSync(file); } catch {}
      }
    } catch (error) {
      console.error('EmojiMix Error:', error.message);
      await reply('❌ Failed to mix emojis.');
    }
  },
};

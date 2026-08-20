module.exports = {
  name: 'meme',
  aliases: ['memes', 'cheems'],
  description: 'Fetch a random Cheems meme',
  category: 'Fun',
  reactions: { start: '💬', success: '🤗' },

  async execute(sock, m, { reply }) {
    try {
      await sock.sendPresenceUpdate('composing', m.chat);

      const response = await fetch(
        'https://shizoapi.onrender.com/api/memes/cheems?apikey=shizo',
      );

      if (!response.ok) throw new Error('Meme API request failed');

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('image')) throw new Error('Invalid meme media');

      const image = Buffer.from(await response.arrayBuffer());

      await sock.sendMessage(
        m.chat,
        {
          image,
          caption:
            '╭─❍ *CODEX MEME*\n│\n│ 🐕 Cheems meme loaded\n╰──────────────────',
        },
        { quoted: m },
      );

      await sock.sendPresenceUpdate('paused', m.chat);
    } catch (error) {
      console.error('[meme]', error.message);
      await reply('❌ Failed to fetch a meme right now.');
    }
  },
};

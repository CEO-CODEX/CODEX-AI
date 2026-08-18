const { downloadContentFromMessage, getContentType } = require('../../lib/baileys');
const { imageToWebp, videoToWebp, addExif } = require('../../library/exif');

module.exports = {
  name: 'sprem',
  aliases: ['stickerprem', 'spremium'],
  category: 'general',
    reactions: { start: '🔎', success: '📌' },
  description: 'Convert a replied image, video, or sticker into a premium sticker',

  async execute(bot, m) {
    let mediaMsg;
    let mediaType;
    const quoted = m.quoted;

    if (quoted?.message) {
      mediaType = getContentType(quoted.message);
      mediaMsg = quoted.message?.[mediaType];
    } else if (['imageMessage', 'videoMessage', 'stickerMessage'].includes(m.type)) {
      mediaType = m.type;
      mediaMsg = m.msg;
    }

    if (!mediaMsg || !mediaType) return m.reply('Reply to an image, video, or sticker.');

    try {
      const mediaCategory = mediaType === 'videoMessage' ? 'video' : mediaType === 'stickerMessage' ? 'sticker' : 'image';
      const stream = await downloadContentFromMessage(mediaMsg, mediaCategory);
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const input = Buffer.concat(chunks);
      if (!input.length) return m.reply('Download failed. Try again.');

      const packname = bot.config.STICKER_PACKNAME || 'CODEX AI';
      const author = bot.config.STICKER_AUTHOR || 'CODEX';
      const converted = mediaType === 'imageMessage'
        ? await imageToWebp(input)
        : mediaType === 'videoMessage'
          ? await videoToWebp(input)
          : input;
      const sticker = await addExif(converted, packname, author, ['']);

      await bot.sock.sendMessage(m.chat, { sticker, premium: 1 }, { quoted: m.key ? { key: m.key, message: m.message } : undefined });
    } catch (error) {
      await m.reply(`Failed: ${error.message}`);
    }
  },
};

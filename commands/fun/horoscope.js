const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

const SIGN_EMOJIS = {
  aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋',
  leo: '♌', virgo: '♍', libra: '♎', scorpio: '♏',
  sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓',
};

module.exports = {
  name: 'horoscope',
  aliases: ['zodiac', 'starsign', 'astrology'],
  description: 'Get a daily horoscope for a zodiac sign',
  category: 'Fun',
  usage: 'horoscope <sign>',
  reactions: { start: '⭐', success: '👽', error: '🏗️' },

  async execute(sock, m, { args, reply, prefix }) {
    const sign = args[0]?.toLowerCase();

    if (!sign || !SIGNS.includes(sign)) {
      return reply(
        ` *HOROSCOPE*\n\n` +
          ` Usage: ${prefix}horoscope <sign>\n` +
          ` Signs: ${SIGNS.join(', ')}\n` +
          ``,
      );
    }

    try {
      const response = await fetch(
        `https://aztro.sameerkumar.website/?sign=${encodeURIComponent(sign)}&day=today`,
        { method: 'POST' },
      );
      const data = await response.json();

      await reply(
        ` *${SIGN_EMOJIS[sign]} ${sign.toUpperCase()}*\n\n` +
          ` 📅 ${data.current_date || 'Today'}\n` +
          ` 📝 ${data.description || 'No reading available.'}\n\n` +
          ` 💖 Compatibility: ${data.compatibility || 'Unknown'}\n` +
          ` 🎨 Color: ${data.color || 'Unknown'}\n` +
          ` 🔢 Lucky number: ${data.lucky_number || 'Unknown'}\n` +
          ``,
      );
    } catch {
      await reply('✘ Failed to get the horoscope right now.');
    }
  },
};

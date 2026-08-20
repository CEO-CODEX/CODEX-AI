module.exports = {
  name: 'joke',
  aliases: ['jokes', 'tellmeajoke'],
  description: 'Get a random joke',
  category: 'Fun',
  reactions: { start: '🤣', success: '😂' },

  async execute(sock, m, { args, reply }) {
    const categories = ['Any', 'Programming', 'Misc', 'Pun', 'Spooky', 'Christmas'];
    const requested = args[0]?.toLowerCase();
    const category = categories.find((item) => item.toLowerCase() === requested) || 'Any';
    const language = ['en', 'es', 'fr', 'de', 'pt', 'cs', 'fi'].includes(args[1]?.toLowerCase()) ? args[1].toLowerCase() : 'en';
    const url = `https://v2.jokeapi.dev/joke/${category}?lang=${language}&safe-mode&blacklistFlags=nsfw,religious,political`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.error) return reply('ಠ_ಠ No joke found.');
      const joke = data.type === 'single' ? data.joke : `*${data.setup}*\n\n${data.delivery}`;
      await reply(`🤣 *JOKE*\n\n${joke}`);
    } catch {
      await reply('🤣 The joke service is taking a break. Try again.');
    }
  },
};

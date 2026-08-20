module.exports = {
  name: 'jok',
  aliases: ['funjoke', 'randomjoke'],
  description: 'Fetch a random programming joke',
  category: 'Fun',
  usage: 'jok',

  async execute(sock, m, { reply }) {
    try {
      const response = await fetch(
        'https://v2.jokeapi.dev/joke/Programming?type=single&safe-mode',
      );
      const data = await response.json();
      if (!data?.joke) return reply('❔ Could not fetch a programming joke.');
      return reply(`⚉ Here is a random programming joke:\n\n${data.joke}`);
    } catch (error) {
      console.error('[jok]', error.message);
      return reply('✘ Failed to fetch a programming joke. Try again later.');
    }
  },
};

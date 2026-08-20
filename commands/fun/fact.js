const FALLBACK_FACTS = [
  'A day on Venus is longer than a year on Venus.',
  'Octopuses have three hearts and blue blood.',
  'Bananas are berries, but strawberries are not.',
  'The Eiffel Tower grows in summer because of heat expansion.',
  'Wombat poop is cube-shaped.',
  'Honey can remain edible for thousands of years.',
];

module.exports = {
  name: 'fact',
  aliases: ['facts', 'randomfact', 'didyouknow'],
  description: 'Get a random interesting fact',
  category: 'Fun',
  usage: 'fact',
  reactions: { start: '🧠', success: '✨', error: '❔' },

  async execute(sock, m, { reply }) {
    await sock.sendMessage(m.chat, { react: { text: '🧠', key: m.key } });

    let fact = null;
    let source = 'CODEX knowledge base';

    try {
      const response = await fetch(
        'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en',
      );
      if (response.ok) {
        const data = await response.json();
        fact = data.text;
        source = 'UselessFacts API';
      }
    } catch {}

    fact ??= FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];

    await reply(
      `╭─❍ *RANDOM FACT*\n│\n` +
        `│ 💡 ${fact}\n│\n` +
        `│ 📡 Source: ${source}\n` +
        `╰──────────────────`,
    );

    await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
  },
};

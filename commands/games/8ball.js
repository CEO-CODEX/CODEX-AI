const ANSWERS = [
  'Yes, definitely!',
  'It is certain.',
  'Without a doubt.',
  'Yes, absolutely.',
  'You may rely on it.',
  'As I see it, yes.',
  'Most likely.',
  'Outlook good.',
  'Signs point to yes.',
  'Reply hazy, try again.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  'Concentrate and ask again.',
  "Don't count on it.",
  'My reply is no.',
  'My sources say no.',
  'Very doubtful.',
];

module.exports = {
  name: '8ball',
  aliases: ['magic8', 'fortune'],
  description: 'Ask the Magic 8-Ball a question',
  category: 'Games',
  usage: '8ball <question>',
  reactions: { start: '🎱', success: '🎭' },

  async execute(sock, m, { args, reply, prefix }) {
    const question = args.join(' ').trim();

    if (!question) {
      return reply(
        `╭─❍ *MAGIC 8-BALL*\n│\n` +
          `│ ⚉ Usage: ${prefix}8ball <question>\n│\n` +
          `│ Example: ${prefix}8ball Will I be rich?\n` +
          `╰──────────────────`,
      );
    }

    await sock.sendMessage(m.chat, {
      react: { text: '🎱', key: m.key },
    });

    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];

    await reply(
      `╭─❍ *MAGIC 8-BALL*\n│\n` +
        `│ ❓ Question: ${question}\n│\n` +
        `│ 🔮 Answer: *${answer}*\n` +
        `╰──────────────────`,
    );

    await sock.sendMessage(m.chat, {
      react: { text: '🎭', key: m.key },
    });
  },
};

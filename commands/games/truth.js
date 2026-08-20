const TRUTHS = [
  'What is your biggest fear?',
  'What is your most embarrassing moment?',
  'Have you ever lied to your best friend?',
  'What is your guilty pleasure?',
  'What is the last lie you told?',
  'Have you ever cheated on a test?',
  'What is your biggest regret?',
  'Who was your first crush?',
  'Have you ever stolen anything?',
  'What is your secret talent?',
  "What is the weirdest dream you've had?",
  'Have you ever ghosted someone?',
  "What is the craziest thing you've done?",
  'Who do you secretly dislike?',
  "What is the biggest mistake you've made?",
];

module.exports = {
  name: 'truth',
  aliases: ['truths', 'telltruth'],
  description: 'Get a random truth question',
  category: 'Games',
  usage: 'truth',
  reactions: { start: '😳', success: '🎭' },

  async execute(sock, m, { reply }) {

    const truth = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];

    await reply(
      ` *TRUTH*\n\n` +
        ` 😳 Question: ${truth}\n\n` +
        ` 💬 Reply: Answer honestly!\n` +
        ``,
    );
  },
};

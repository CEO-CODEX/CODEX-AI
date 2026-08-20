const STATEMENTS = [
  'Skipped school or work.',
  'Eaten an entire pizza alone.',
  'Slept through an alarm.',
  'Sung karaoke in public.',
  'Fallen asleep in a movie theater.',
  'Stayed up all night gaming.',
  "Forgot someone's birthday.",
  'Laughed until I cried.',
  'Tried to cook and failed badly.',
  'Said "I love you" first.',
  'Won a contest or competition.',
  'Lost my phone and found it.',
  'Ate something expired.',
  'Cried watching a movie.',
  'Danced in the rain.',
  'Made a viral video.',
];

module.exports = {
  name: 'neverhaveiever',
  aliases: ['nhie', 'never'],
  description: 'Play Never Have I Ever',
  category: 'Games',
  usage: 'nhie',
  reactions: { start: '🙈', success: '👍' },

  async execute(sock, m, { reply }) {
    const statement = STATEMENTS[Math.floor(Math.random() * STATEMENTS.length)];
    await reply(
      ` *NEVER HAVE I EVER*\n\n` +
        ` 🙈 Never have I ever... ${statement}\n\n` +
        ` ✅ If you have: React 👍\n` +
        ` ❌ If you have not: React 👎\n` +
        ``,
    );
  },
};

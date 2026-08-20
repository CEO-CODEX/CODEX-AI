const DARES = [
  'Send a voice note singing your favorite song.',
  'Text your crush: "I had a dream about you."',
  'Post "I love CODEX AI" as your status.',
  'Send a selfie making a funny face.',
  'Call someone and say, "I just called to say I love you."',
  'Do 10 push-ups right now.',
  'Send a voice note imitating a celebrity.',
  'Change your group name to "CODEX Fan Club" for one hour.',
  'Send a message using only emojis for the next five minutes.',
  'Take a photo of your shoe and post it as your profile picture.',
  'Say "I am the greatest" out loud three times.',
  'Send a voice note telling a joke.',
  'Do your best robot dance and describe it in text.',
  'Type the alphabet backwards in the chat.',
  'Message the last person you DM\'d: "You\'re awesome!"',
];

module.exports = {
  name: 'dare',
  aliases: ['dares', 'dodare'],
  description: 'Get a random dare challenge',
  category: 'Games',
  usage: 'dare',
  reactions: { start: '😈', success: '🎭' },

  async execute(sock, m, { reply }) {
    await sock.sendMessage(m.chat, {
      react: { text: '😈', key: m.key },
    });

    const dare = DARES[Math.floor(Math.random() * DARES.length)];

    await reply(
      `╭─❍ *DARE*\n│\n` +
        `│ 😈 Challenge: ${dare}\n│\n` +
        `│ ✅ Done? React 👍\n` +
        `│ ❌ Skipped? React 👎\n` +
        `╰──────────────────`,
    );

    await sock.sendMessage(m.chat, {
      react: { text: '😈', key: m.key },
    });
  },
};

module.exports = {
  name: 'hint',
  aliases: ['answer', 'reveal'],
  description: 'Reveal the answer for an active game',
  category: 'Games',
  usage: 'hint',
  reactions: { start: '💡', success: '🎭' },

  async execute(sock, m, { reply }) {
    let answer;
    let game;

    if (global.triviaAnswers?.[m.chat]) {
      answer = global.triviaAnswers[m.chat];
      game = 'Trivia';
      delete global.triviaAnswers[m.chat];
    } else if (global.riddleAnswers?.[m.chat]) {
      answer = global.riddleAnswers[m.chat];
      game = 'Riddle';
      delete global.riddleAnswers[m.chat];
    } else if (global.anagramAnswers?.[m.chat]) {
      answer = global.anagramAnswers[m.chat];
      game = 'Anagram';
      delete global.anagramAnswers[m.chat];
    }

    if (!answer) {
      return reply('✘ No active game. Play trivia, riddle, or anagram first.');
    }

    await reply(
      ` *${game.toUpperCase()} ANSWER*\n\n` +
        ` ✅ Answer: *${answer}*\n` +
        ``,
    );
  },
};

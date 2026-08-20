const WORD_LIST = [
  'apple', 'brave', 'crane', 'dance', 'eagle', 'flame', 'grape', 'heart',
  'igloo', 'jewel', 'lemon', 'mango', 'noble', 'ocean', 'piano', 'queen',
  'river', 'stone', 'tiger', 'ultra', 'vivid', 'waste', 'xenon', 'youth',
  'zebra', 'cloud', 'dream', 'earth', 'frost', 'ghost', 'honey', 'laser',
  'moon', 'north', 'olive', 'pearl', 'quick', 'robot', 'sugar', 'table',
  'uncle', 'voice', 'water', 'beach', 'candy', 'daisy', 'early', 'fairy',
  'glass', 'house', 'juice', 'koala', 'light', 'music', 'night',
];

function checkWord(guess, answer) {
  const result = [];
  const answerLetters = answer.split('');
  const used = new Array(answer.length).fill(false);

  for (let i = 0; i < 5; i += 1) {
    if (guess[i] === answerLetters[i]) {
      result[i] = '🟢';
      used[i] = true;
    }
  }

  for (let i = 0; i < 5; i += 1) {
    if (result[i]) continue;

    const index = answerLetters.findIndex(
      (letter, position) => !used[position] && letter === guess[i],
    );

    if (index >= 0) {
      result[i] = '🟡';
      used[index] = true;
    } else {
      result[i] = '⬜';
    }
  }

  return result.join('');
}

module.exports = {
  name: 'wordle',
  aliases: ['guessword', 'wordgame'],
  description: 'Guess the five-letter word in six tries',
  category: 'Games',
  usage: 'wordle [start|guess]',
  reactions: { start: '🎮', success: '🎉', error: '😢' },

  async execute(sock, m, { args, reply, prefix }) {
    if (!global.wordleGames) global.wordleGames = {};

    const sub = args[0]?.toLowerCase();
    const game = global.wordleGames[m.chat];

    if (!sub || sub === 'start') {
      global.wordleGames[m.chat] = {
        word: WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)],
        guesses: [],
        maxGuesses: 6,
      };

      await sock.sendMessage(m.chat, {
        react: { text: '🎮', key: m.key },
      });

      return reply(
        `╭─❍ *WORDLE*\n│\n` +
          `│ 🎯 Guess the word in six tries.\n` +
          `│ 🟢 Correct spot\n│ 🟡 Wrong spot\n│ ⬜ Not in word\n│\n` +
          `│ Usage: ${prefix}wordle <five-letter-word>\n` +
          `╰──────────────────`,
      );
    }

    if (!game) {
      return reply(`🎮 No active game. Use ${prefix}wordle start first.`);
    }

    const guess = sub.trim();
    if (!/^[a-z]{5}$/.test(guess)) {
      return reply('✘ Your guess must contain exactly five letters.');
    }

    game.guesses.push(guess);
    const won = guess === game.word;
    const lost = !won && game.guesses.length >= game.maxGuesses;
    const board = game.guesses
      .map((item) => checkWord(item, game.word))
      .concat(Array(game.maxGuesses - game.guesses.length).fill('⬜⬜⬜⬜⬜'))
      .join('\n');

    await reply(
      `╭─❍ *WORDLE*\n│ Attempt ${game.guesses.length}/${game.maxGuesses}\n│\n` +
        `${board}\n│\n` +
        `│ ${won ? '🎉 You win!' : lost ? `😢 The word was ${game.word.toUpperCase()}.` : `${game.maxGuesses - game.guesses.length} attempts left.`}\n` +
        `╰──────────────────`,
    );

    if (won || lost) delete global.wordleGames[m.chat];

    await sock.sendMessage(m.chat, {
      react: { text: won ? '🎉' : lost ? '😢' : '👌', key: m.key },
    });
  },
};

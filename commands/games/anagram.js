const WORDS = [
  'listen', 'triangle', 'funeral', 'dormitory', 'the eyes',
  'debit card', 'astronomer', 'the classroom', 'election results',
  'silent', 'integral', 'real fun', 'dirty room', 'they see',
  'bad credit', 'moon starer', 'schoolmaster', "lies let's recount",
];

function shuffleWord(word) {
  const letters = word.replace(/[^a-z]/gi, '').split('');
  for (let index = letters.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1));
    [letters[index], letters[random]] = [letters[random], letters[index]];
  }
  return letters.join('');
}

module.exports = {
  name: 'anagram',
  aliases: ['scramble', 'unscramble', 'wordmix'],
  description: 'Guess the original word from scrambled letters',
  category: 'Games',
  usage: 'anagram',
  reactions: { start: '🔤', success: '🔖' },

  async execute(sock, m, { reply }) {
    const answer = WORDS[Math.floor(Math.random() * WORDS.length)];
    const scrambled = shuffleWord(answer);

    global.anagramAnswers ??= {};
    global.anagramAnswers[m.chat] = answer;

    await reply(
      ` *ANAGRAM CHALLENGE*\n\n` +
        ` 🔤 Scrambled: *${scrambled.toUpperCase()}*\n` +
        ` 📝 Letters: ${scrambled.length}\n` +
        ` 💡 Use .hint to reveal the answer.\n` +
        ``,
    );
  },
};

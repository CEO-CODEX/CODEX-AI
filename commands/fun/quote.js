const QUOTES = [
  'The only way to do great work is to love what you do. — Steve Jobs',
  'In the middle of difficulty lies opportunity. — Albert Einstein',
  'It does not matter how slowly you go as long as you do not stop. — Confucius',
  'Success is not final, failure is not fatal. — Winston Churchill',
  "Believe you can and you're halfway there. — Theodore Roosevelt",
];

module.exports = {
  name: 'quote',
  aliases: ['quotes', 'motivation'],
  description: 'Get a motivational quote',
  category: 'Fun',
  usage: 'quote',

  async execute(sock, m, { reply }) {
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    return reply(` *MOTIVATION*\n\n 💬 ${quote}\n`);
  },
};

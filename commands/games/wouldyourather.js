const QUESTIONS = [
  ['Know when you will die', 'Know how you will die', 'Know who will be with you'],
  ['Read minds', 'See the future', 'See ten seconds into the past'],
  ['Be famous but hated', 'Be unknown but loved', 'Be forgotten completely'],
  ['Lose all your memories', 'Lose the ability to make new ones', 'Lose the ability to dream'],
  ['Live 500 years alone', 'Live 50 years with loved ones', 'Live forever watching everyone leave'],
  ['Be the smartest person alive', 'Be the happiest person alive', 'Be the richest person alive'],
  ['Erase one regret', 'Relive one memory', 'Preview one future moment'],
  ['Never feel physical pain', 'Never feel emotional pain', 'Never feel fear'],
  ['Be 20% luckier', 'Be 20% smarter', 'Be 20% stronger'],
  ['Know every language', 'Know every skill', 'Know every secret'],
  ['Time travel to the past', 'Time travel to the future', 'Stop time for one hour daily'],
  ['Be a famous singer', 'Be a famous actor', 'Be a famous athlete'],
  ['Never be lied to', 'Never be betrayed', 'Never be forgotten'],
  ['Control fire', 'Control water', 'Control air'],
  ['Talk to animals', 'Talk to plants', 'Talk to machines'],
  ['Be able to fly', 'Be able to teleport', 'Be able to breathe underwater'],
  ['Always be right', 'Always be liked', 'Always be lucky'],
  ['Live in a castle', 'Live on a private island', 'Live in a spaceship'],
  ['Be a superhero', 'Be a wizard', 'Be a genius inventor'],
  ['Never need sleep', 'Never need food', 'Never need water'],
];

module.exports = {
  name: 'wouldyourather',
  aliases: ['wyr', 'rather'],
  description: 'Would You Rather questions',
  category: 'Games',
  usage: 'wyr',
  reactions: { start: '🤔', success: '🎭' },

  async execute(sock, m) {
    const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    await sock.sendMessage(m.chat, {
      poll: {
        name: '🎯 Would You Rather',
        values: [`🅰️ ${question[0]}`, `🅱️ ${question[1]}`, `🅲️ ${question[2]}`],
        selectableCount: 1,
      },
    });
  },
};

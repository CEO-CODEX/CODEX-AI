const BLOCKS = {
  A: ['  A  ', ' A A ', 'AAAAA', 'A   A', 'A   A'],
  B: ['BBBB ', 'B   B', 'BBBB ', 'B   B', 'BBBB '],
  C: [' CCC ', 'C    ', 'C    ', 'C    ', ' CCC '],
  D: ['DDDD ', 'D   D', 'D   D', 'D   D', 'DDDD '],
  E: ['EEEEE', 'E    ', 'EEE  ', 'E    ', 'EEEEE'],
  F: ['FFFFF', 'F    ', 'FFF  ', 'F    ', 'F    '],
  G: [' GGG ', 'G    ', 'G GG ', 'G  G ', ' GGG '],
  H: ['H   H', 'H   H', 'HHHHH', 'H   H', 'H   H'],
  I: ['IIIII', '  I  ', '  I  ', '  I  ', 'IIIII'],
  J: ['JJJJJ', '  J  ', '  J  ', 'J J  ', ' JJ  '],
  K: ['K  K ', 'K K  ', 'KK   ', 'K K  ', 'K  K '],
  L: ['L    ', 'L    ', 'L    ', 'L    ', 'LLLLL'],
  M: ['M   M', 'MM MM', 'M M M', 'M   M', 'M   M'],
  N: ['N   N', 'NN  N', 'N N N', 'N  NN', 'N   N'],
  O: [' OOO ', 'O   O', 'O   O', 'O   O', ' OOO '],
  P: ['PPPP ', 'P   P', 'PPPP ', 'P    ', 'P    '],
  Q: [' QQQ ', 'Q   Q', 'Q Q Q', 'Q  Q ', ' QQ Q'],
  R: ['RRRR ', 'R   R', 'RRRR ', 'R R  ', 'R  RR'],
  S: [' SSSS', 'S    ', ' SSS ', '    S', 'SSSS '],
  T: ['TTTTT', '  T  ', '  T  ', '  T  ', '  T  '],
  U: ['U   U', 'U   U', 'U   U', 'U   U', ' UUU '],
  V: ['V   V', 'V   V', 'V   V', ' V V ', '  V  '],
  W: ['W   W', 'W   W', 'W W W', 'WW WW', 'W   W'],
  X: ['X   X', ' X X ', '  X  ', ' X X ', 'X   X'],
  Y: ['Y   Y', ' Y Y ', '  Y  ', '  Y  ', '  Y  '],
  Z: ['ZZZZZ', '   Z ', '  Z  ', ' Z   ', 'ZZZZZ'],
};

module.exports = {
  name: 'ascii',
  aliases: ['bigtext'],
  description: 'Convert text into ASCII art',
  category: 'Fun',
  usage: 'ascii <text>',

  async execute(sock, m, { args, reply, prefix }) {
    const text = args.join(' ').trim().toUpperCase();
    if (!text) return reply(`Usage: ${prefix}ascii <text>`);

    const lines = Array.from({ length: 5 }, () => '');
    for (const character of text) {
      const glyph = BLOCKS[character] || ['     ', '     ', '     ', '     ', '     '];
      for (let index = 0; index < 5; index += 1) lines[index] += `${glyph[index]} `;
    }

    return reply(`\`\`\`\n${lines.join('\n')}\n\`\`\``);
  },
};

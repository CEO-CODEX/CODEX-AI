const games = new Map();

function createBoard() {
  return ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
}

function winner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] === board[b] && board[b] === board[c]) return board[a];
  }
  return null;
}

function draw(board) {
  return board.every((cell) => cell === '❌' || cell === '⭕');
}

function render(board) {
  return `${board.slice(0, 3).join('  ')}\n${board.slice(3, 6).join('  ')}\n${board.slice(6).join('  ')}`;
}

async function play(sock, m, game, position, reply) {
  if (m.sender !== game.current) return reply('✘ It is not your turn.');
  if (!Number.isInteger(position) || position < 1 || position > 9) return reply('✘ Choose a position from 1 to 9.');

  const index = position - 1;
  if (game.board[index] === '❌' || game.board[index] === '⭕') return reply('✘ That spot is already taken.');

  game.board[index] = m.sender === game.x ? '❌' : '⭕';
  const winningMark = winner(game.board);
  const isDraw = !winningMark && draw(game.board);
  game.current = game.current === game.x ? game.o : game.x;

  const status = winningMark
    ? `🎉 ${winningMark === '❌' ? '@' + game.x.split('@')[0] : '@' + game.o.split('@')[0]} wins!`
    : isDraw
      ? '🤝 Draw!'
      : `⏳ @${game.current.split('@')[0]}\'s turn`;
  await sock.sendMessage(m.chat, {
    text: `🎮 *TIC-TAC-TOE*\n\n${render(game.board)}\n\n${status}`,
    mentions: [game.x, game.o],
  }, { quoted: m });

  if (winningMark || isDraw) games.delete(m.chat);
}

module.exports = {
  name: 'ttt',
  aliases: ['tictactoe', 'xo'],
  description: 'Play Tic-Tac-Toe with a friend',
  category: 'Games',
  usage: 'ttt start @user | ttt 1-9 | ttt stop',
  reactions: { start: '🎮', success: '🎭' },

  async execute(sock, m, { args, reply }) {
    const sub = args[0]?.toLowerCase();

    if (!sub) return reply('🎮 Use .ttt start @user, .ttt 1-9, or .ttt stop.');

    if (sub === 'stop') {
      if (!games.delete(m.chat)) return reply('✘ No active game.');
      return reply('🛑 Game stopped.');
    }

    if (sub === 'start') {
      if (games.has(m.chat)) return reply('✘ A game is already active.');
      const opponent = m.mentionedJid?.[0] || m.quoted?.sender;
      if (!opponent) return reply('✘ Tag the person you want to play with.');
      if (opponent === m.sender) return reply('✘ You cannot play against yourself.');

      const first = Math.random() < 0.5 ? m.sender : opponent;
      const game = { board: createBoard(), x: first, o: first === m.sender ? opponent : m.sender, current: first };
      games.set(m.chat, game);
      return sock.sendMessage(m.chat, {
        text: `🎮 *TIC-TAC-TOE STARTED*\n\n${render(game.board)}\n\nFirst turn: @${first.split('@')[0]}`,
        mentions: [m.sender, opponent],
      }, { quoted: m });
    }

    const game = games.get(m.chat);
    if (!game) return reply('✘ No active game. Use .ttt start @user.');
    return play(sock, m, game, Number(sub), reply);
  },
};

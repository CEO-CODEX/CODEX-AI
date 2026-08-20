const { getTarget } = require('../../lib/getTarget');
const muteStore = require('../../lib/muteStore');
const { parseTime, humanize, schedule, cancelAll } = require('../../lib/mute-core');

module.exports = {
  name: 'mutestickeruser',
  aliases: ['sticker-mute', 'stickeronlymute'],
  category: 'admin',
  reactions: { start: '🖼️' },
  description: 'Block all stickers from one member while allowing their other messages.',
  adminOnly: true,
  groupOnly: true,

  async execute(bot, m, args) {
    const target = getTarget(m);
    if (!target) {
      return m.reply(`Reply to a message or tag a user.\n${bot.prefix}mutestickeruser @user [1h] [after 2h]`);
    }

    const key = muteStore._keyOf(target);
    const joined = args.filter((arg) => !arg.startsWith('@')).join(' ');
    const delayed = /\bafter\b/i.test(joined);
    const timeText = joined.replace(/\bafter\b/i, '').trim();
    const duration = timeText ? parseTime(timeText) : null;

    if (timeText && !duration) {
      return m.reply('Bad duration. Use: 10m, 1h, 6h, 1d, or 7d.');
    }

    if (delayed && duration) {
      cancelAll({ chat: m.chat, target: key });
      schedule({
        type: 'muteStickerUser',
        chat: m.chat,
        target: key,
        expiresAt: Date.now() + duration,
        mutedBy: m.sender,
      });
      return m.reply(`@${target.split('@')[0]}'s stickers will be blocked in ${humanize(duration)}.`, {
        mentions: [target],
      });
    }

    const existing = muteStore.getMute(target);
    if (existing?.stickersOnly) {
      return m.reply(`@${target.split('@')[0]}'s stickers are already blocked.`, { mentions: [target] });
    }

    muteStore.setMute(target, {
      stickersOnly: true,
      mutedBy: m.sender,
      chat: m.chat,
      mutedAt: Date.now(),
    });

    if (duration) {
      cancelAll({ chat: m.chat, target: key });
      schedule({
        type: 'unmuteStickerUser',
        chat: m.chat,
        target: key,
        expiresAt: Date.now() + duration,
        mutedBy: m.sender,
      });
      return bot.sendMessage(m.chat, {
        text: `@${target.split('@')[0]}'s stickers are blocked for ${humanize(duration)}.`,
        mentions: [target],
      });
    }

    return bot.sendMessage(m.chat, {
      text: `@${target.split('@')[0]}'s stickers are now blocked.`,
      mentions: [target],
    });
  },
};

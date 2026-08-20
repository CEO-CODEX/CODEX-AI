const { getTarget } = require('../../lib/getTarget');
const muteStore = require('../../lib/muteStore');
const { cancel } = require('../../lib/mute-core');

module.exports = {
  name: 'unmutestickeruser',
  aliases: ['unsticker-mute', 'stickeronlyunmute'],
  category: 'admin',
  reactions: { start: '🖼️' },
  description: 'Allow a member to send stickers again.',
  adminOnly: true,
  groupOnly: true,

  async execute(bot, m) {
    const target = getTarget(m);
    if (!target) {
      return m.reply(`Reply to a message or tag a user.\n${bot.prefix}unmutestickeruser @user`);
    }

    const key = muteStore._keyOf(target);
    const existing = muteStore.getMute(target);
    if (!existing?.stickersOnly) {
      return m.reply(`@${key.split('@')[0]} does not have a sticker-only mute.`, {
        mentions: [target],
      });
    }

    muteStore.clearMute(target);
    cancel({ type: 'unmuteStickerUser', chat: m.chat, target: key });
    cancel({ type: 'muteStickerUser', chat: m.chat, target: key });

    return bot.sendMessage(m.chat, {
      text: `@${key.split('@')[0]} can send stickers again.`,
      mentions: [target],
    });
  },
};

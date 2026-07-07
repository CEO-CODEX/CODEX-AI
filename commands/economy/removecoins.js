const { jidNormalizedUser } = require('../../lib/baileys');
function _isOwner(sender, bot) {
    return bot.permission.isOwner(sender);
}
function _isMod(sender, bot) {
    if (_isOwner(sender, bot)) return true;
    const sp = sender.split('@')[0].replace(/[^0-9]/g, '');
    return (bot.config.mods || []).some(m => {
        const mp = m.replace(/[^0-9]/g, '');
        return mp && (sp === mp || sp.endsWith(mp) || mp.endsWith(sp));
    });
}
const { getTarget } = require('../../lib/getTarget');
const { loadDB, saveDB, getUser, fmt, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'removecoins',
    aliases: ['takecoins'],
    category: 'economy',
    description: '[OWNER] Remove coins from a user. Usage: .removecoins @user <amount>',

    async execute(bot, m, args) {
        if (!_isOwner(m.sender, bot) && !_isMod(m.sender, bot))
            return await m.reply(`❌ Owner/mod only.`);

        const targetJid = getTarget(m);
        const amount    = parseInt(args[1] || args[0]);
        if (!targetJid || !amount || amount < 1) return await m.reply(`Usage: *.removecoins @user <amount>*`);

        const db = loadDB();
        const target = getUser(db, targetJid);
        target.wallet = Math.max(0, target.wallet - amount);
        saveDB(db);
        await m.reply(`✅ Removed *${fmt(amount)}* ${CURRENCY} from @${targetJid.split('@')[0]}\nNew balance: *${fmt(target.wallet)}* ${CURRENCY}`);
    }
};

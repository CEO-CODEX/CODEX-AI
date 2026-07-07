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
const { loadDB, saveDB, getUser } = require('../../lib/economyEngine');

module.exports = {
    name: 'setlevel',
    category: 'economy',
    description: '[OWNER] Set a user\'s level. Usage: .setlevel @user <level>',

    async execute(bot, m, args) {
        if (!_isOwner(m.sender, bot))
            return await m.reply(`❌ Owner only.`);

        const targetJid = getTarget(m);
        const level     = parseInt(args[1] || args[0]);
        if (!targetJid || isNaN(level) || level < 0) return await m.reply(`Usage: *.setlevel @user <level>*`);

        const db = loadDB();
        const target = getUser(db, targetJid);
        target.level = level;
        saveDB(db);
        await m.reply(`✅ Set @${targetJid.split('@')[0]}'s level to *${level}*`);
    }
};

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
const fs = require('fs-extra');

module.exports = {
    name: 'reseteconomy',
    aliases: ['ecoreset'],
    category: 'economy',
    description: '[OWNER] Wipe ALL economy data. Irreversible!',

    async execute(bot, m, args) {
        if (!_isOwner(m.sender, bot))
            return await m.reply(`❌ Owner only.`);

        const confirm = (args[0] || '').toLowerCase();
        if (confirm !== 'confirm')
            return await m.reply(`⚠️ *DANGER!* This wipes ALL economy data.\n\nType: *.reseteconomy confirm* to proceed.`);

        fs.ensureDirSync('./database');
        fs.writeFileSync('./database/economy.json', '{}');
        try { fs.writeFileSync('./database/blackjack_sessions.json', '{}'); } catch {}
        await m.reply(`🗑️ *ECONOMY RESET COMPLETE!*\nAll economy data has been wiped.`);
    }
};

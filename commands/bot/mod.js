const { getTarget, resolveTargets } = require('../../lib/getTarget');
const fs = require('fs-extra');

module.exports = {
    name: 'mod',
    category: 'bot',
    ownerOnly: true,
    description: 'Add or remove mod users (mods can use ALL commands, including owner commands)',

    async execute(bot, m, args) {
        const action = args[0]?.toLowerCase();

        if (!action || !['add', 'remove', 'list'].includes(action)) return await m.reply(
`mod manager
Mods can use ALL commands, even owner-only ones.

Usage:
${bot.prefix}mod add @user
${bot.prefix}mod remove @user
${bot.prefix}mod list`);

        if (!Array.isArray(bot.config.mods)) bot.config.mods = [];

        if (action === 'list') {
            const mods = bot.config.mods;
            if (mods.length === 0) return await m.reply('No mods set.');
            let text = 'Mod users:\n';
            mods.forEach((id, i) => { text += `${i + 1}. @${id.split('@')[0]}\n`; });
            return await m.reply(text.trim(), { mentions: mods });
        }

        // Resolve every JID form (phone + lid) so permission checks always match
        const forms = await resolveTargets(bot, m);
        const primary = getTarget(m);
        if (!forms.length) return await m.reply('Tag a user or reply to their message.');

        if (action === 'add') {
            let added = false;
            for (const jid of forms) {
                if (!bot.config.mods.includes(jid)) { bot.config.mods.push(jid); added = true; }
            }
            fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
            return await m.reply(
                added
                    ? `@${primary.split('@')[0]} is now a mod. They can use every command.`
                    : `@${primary.split('@')[0]} is already a mod.`,
                { mentions: [primary] }
            );
        }

        if (action === 'remove') {
            // Remove every matching form by comparing the last 10 digits
            const tails = forms.map(j => j.split('@')[0].replace(/[^0-9]/g, '').slice(-10));
            bot.config.mods = bot.config.mods.filter(id => {
                const t = id.split('@')[0].replace(/[^0-9]/g, '').slice(-10);
                return !tails.includes(t) && !forms.includes(id);
            });
            fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
            return await m.reply(`@${primary.split('@')[0]} removed from mods.`, { mentions: [primary] });
        }
    }
};

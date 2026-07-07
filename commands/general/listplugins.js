const { listPlugins } = require('../../lib/pluginManager');

module.exports = {
    name: 'listplugins',
    aliases: ['plugins', 'pluginlist'],
    category: 'general',
    description: 'Show all installed plugins',
    usage: '.listplugins',

    async execute(bot, m, args) {
        const plugins = listPlugins(bot);
        if (!plugins.length) {
            return await m.reply(`📦 No plugins installed.\n\nUse ${bot.prefix}install <link> to add one.`);
        }

        const text = plugins
            .map((cmd, i) => {
                const aliases = cmd.aliases || cmd.alias || [];
                const aliasList = (Array.isArray(aliases) ? aliases : [aliases]).filter(Boolean);
                const aliasStr = aliasList.length ? ` (${aliasList.map(a => bot.prefix + a).join(', ')})` : '';
                return `${i + 1}. ${bot.prefix}${cmd.name}${aliasStr}`;
            })
            .join('\n');

        return await m.reply(`📦 *Installed Plugins* (${plugins.length})\n\n${text}`);
    }
};

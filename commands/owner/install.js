const { saveAndLoad, listPlugins } = require('../../lib/pluginManager');

module.exports = {
    name: 'install',
    aliases: ['installplugin', 'plugin'],
    category: 'owner',
    description: 'Install an external command plugin from a GitHub Gist/raw link',
    ownerOnly: true,

    async execute(bot, m, args) {
        const sub = (args[0] || '').toLowerCase();

        if (!sub || sub === 'help') {
            return await m.reply(
                `Plugin installer\n\n` +
                `Usage:\n` +
                `${bot.prefix}install <plugin link>\n` +
                `${bot.prefix}install list\n\n` +
                `Supported links:\n` +
                `GitHub Gist, raw GitHub file, or github.com/.../blob/... JS file.`
            );
        }

        if (sub === 'list' || sub === 'ls') {
            const plugins = listPlugins(bot);
            if (!plugins.length) return await m.reply('No plugins installed.');
            const text = plugins
                .map((cmd, i) => `${i + 1}. ${bot.prefix}${cmd.name}`)
                .join('\n');
            return await m.reply(`Installed plugins:\n${text}\n\nTotal: ${plugins.length}`);
        }

        const link = args.join(' ').trim();
        await m.reply('Installing plugin...');

        try {
            const result = await saveAndLoad(bot, link);
            const aliases = result.command.aliases || result.command.alias || [];
            const aliasList = (Array.isArray(aliases) ? aliases : [aliases]).filter(Boolean);

            return await m.reply(
                `Plugin installed.\n\n` +
                `Command: ${bot.prefix}${result.command.name}\n` +
                `Aliases: ${aliasList.length ? aliasList.map(a => bot.prefix + a).join(', ') : 'none'}\n` +
                `File: plugins/${result.command.name}.js`
            );
        } catch (e) {
            return await m.reply(`Plugin install failed: ${e.message}`);
        }
    }
};

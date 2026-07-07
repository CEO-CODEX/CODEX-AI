const { removePlugin, listPlugins } = require('../../lib/pluginManager');

module.exports = {
    name: 'uninstall',
    aliases: ['remove', 'removeplugin', 'uninstallplugin', 'delplugin'],
    category: 'owner',
    description: 'Remove an installed external command plugin',
    ownerOnly: true,

    async execute(bot, m, args) {
        const name = args[0]?.toLowerCase();

        if (!name || name === 'list') {
            const plugins = listPlugins(bot);
            const list = plugins.length
                ? '\n\nInstalled:\n' + plugins.map((cmd, i) => `${i + 1}. ${bot.prefix}${cmd.name}`).join('\n')
                : '';
            return await m.reply(`Usage: ${bot.prefix}uninstall <command name>${list}`);
        }

        try {
            const command = await removePlugin(bot, name);
            if (!command) return await m.reply(`Plugin "${name}" is not installed.`);
            return await m.reply(`Plugin removed: ${bot.prefix}${command.name}`);
        } catch (e) {
            return await m.reply(`Plugin remove failed: ${e.message}`);
        }
    }
};

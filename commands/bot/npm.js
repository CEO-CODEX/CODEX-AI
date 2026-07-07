const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

module.exports = {
    name: 'npm',
    category: 'bot',
    description: 'Manage npm packages',

    async execute(bot, m, args) {
        if (args.length < 1) return await m.reply(
`npm manager
Usage:
${bot.prefix}npm install <package>
${bot.prefix}npm uninstall <package>
${bot.prefix}npm update [package]
${bot.prefix}npm list`);

        const action = args[0].toLowerCase();
        const packageName = args[1];
        await m.reply(`Running: npm ${action} ${packageName || ''}...`);

        try {
            let command;
            switch (action) {
                case 'install': case 'i':
                    if (!packageName) return await m.reply('Please specify a package name.');
                    command = `npm install ${packageName}`; break;
                case 'uninstall': case 'un': case 'remove': case 'r':
                    if (!packageName) return await m.reply('Please specify a package name.');
                    command = `npm uninstall ${packageName}`; break;
                case 'update': case 'up':
                    command = packageName ? `npm update ${packageName}` : 'npm update'; break;
                case 'list': case 'ls':
                    command = 'npm list --depth=0'; break;
                default:
                    return await m.reply(`Unknown action: ${action}`);
            }
            const { stdout, stderr } = await execPromise(command, { timeout: 120000 });
            let result = stdout || stderr || 'Command executed successfully';
            if (result.length > 4000) result = result.substring(0, 4000) + '\n\n... (truncated)';
            await m.reply(`Done:\n\`\`\`${result}\`\`\``);
        } catch (err) {
            await m.reply(`NPM error:\n\`\`\`${err.message}\`\`\``);
        }
    }
};

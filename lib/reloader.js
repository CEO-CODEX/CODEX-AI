const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class Reloader {
    constructor(bot) {
        this.bot = bot;
        this.commandsDir = path.join(__dirname, '../commands');
        this.lastLoadTime = Date.now();
    }

    async loadCommands() {
        return await this.bot.commandHandler.loadCommands();
    }

    async reload() {
        const startTime = Date.now();
        const oldCount = this.bot.commands.size;
        
        try {
            // Clear require cache for command files
            const categories = fs.readdirSync(this.commandsDir).filter(f => 
                fs.statSync(path.join(this.commandsDir, f)).isDirectory()
            );

            let cleared = 0;
            for (const category of categories) {
                const categoryPath = path.join(this.commandsDir, category);
                const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
                
                for (const file of files) {
                    const filePath = path.join(categoryPath, file);
                    if (require.cache[require.resolve(filePath)]) {
                        delete require.cache[require.resolve(filePath)];
                        cleared++;
                    }
                }
            }

            // Reload commands
            const result = await this.loadCommands();
            const newCount = this.bot.commands.size;
            const loadTime = Date.now() - startTime;

            if (result.loaded === 0 && oldCount === newCount) {
                return {
                    success: true,
                    status: 'idle',
                    message: '⚡ *System Idle*\n\nNo changes detected.',
                    oldCount,
                    newCount,
                    loadTime
                };
            }

            return {
                success: true,
                status: 'reloaded',
                message: `♻️ *System Reloaded Successfully!*\n\n` +
                        `📊 *Statistics:*\n` +
                        `• Total Commands: ${this.bot.totalCmds}\n` +
                        `• ✅ Successful: ${this.bot.successCmds}\n` +
                        `• ❌ Failed: ${this.bot.failedCmds}\n` +
                        `• ⏱️ Load Time: ${loadTime}ms\n\n` +
                        `🔄 Cache cleared: ${cleared} files`,
                oldCount,
                newCount,
                loadTime
            };

        } catch (err) {
            return {
                success: false,
                status: 'error',
                message: `❌ *Reload Failed*\n\nError: ${err.message}`,
                error: err.message
            };
        }
    }
}

module.exports = Reloader;

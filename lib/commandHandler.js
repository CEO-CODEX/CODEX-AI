/**
 * C☯︎DEX-AI — Command Handler
 * Single-pass loader: clears registry once, loads each file once.
 * Uses a flat Map registry so commands are never double-registered.
 */

const fs    = require('fs-extra');
const path  = require('path');
const chalk = require('chalk');

class CommandHandler {
    constructor(bot) {
        this.bot         = bot;
        this.commandsDir = path.join(__dirname, '../commands');
        this.pluginsDir  = path.join(__dirname, '../plugins');
    }

    async loadCommands() {
        // ── Clear registry ONCE before loading ────────────────────────────────
        this.bot.commands.clear();

        let loaded = 0;
        let failed = 0;

        const loadedFiles = new Set();   // guard against double-require of same resolved path

        const categories = fs.readdirSync(this.commandsDir)
            .filter(f => fs.statSync(path.join(this.commandsDir, f)).isDirectory());

        for (const category of categories) {
            const categoryPath = path.join(this.commandsDir, category);
            const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));

            for (const file of files) {
                try {
                    const filePath     = path.join(categoryPath, file);
                    const resolvedPath = require.resolve(filePath);

                    // Skip if we already loaded this exact file (symlink / duplicate)
                    if (loadedFiles.has(resolvedPath)) continue;
                    loadedFiles.add(resolvedPath);

                    // Always bust require cache so .reload works correctly
                    delete require.cache[resolvedPath];

                    const command = require(filePath);

                    if (command.name && command.execute) {
                        command.category = category;

                        // Register by primary name (never overwrite an existing entry)
                        if (!this.bot.commands.has(command.name.toLowerCase()))
                            this.bot.commands.set(command.name.toLowerCase(), command);

                        // Register aliases — support both `alias` and `aliases`
                        const aliasList = command.aliases || command.alias || [];
                        const aliases   = Array.isArray(aliasList) ? aliasList : [aliasList];
                        for (const alias of aliases) {
                            if (!alias) continue;
                            const key = String(alias).toLowerCase();
                            if (!this.bot.commands.has(key))
                                this.bot.commands.set(key, command);
                        }

                        loaded++;
                    }
                } catch (err) {
                    console.log(chalk.red(`[CMD ERROR] ${file}: ${err.message}`));
                    failed++;
                }
            }
        }

        const pluginResult = this.loadPlugins();
        loaded += pluginResult.loaded;
        failed += pluginResult.failed;

        console.log(chalk.green(`\n✅ Loaded ${loaded} commands`));
        if (failed > 0) console.log(chalk.red(`❌ Failed: ${failed} commands`));

        this.bot.totalCmds    = loaded + failed;
        this.bot.successCmds  = loaded;
        this.bot.failedCmds   = failed;

        return { loaded, failed };
    }

    loadPlugins() {
        fs.ensureDirSync(this.pluginsDir);

        let loaded = 0;
        let failed = 0;
        const files = fs.readdirSync(this.pluginsDir).filter(f => f.endsWith('.js'));

        for (const file of files) {
            try {
                const filePath = path.join(this.pluginsDir, file);
                const command = this.loadPluginFile(filePath);
                if (command) loaded++;
            } catch (err) {
                console.log(chalk.red(`[PLUGIN ERROR] ${file}: ${err.message}`));
                failed++;
            }
        }

        return { loaded, failed };
    }

    loadPluginFile(filePath) {
        const resolvedPath = require.resolve(filePath);
        delete require.cache[resolvedPath];

        const command = require(filePath);
        if (!command?.name || typeof command.execute !== 'function') {
            throw new Error('Plugin must export name and execute.');
        }

        command.category = command.category || 'plugin';
        command.__plugin = true;
        command.__pluginFile = resolvedPath;

        this.registerCommand(command, true);
        return command;
    }

    registerCommand(command, allowReplacePlugin = false) {
        const names = [command.name, ...(Array.isArray(command.aliases || command.alias)
            ? (command.aliases || command.alias)
            : [command.aliases || command.alias]
        )].filter(Boolean).map(n => String(n).toLowerCase());

        for (const name of names) {
            const existing = this.bot.commands.get(name);
            if (existing && (!allowReplacePlugin || !existing.__plugin)) {
                throw new Error(`Command "${name}" already exists.`);
            }
        }

        for (const name of names) {
            this.bot.commands.set(name, command);
        }
    }

    unloadPlugin(name) {
        const command = this.getCommand(name);
        if (!command?.__plugin) return null;

        for (const [key, cmd] of [...this.bot.commands.entries()]) {
            if (cmd === command) this.bot.commands.delete(key);
        }

        if (command.__pluginFile) {
            delete require.cache[command.__pluginFile];
        }

        return command;
    }

    getCommand(name) {
        return this.bot.commands.get(name?.toLowerCase());
    }

    getAllCommands() {
        const categories = {};
        for (const [name, cmd] of this.bot.commands) {
            if (!categories[cmd.category]) categories[cmd.category] = [];
            // Only list primary name entries, not alias duplicates
            if (cmd.name === name) categories[cmd.category].push(cmd);
        }
        return categories;
    }
}

module.exports = CommandHandler;

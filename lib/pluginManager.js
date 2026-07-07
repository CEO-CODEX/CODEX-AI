const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const ROOT = process.cwd();
const PLUGINS_DIR = path.join(ROOT, 'plugins');

function cleanName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
}

function pluginPath(name) {
    const clean = cleanName(name);
    if (!clean) throw new Error('Invalid plugin name.');
    return path.join(PLUGINS_DIR, `${clean}.js`);
}

function toRawUrl(input) {
    const url = String(input || '').trim();
    if (!/^https?:\/\//i.test(url)) throw new Error('Send a valid http(s) plugin link.');

    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Invalid plugin URL.'); }

    if (parsed.hostname === 'gist.github.com') {
        const parts = parsed.pathname.split('/').filter(Boolean);
        const gistId = parts[1] || parts[0];
        if (!gistId) throw new Error('Invalid GitHub Gist link.');
        return `https://gist.githubusercontent.com/${parts[0]}/${gistId}/raw`;
    }

    if (parsed.hostname === 'github.com') {
        const parts = parsed.pathname.split('/').filter(Boolean);
        const blob = parts.indexOf('blob');
        if (parts.length >= 5 && blob === 2) {
            const owner = parts[0];
            const repo = parts[1];
            const branch = parts[3];
            const file = parts.slice(4).join('/');
            return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`;
        }
    }

    return url;
}

async function fetchPluginCode(link) {
    const url = toRawUrl(link);
    const res = await axios.get(url, {
        timeout: 30000,
        responseType: 'text',
        transformResponse: [data => data],
        validateStatus: () => true
    });

    if (res.status < 200 || res.status >= 300) {
        throw new Error(`Fetch failed: HTTP ${res.status}`);
    }

    const code = String(res.data || '').trim();
    if (!code) throw new Error('Plugin link returned empty code.');
    if (!/module\.exports|exports\./.test(code)) {
        throw new Error('Plugin must export a command with module.exports.');
    }

    return { code, url };
}

async function saveAndLoad(bot, link) {
    const { code, url } = await fetchPluginCode(link);
    await fs.ensureDir(PLUGINS_DIR);

    const tempPath = path.join(PLUGINS_DIR, `.install-${Date.now()}.js`);
    await fs.writeFile(tempPath, code);

    let command;
    try {
        command = bot.commandHandler.loadPluginFile(tempPath);
        const finalPath = pluginPath(command.name);

        if (fs.existsSync(finalPath) && path.resolve(finalPath) !== path.resolve(tempPath)) {
            const existing = bot.commandHandler.getCommand(command.name);
            if (existing && !existing.__plugin) {
                throw new Error(`Command "${command.name}" already exists as a built-in command.`);
            }
            bot.commandHandler.unloadPlugin(command.name);
        }

        await fs.move(tempPath, finalPath, { overwrite: true });
        bot.commandHandler.unloadPlugin(command.name);
        command = bot.commandHandler.loadPluginFile(finalPath);
        command.source = url;

        return { command, file: finalPath, source: url };
    } catch (e) {
        try {
            if (command?.name) bot.commandHandler.unloadPlugin(command.name);
            await fs.remove(tempPath);
        } catch {}
        throw e;
    }
}

async function removePlugin(bot, name) {
    const command = bot.commandHandler.unloadPlugin(name);
    const file = command?.__pluginFile || pluginPath(name);
    await fs.remove(file);
    return command;
}

function listPlugins(bot) {
    const seen = new Set();
    const plugins = [];
    for (const command of bot.commands.values()) {
        if (!command.__plugin || seen.has(command.name)) continue;
        seen.add(command.name);
        plugins.push(command);
    }
    return plugins;
}

module.exports = {
    PLUGINS_DIR,
    cleanName,
    pluginPath,
    toRawUrl,
    saveAndLoad,
    removePlugin,
    listPlugins
};

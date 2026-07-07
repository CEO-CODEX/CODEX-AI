const { exec, execSync } = require('child_process');
const os  = require('os');
const fs  = require('fs-extra');

module.exports = {
    name: 'shell',
    aliases: ['sh', 'bash', 'exec', 'terminal', 'cmd', 'run'],
    category: 'owner',
    description: 'Execute shell commands on the server',
    ownerOnly: true,

    async execute(bot, m, args) {
        const sub = args[0]?.toLowerCase();

        // ── .shell info — system info ─────────────────────────────────────────
        if (!sub || sub === 'info' || sub === 'sysinfo') {
            const uptimeSec  = os.uptime();
            const hrs  = Math.floor(uptimeSec / 3600);
            const mins = Math.floor((uptimeSec % 3600) / 60);
            const secs = Math.floor(uptimeSec % 60);
            const mem  = os.totalmem();
            const free = os.freemem();
            const used = mem - free;
            const cpus = os.cpus();
            const load = os.loadavg();

            return await m.reply(
`SHELL INFO

Platform: ${os.platform()} (${os.arch()})
Hostname: ${os.hostname()}
OS: ${os.type()} ${os.release()}
Uptime: ${hrs}h ${mins}m ${secs}s

CPU: ${cpus[0]?.model || 'Unknown'} x${cpus.length}
Load: ${load.map(l => l.toFixed(2)).join(' / ')} (1m/5m/15m)

RAM Total: ${(mem / 1024 / 1024).toFixed(0)} MB
RAM Used:  ${(used / 1024 / 1024).toFixed(0)} MB
RAM Free:  ${(free / 1024 / 1024).toFixed(0)} MB

Node: ${process.version}
PID: ${process.pid}
CWD: ${process.cwd()}

Usage:
${bot.prefix}shell <command>    — run any shell command
${bot.prefix}shell info         — this screen
${bot.prefix}shell ls           — list files
${bot.prefix}shell ps           — running processes
${bot.prefix}shell df           — disk usage
${bot.prefix}shell env          — environment variables
${bot.prefix}shell restart      — restart bot process`
            );
        }

        // ── .shell restart ────────────────────────────────────────────────────
        if (sub === 'restart') {
            await m.reply('Restarting bot...');
            setTimeout(() => process.exit(0), 1000);
            return;
        }

        // ── .shell ps ─────────────────────────────────────────────────────────
        if (sub === 'ps') {
            return await _run('ps aux --no-headers | head -20', m, bot);
        }

        // ── .shell df ─────────────────────────────────────────────────────────
        if (sub === 'df') {
            return await _run('df -h', m, bot);
        }

        // ── .shell env ────────────────────────────────────────────────────────
        if (sub === 'env') {
            const envList = Object.entries(process.env)
                .filter(([k]) => !['PATH','_'].includes(k))
                .map(([k, v]) => `${k}=${v}`)
                .join('\n');
            return await m.reply(`ENVIRONMENT\n\n${envList || '(empty)'}`);
        }

        // ── .shell ls [path] ──────────────────────────────────────────────────
        if (sub === 'ls') {
            const path = args[1] || '.';
            return await _run(`ls -la "${path}"`, m, bot);
        }

        // ── .shell cat <file> ─────────────────────────────────────────────────
        if (sub === 'cat') {
            const file = args.slice(1).join(' ');
            if (!file) return await m.reply('Usage: ' + bot.prefix + 'shell cat <filepath>');
            return await _run(`cat "${file}"`, m, bot);
        }

        // ── Run arbitrary command ─────────────────────────────────────────────
        const command = args.join(' ');
        await _run(command, m, bot);
    }
};

async function _run(command, m, bot) {
    await m.reply(`Running: ${command}`);
    return new Promise(resolve => {
        exec(command, { timeout: 30000, maxBuffer: 1024 * 512 }, async (err, stdout, stderr) => {
            const out = (stdout || '').trim();
            const errOut = (stderr || '').trim();
            let result = '';
            if (out)    result += out;
            if (errOut) result += (result ? '\n\nSTDERR:\n' : 'STDERR:\n') + errOut;
            if (err && !out && !errOut) result = 'Error: ' + err.message;
            if (!result) result = '(no output)';
            // Truncate if too long
            if (result.length > 3500) result = result.slice(0, 3500) + '\n...(truncated)';
            await m.reply(`OUTPUT\n\n${result}`);
            resolve();
        });
    });
}

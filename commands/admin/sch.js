/**
 * .sch — Daily recurring schedule command (node-cron, survives restarts)
 *
 * Usage:
 *   .sch -mute 1am to 6am daily         → mutes group at 1am, unmutes at 6am, every day
 *   .sch -unmute 1am to 6am daily       → unmutes at 1am, mutes at 6am
 *   .sch -muteuser @user 1am to 6am daily
 *   .sch -unmuteuser @user 1am to 6am daily
 *   .sch list                            → list schedules for this chat
 *   .sch clear                           → cancel all schedules for this chat
 *
 * Times: 1am | 6pm | 6:30pm | 23:00  (Lagos timezone)
 */
const { getTarget }                                        = require('../../lib/getTarget');
const { parseTimeOfDay, humanize, addRecurring, cancelRecurring, listRecurring } = require('../../lib/mute-core');

module.exports = {
    name: 'sch',
    aliases: ['schedule', 'sched'],
    category: 'admin',
    description: 'Set a daily recurring mute/unmute schedule',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const jid = m.chat;
        const a0  = (args[0] || '').toLowerCase();
        const P   = bot.prefix;

        // ── list ─────────────────────────────────────────────────────────────
        if (a0 === 'list') {
            const jobs = listRecurring(jid);
            if (!jobs.length) return m.reply('📅 No recurring schedules set for this chat.');
            const lines = jobs.map((j, i) => {
                const fr = `${j.timeFrom.hour.toString().padStart(2,'0')}:${j.timeFrom.minute.toString().padStart(2,'0')}`;
                const to = `${j.timeTo.hour.toString().padStart(2,'0')}:${j.timeTo.minute.toString().padStart(2,'0')}`;
                const who = j.target ? ` @${j.target.split('@')[0]}` : '';
                return `${i+1}. ${j.type.replace('sch-','.')}${who} ${fr} → ${to} daily`;
            });
            return m.reply(`📅 *Recurring Schedules:*\n\n${lines.join('\n')}\n\nUse ${P}sch clear to remove all.`);
        }

        // ── clear ─────────────────────────────────────────────────────────────
        if (a0 === 'clear') {
            cancelRecurring(jid);
            return m.reply('🗑️ All recurring schedules cleared for this chat.');
        }

        // ── parse -type [target] <from> to <to> daily ─────────────────────────
        const typeMap = {
            '-mute':        'sch-muteGroup',
            '-unmute':      'sch-unmuteGroup',
            '-muteuser':    'sch-muteUser',
            '-unmuteuser':  'sch-unmuteUser',
        };
        const type = typeMap[a0];
        if (!type) {
            return m.reply(
`📅 *Schedule Command*

*Usage:*
${P}sch -mute 1am to 6am daily
${P}sch -unmute 1am to 6am daily
${P}sch -muteuser @user 1am to 6am daily
${P}sch -unmuteuser @user 1am to 6am daily
${P}sch list
${P}sch clear

_Times: 1am, 6pm, 6:30pm, 23:00 (Nigeria time)_`
            );
        }

        const needsTarget = type === 'sch-muteUser' || type === 'sch-unmuteUser';
        let target = null;
        if (needsTarget) {
            target = getTarget(m);
            if (!target) return m.reply(`Reply to a user's message or tag them:\n${P}sch ${a0} @user 1am to 6am daily`);
        }

        // Extract times — find "X to Y" pattern in remaining args
        const remainingArgs = args.slice(1).filter(a => !a.startsWith('@'));
        const text = remainingArgs.join(' ');
        const toMatch = text.match(/(.+?)\s+to\s+(.+?)(?:\s+daily)?$/i);
        if (!toMatch) {
            return m.reply(`Couldn't parse time range. Example:\n${P}sch ${a0} 1am to 6am daily`);
        }

        const timeFrom = parseTimeOfDay(toMatch[1].trim());
        const timeTo   = parseTimeOfDay(toMatch[2].trim());

        if (!timeFrom) return m.reply(`Couldn't parse start time: "${toMatch[1].trim()}"\nExamples: 1am, 6:30pm, 23:00`);
        if (!timeTo)   return m.reply(`Couldn't parse end time: "${toMatch[2].trim()}"\nExamples: 6am, 18:30, 08:00`);

        const id = addRecurring({ chat: jid, target, mutedBy: m.sender, type, timeFrom, timeTo });

        const frStr = `${timeFrom.hour.toString().padStart(2,'0')}:${timeFrom.minute.toString().padStart(2,'0')}`;
        const toStr = `${timeTo.hour.toString().padStart(2,'0')}:${timeTo.minute.toString().padStart(2,'0')}`;
        const who   = target ? ` @${target.split('@')[0]}` : '';
        const desc  = {
            'sch-muteGroup':   `Group will be *muted* at ${frStr} and *unmuted* at ${toStr} every day (Nigeria time).`,
            'sch-unmuteGroup': `Group will be *unmuted* at ${frStr} and *muted* at ${toStr} every day (Nigeria time).`,
            'sch-muteUser':    `${who} will be *muted* at ${frStr} and *unmuted* at ${toStr} every day (Nigeria time).`,
            'sch-unmuteUser':  `${who} will be *unmuted* at ${frStr} and *muted* at ${toStr} every day (Nigeria time).`,
        }[type];

        return m.reply(`✅ *Schedule created!*\n\n📅 ${desc}\n\nUse ${P}sch list to view or ${P}sch clear to remove.`);
    }
};
          

/**
 * CODEX AI — Chatbot DM
 * Auto-replies to anyone who DMs this bot's number. Never triggers in groups
 * — see .chatbot for that. Shares the same global character/train/personality
 * settings as the group chatbot (.chatbot mode machine|human, .chatbot train,
 * .chatbot personality).
 */
const fs   = require('fs-extra');
const path = require('path');
const smartAI = require('../../lib/smartAI');

const DB = path.join(process.cwd(), 'database/chatbotdm.json');
const readDB = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return { enabled: false, voice: false }; } };
const saveDB = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

module.exports = {
    name: 'chatbotdm',
    aliases: ['dmbot', 'aiassistant'],
    description: 'CODEX AI auto-reply for private DMs',
    usage: '.chatbotdm on|off|voice on|off|clear',
    category: 'owner',
    ownerOnly: true,

    async execute(bot, m, args) {
        if (m.isGroup) return await m.reply(`💬 This command only works in a private DM, not in groups! Use *${bot.prefix}chatbot* for groups.`);

        const a0 = (args[0] || '').toLowerCase();
        const a1 = (args[1] || '').toLowerCase();
        const db = readDB();

        if (a0 === 'clear') {
            smartAI.clearMemory('dm:' + m.sender);
            return await m.reply('🧹 Memory cleared for this DM.');
        }

        if (a0 === 'voice') {
            if (a1 !== 'on' && a1 !== 'off') {
                return await m.reply(
                    `🎙️ *CODEX AI Voice Mode*\n\nStatus: ${db.voice ? '✅ ON' : '❌ OFF'}\n\n` +
                    `*Usage:*\n• ${bot.prefix}chatbotdm voice on\n• ${bot.prefix}chatbotdm voice off`
                );
            }
            saveDB({ ...db, voice: a1 === 'on' });
            return await m.reply(
                a1 === 'on'
                    ? `🎙️ *Voice mode ENABLED.*\n\n_(Make sure ${bot.prefix}chatbotdm is also ON.)_`
                    : `🔇 *Voice mode DISABLED.* Replies will be sent as text again.`
            );
        }

        if (!a0 || !['on', 'off'].includes(a0)) {
            const memCount = smartAI.getMemoryCount('dm:' + m.sender);
            return await m.reply(
                `🤖 *Chatbot DM — CODEX AI Assistant*\n\n` +
                `Status: ${db.enabled ? '✅ ACTIVE' : '❌ OFF'}\n` +
                `Voice:  ${db.voice ? '🎙️ ON' : '🔇 OFF'}\n` +
                `Memory: ${memCount} messages\n\n` +
                `*Usage:*\n` +
                `• ${bot.prefix}chatbotdm on / off\n` +
                `• ${bot.prefix}chatbotdm voice on / off\n` +
                `• ${bot.prefix}chatbotdm clear\n\n` +
                `_Character (machine/human), global training, and personality are shared with the group chatbot — see ${bot.prefix}chatbot status._`
            );
        }

        if (a0 === 'on' && db.enabled)  return await m.reply('🤖 Chatbot DM is already *ON*!');
        if (a0 === 'off' && !db.enabled) return await m.reply('🤖 Chatbot DM is already *OFF*!');

        saveDB({ ...db, enabled: a0 === 'on' });

        if (a0 === 'on') {
            return await m.reply(
                `✅ *Chatbot DM ENABLED!*\n\n` +
                `🤖 CODEX AI will now automatically reply to anyone who DMs this number.\n\n` +
                `Use ${bot.prefix}chatbotdm voice on for voice-note replies.\n` +
                `Type ${bot.prefix}chatbotdm off to disable.`
            );
        }
        return await m.reply(`❌ *Chatbot DM DISABLED!*\n\n_CODEX AI will no longer auto-reply to private messages._`);
    }
};

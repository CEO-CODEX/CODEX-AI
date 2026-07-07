/**
 * CODEX AI — Chatbot (groups + global)
 *
 * Room-level (group admin or owner, group only): on/off (this chat), mode
 * all|tag, voice on|off, train chat <text>|default, personality chat
 * <text>|default, clear.
 *
 * Global (owner only — affects every chat, usable from DM too): on all|off
 * all, mode machine|human, train <text>|default, personality <text>|default.
 *
 * Anyone, anywhere: status, img <prompt>.
 */
const fs   = require('fs-extra');
const path = require('path');
const smartAI = require('../../lib/smartAI');

const GROUP_DB  = path.join(process.cwd(), 'database/chatbotgroup.json');
const GLOBAL_DB = path.join(process.cwd(), 'database/chatbotglobal.json');

const readJSON = (f, fb = {}) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const saveJSON = (f, d) => { fs.ensureDirSync(path.dirname(f)); fs.writeFileSync(f, JSON.stringify(d, null, 2)); };

/** Splits a pasted emoji string into individual emoji, grapheme-cluster aware
 *  (so multi-codepoint sequences like skin-tone modifiers or ZWJ combos stay intact). */
function splitEmojis(str) {
    try {
        const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
        return [...seg.segment(str)].map(s => s.segment).filter(Boolean);
    } catch {
        return Array.from(str); // fallback if Intl.Segmenter is unavailable
    }
}

module.exports = {
    name: 'chatbot',
    aliases: ['groupchatbot', 'gchatbot'],
    description: 'CODEX AI chatbot — see .chatbot status for the full menu (works in DMs too for global settings)',
    usage: '.chatbot status',
    category: 'general',

    async execute(bot, m, args) {
        const isGroup = m.isGroup;
        const jid     = isGroup ? m.chat : null;
        const sender  = m.sender;
        const isOwner = bot.permission.isOwner(sender);
        const isAdmin = isGroup ? await bot.permission.isAdmin(jid, sender, m._participantRaw) : false;
        const canRoom   = isOwner || isAdmin; // per-room changes
        const canGlobal = isOwner;            // bot-wide changes

        const a0 = (args[0] || '').toLowerCase();
        const a1 = (args[1] || '').toLowerCase();
        const a2 = (args[2] || '').toLowerCase();

        const gdb  = readJSON(GROUP_DB, {});
        const cfg  = isGroup ? (gdb[jid] || { enabled: false, mode: 'tag', voice: false, persona: null, train: null }) : null;
        const glob = readJSON(GLOBAL_DB, { allGroupsEnabled: false, character: 'machine', train: null, personality: null, emojiPool: [], emojiReactEnabled: false });

        const saveRoom   = () => { gdb[jid] = cfg; saveJSON(GROUP_DB, gdb); };
        const saveGlobal = () => saveJSON(GLOBAL_DB, glob);
        const groupOnly  = async () => await m.reply(`👥 That only works inside a group. Use ${bot.prefix}chatbot status here for the global settings.`);

        // ── img <prompt> — anyone, anywhere ───────────────────────────────────
        if (a0 === 'img') {
            const prompt = args.slice(1).join(' ').trim();
            if (!prompt) return await m.reply(`Usage: ${bot.prefix}chatbot img <prompt>`);
            await m.reply('🎨 Generating...');
            try {
                const { generateImageBuffer } = require('../../lib/chatbotImageGen');
                const out = await generateImageBuffer(prompt);
                if (!out) return await m.reply('❌ Image generation failed. Try a different prompt.');
                return await bot.sendMessage(m.chat, { image: out.buffer, caption: `🎨 _${prompt}_` }, { quoted: { key: m.key, message: m.message } });
            } catch (e) {
                return await m.reply('❌ Failed: ' + e.message);
            }
        }

        // ── emoji add|list|clear|react on|off — global, owner only ────────────
        if (a0 === 'emoji') {
            if (!canGlobal) return await m.reply('❌ Bot owner only.');

            if (a1 === 'add') {
                const raw = args.slice(2).join('').trim();
                if (!raw) return await m.reply(`Usage: ${bot.prefix}chatbot emoji add <emojis>\nExample: ${bot.prefix}chatbot emoji add 😂🔥💞`);
                const pool = new Set(glob.emojiPool || []);
                splitEmojis(raw).forEach(e => pool.add(e));
                glob.emojiPool = [...pool];
                if (glob.emojiReactEnabled === undefined) glob.emojiReactEnabled = true; // default on once emojis exist
                saveGlobal();
                return await m.reply(`✅ Added! Pool now has ${glob.emojiPool.length} emoji(s):\n${glob.emojiPool.join(' ')}`);
            }

            if (a1 === 'react') {
                if (!['on', 'off'].includes(a2)) return await m.reply(`Usage: ${bot.prefix}chatbot emoji react on|off`);
                if (a2 === 'on' && (!glob.emojiPool || !glob.emojiPool.length)) {
                    return await m.reply(`No emojis added yet. Use ${bot.prefix}chatbot emoji add <emojis> to add one.`);
                }
                glob.emojiReactEnabled = a2 === 'on'; saveGlobal();
                return await m.reply(a2 === 'on' ? '😊 Emoji-react-when-asked ENABLED.' : '🚫 Emoji-react-when-asked disabled.');
            }

            if (a1 === 'clear') {
                glob.emojiPool = []; saveGlobal();
                return await m.reply('🧹 Emoji pool cleared.');
            }

            // .chatbot emoji  (list/status)
            if (!glob.emojiPool || !glob.emojiPool.length) {
                return await m.reply(`No emojis added yet. Use ${bot.prefix}chatbot emoji add <emojis> to add one.`);
            }
            return await m.reply(
                `😊 *Emoji Reactions*\n\n` +
                `Status: ${glob.emojiReactEnabled !== false ? 'ON' : 'OFF'}\n` +
                `Pool (${glob.emojiPool.length}): ${glob.emojiPool.join(' ')}\n\n` +
                `*Usage:*\n${bot.prefix}chatbot emoji add <emojis>\n${bot.prefix}chatbot emoji react on|off\n${bot.prefix}chatbot emoji clear`
            );
        }

        // ── status — anyone, anywhere ──────────────────────────────────────────
        if (!a0 || a0 === 'status') {
            if (isGroup) {
                const memCount = smartAI.getMemoryCount('grp:' + jid + ':' + sender);
                return await m.reply(
`ಠ_ಠ *CHATBOT STATUS*

❏◦ This chat: \`${cfg.enabled ? '✓ ENABLED' : '✘ DISABLED'}\`
❏◦ Mode: *${(cfg.mode || 'tag').toUpperCase()}*
❏◦ Global private mode: \`${glob.allGroupsEnabled ? 'ON' : 'OFF'}\`
❏◦ Memory: ${memCount} messages
❏◦ Chat personality: ${cfg.persona ? '✓ set (overrides global)' : '✘ not set'}

*Commands:*
${bot.prefix}chatbot on / off (this chat)
${bot.prefix}chatbot on all / off all (global private)
${bot.prefix}chatbot mode all / tag
${bot.prefix}chatbot mode machine / human (global)
${bot.prefix}chatbot train <text> / train default (global)
${bot.prefix}chatbot train chat <text> / train chat default (this chat only)
${bot.prefix}chatbot personality <text> / personality default (global)
${bot.prefix}chatbot personality chat <text> / personality chat default (this chat only)
${bot.prefix}chatbot clear
${bot.prefix}chatbot img  <prompt> (quick generate)

*Auto image detect:* and describes.`
                );
            }
            return await m.reply(
`ಠ_ಠ *CHATBOT STATUS* (global — run inside a group for that chat's own settings)

❏◦ Global private mode: \`${glob.allGroupsEnabled ? 'ON' : 'OFF'}\`
❏◦ Character: *${glob.character === 'human' ? 'HUMAN' : 'MACHINE'}*
❏◦ Global training: ${glob.train ? '✓ set' : '✘ default'}
❏◦ Global personality: ${glob.personality ? '✓ set' : '✘ default'}

*Global commands (work from DM):*
${bot.prefix}chatbot on all / off all
${bot.prefix}chatbot mode machine / human
${bot.prefix}chatbot train <text> / train default
${bot.prefix}chatbot personality <text> / personality default
${bot.prefix}chatbot img <prompt>

*Use ${bot.prefix}chatbotdm to control DM auto-reply itself.*`
            );
        }

        // ── mode all|tag|machine|human ────────────────────────────────────────
        if (a0 === 'mode') {
            if (['all', 'tag'].includes(a1)) {
                if (!isGroup) return await groupOnly();
                if (!canRoom) return await m.reply('❌ Group admins only.');
                cfg.mode = a1; saveRoom();
                return await m.reply(`✅ Reply mode set to *${a1.toUpperCase()}* for this chat.`);
            }
            if (['machine', 'human'].includes(a1)) {
                if (!canGlobal) return await m.reply('❌ Bot owner only — this affects every chat.');
                glob.character = a1; saveGlobal();
                return await m.reply(`✅ Character mode set to *${a1.toUpperCase()}* (global, all chats).`);
            }
            return await m.reply(`Usage: ${bot.prefix}chatbot mode all|tag|machine|human`);
        }

        // ── voice on|off (this chat) ───────────────────────────────────────────
        if (a0 === 'voice') {
            if (!isGroup) return await groupOnly();
            if (!canRoom) return await m.reply('❌ Group admins only.');
            if (!['on', 'off'].includes(a1)) return await m.reply(`Usage: ${bot.prefix}chatbot voice on|off`);
            cfg.voice = a1 === 'on'; saveRoom();
            return await m.reply(a1 === 'on' ? '🎙️ Voice replies ENABLED for this chat.' : '🔇 Voice replies disabled.');
        }

        // ── train [chat] <text>|default ───────────────────────────────────────
        if (a0 === 'train') {
            if (a1 === 'chat') {
                if (!isGroup) return await groupOnly();
                if (!canRoom) return await m.reply('❌ Group admins only.');
                if (a2 === 'default') {
                    cfg.train = null; cfg.persona = null; saveRoom();
                    return await m.reply('🔄 This chat reset to default — training and personality both cleared.');
                }
                const txt = args.slice(2).join(' ').trim();
                if (!txt) return await m.reply(`Usage: ${bot.prefix}chatbot train chat <text>  (or "default" to reset)`);
                cfg.train = txt; saveRoom();
                return await m.reply(`✅ This chat's training updated — permanent until you change it again.\n\n🧠 _${txt}_`);
            }
            if (!canGlobal) return await m.reply('❌ Bot owner only — this affects every chat.');
            if (a1 === 'default') {
                glob.train = null; glob.personality = null; saveGlobal();
                return await m.reply('🔄 Reset to default globally — training and personality both cleared.');
            }
            const txt = args.slice(1).join(' ').trim();
            if (!txt) return await m.reply(`Usage: ${bot.prefix}chatbot train <text>  (or "default" to reset)`);
            glob.train = txt; saveGlobal();
            return await m.reply(`✅ Global training updated (applies everywhere) — permanent until you change it again.\n\n🧠 _${txt}_`);
        }

        // ── personality [chat] <text>|default ─────────────────────────────────
        if (a0 === 'personality') {
            if (a1 === 'chat') {
                if (!isGroup) return await groupOnly();
                if (!canRoom) return await m.reply('❌ Group admins only.');
                const txt = args.slice(2).join(' ').trim();
                if (a2 === 'default' || !txt) {
                    cfg.persona = null; cfg.train = null; saveRoom();
                    return await m.reply('🔄 This chat reset to default — personality and training both cleared.');
                }
                cfg.persona = txt; saveRoom();
                return await m.reply(`✅ Personality set for this chat (overrides global) — permanent until changed again.\n\n🧠 _${txt}_`);
            }
            if (!canGlobal) return await m.reply('❌ Bot owner only — this affects every chat.');
            const txt = args.slice(1).join(' ').trim();
            if (a1 === 'default' || !txt) {
                glob.personality = null; glob.train = null; saveGlobal();
                return await m.reply('🔄 Reset to default globally — personality and training both cleared.');
            }
            glob.personality = txt; saveGlobal();
            return await m.reply(`✅ Global personality updated (applies everywhere, unless a chat has its own) — permanent until changed again.\n\n🧠 _${txt}_`);
        }

        // ── clear (this chat's memory) ─────────────────────────────────────────
        if (a0 === 'clear') {
            if (!isGroup) return await groupOnly();
            smartAI.clearMemory('grp:' + jid + ':' + sender);
            return await m.reply('🧹 Memory cleared for this chat.');
        }

        // ── on / off [all] ───────────────────────────────────────────────────────
        if (a0 === 'on' || a0 === 'off') {
            if (a1 === 'all') {
                if (!canGlobal) return await m.reply('❌ Bot owner only — this affects every group.');
                glob.allGroupsEnabled = a0 === 'on'; saveGlobal();
                return await m.reply(a0 === 'on'
                    ? '✅ *Global private mode ENABLED.* CODEX AI chatbot is now active in ALL groups.'
                    : '❌ *Global private mode DISABLED.* Groups now follow their own individual on/off setting.');
            }
            if (!isGroup) return await groupOnly();
            if (!canRoom) return await m.reply('❌ Group admins only.');
            cfg.enabled = a0 === 'on'; saveRoom();
            return await m.reply(a0 === 'on'
                ? `✅ *Chatbot ENABLED* for this chat.\n🤖 I'll reply when tagged, replied to, or named — or use *${bot.prefix}chatbot mode all* for every message.`
                : '❌ *Chatbot DISABLED* for this chat.');
        }

        return await m.reply(`❓ Unknown option. Try ${bot.prefix}chatbot status.`);
    }
};

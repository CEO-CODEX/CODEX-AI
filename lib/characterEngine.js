// ── Bot Character & Emoji Engine ──────────────────────────────────────────────
// This is the single source of truth. All other files import from here.

const BOT_CHARACTERS = [
    '—͟͟͞͞𖣘','—͟͟͞͞❂','—͟͟͞͞✪','—͟͟͞͞✫','—͟͟͞͞✬','—͟͟͞͞✭','—͟͟͞͞✮','—͟͟͞͞✯','—͟͟͞͞✰','—͟͟͞͞✱',
    '—͟͟͞͞✲','—͟͟͞͞✵','—͟͟͞͞✶','—͟͟͞͞✷','—͟͟͞͞✸','—͟͟͞͞✹','—͟͟͞͞✺','—͟͟͞͞✻','—͟͟͞͞✼','—͟͟͞͞✽',
    '—͟͟͞͞✾','—͟͟͞͞✿','—͟͟͞͞❀','—͟͟͞͞❁','—͟͟͞͞❃','—͟͟͞͞❅','—͟͟͞͞❆','—͟͟͞͞❈','—͟͟͞͞❉','—͟͟͞͞❊',
    '—͟͟͞͞❋','—͟͟͞͞❍','—͟͟͞͞❏','—͟͟͞͞❐','—͟͟͞͞❑','—͟͟͞͞❒','—͟͟͞͞❖','—͟͟͞͞❘','—͟͟͞͞❙','—͟͟͞͞❚',
    '—͟͟͞͞❛','—͟͟͞͞❜','—͟͟͞͞❝','—͟͟͞͞❞','—͟͟͞͞❡','—͟͟͞͞❢','—͟͟͞͞❣','—͟͟͞͞❤','—͟͟͞͞❥','—͟͟͞͞❦',
    '—͟͟͞͞❧','—͟͟͞͞☙','—͟͟͞͞♀','—͟͟͞͞♂','—͟͟͞͞⚢','—͟͟͞͞⚣','—͟͟͞͞⚤','—͟͟͞͞⚥','—͟͟͞͞⚦','—͟͟͞͞⚧',
    '—͟͟͞͞⚨','—͟͟͞͞⚩','—͟͟͞͞⚭','—͟͟͞͞⚮','—͟͟͞͞⚯','—͟͟͞͞⚲','—͟͟͞͞⌬','—͟͟͞͞⏢','—͟͟͞͞⏣','—͟͟͞͞⏥',
    '—͟͟͞͞⏧','—͟͟͞͞⏨','—͟͟͞͞⌨','—͟͟͞͞✁','—͟͟͞͞✂','—͟͟͞͞✃','—͟͟͞͞✄','—͟͟͞͞➲','—͟͟͞͞➼','—͟͟͞͞➽',
    '—͟͟͞͞➸','—͟͟͞͞➳','—͟͟͞͞➵','—͟͟͞͞➺','—͟͟͞͞➻','—͟͟͞͞➾','—͟͟͞͞➣','—͟͟͞͞➤','—͟͟͞͞➥','—͟͟͞͞➦',
    '—͟͟͞͞➧','—͟͟͞͞➨','—͟͟͞͞➩','—͟͟͞͞➪','—͟͟͞͞➫','—͟͟͞͞⏻','—͟͟͞͞⏼','—͟͟͞͞⏽','—͟͟͞͞⭘','—͟͟͞͞⭙',
    '—͟͟͞͞⭚','—͟͟͞͞⭛','—͟͟͞͞⭜','—͟͟͞͞⭝','—͟͟͞͞⭞','—͟͟͞͞⭟','—͟͟͞͞⚔','—͟͟͞͞⚙','—͟͟͞͞⚚','—͟͟͞͞⚖'
];

const BOT_EMOJIS = [
    '🔱','⚡','🔥','💫','⭐','🌟','✨','💥','🎯','🎪',
    '🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺',
    '🎸','🏆','🥇','🎖','🏅','🎗','🎫','🎟','🎪','🤹',
    '🎲','🎮','🕹','🎰','🧩','♟','🎯','🎳','🎱','🔮',
    '🧿','🪬','🧲','💎','🔭','🔬','⚗','🧬','🧪','🧫',
    '🌀','🌈','⛅','🌊','🌋','🗻','🏔','⛰','🌌','🌠',
    '🌙','☀','🌤','⛈','🌪','🌫','🌬','🌝','🌚','🌕',
    '💠','🔷','🔹','🔶','🔸','🟣','🟤','🟠','🟡','🟢',
    '🔴','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🔲',
    '🔳','▪','▫','◾','◽','◼','◻','🔘','🔵','⚫'
];

/**
 * Build the prefix string (character + emoji) from config.
 * Returns empty string if both are off.
 */
function buildPrefix(config) {
    const charMode  = config.BOT_CHARACTER || 'off';
    const emojiMode = config.BOT_EMOJI     || 'off';

    let char  = '';
    let emoji = '';

    if (charMode !== 'off') {
        if (charMode === 'automatic') {
            char = BOT_CHARACTERS[Math.floor(Math.random() * BOT_CHARACTERS.length)];
        } else {
            const n = parseInt(charMode);
            if (!isNaN(n) && n >= 1 && n <= BOT_CHARACTERS.length) char = BOT_CHARACTERS[n - 1];
        }
    }

    if (emojiMode !== 'off') {
        if (emojiMode === 'automatic') {
            emoji = BOT_EMOJIS[Math.floor(Math.random() * BOT_EMOJIS.length)];
        } else {
            const n = parseInt(emojiMode);
            if (!isNaN(n) && n >= 1 && n <= BOT_EMOJIS.length) emoji = BOT_EMOJIS[n - 1];
        }
    }

    return [char, emoji].filter(Boolean).join(' ');
}

/**
 * Apply character/emoji prefix to a plain string.
 * Used by the sendMessage engine — no command file needs to call this.
 */
function applyPrefix(str, config) {
    if (typeof str !== 'string' || !str) return str;
    const pre = buildPrefix(config);
    return pre ? `${pre} ${str}` : str;
}

module.exports = { BOT_CHARACTERS, BOT_EMOJIS, buildPrefix, applyPrefix };

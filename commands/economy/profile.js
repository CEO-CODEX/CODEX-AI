const { getTarget }   = require('../../lib/getTarget');
const { loadDB, saveDB, getUser, fmt, CURRENCY, xpForLevel } = require('../../lib/economyEngine');

// ── Rank titles ────────────────────────────────────────────────────────────
const RANKS = [
    [100,'👑 OVERLORD'],[80,'💀 WARLORD'],[60,'🔱 ELITE'],[50,'👑 LEGEND'],
    [40,'💎 DIAMOND'],[30,'🥇 GOLD'],[20,'🥈 SILVER'],[15,'🥉 BRONZE'],
    [10,'⚔️ WARRIOR'],[5,'🗡️ ADVENTURER'],[3,'🌿 APPRENTICE'],[1,'🌱 BEGINNER'],
    [0,'🐣 NEWCOMER']
];
function getRank(level) {
    for (const [min, title] of RANKS) if (level >= min) return title;
    return '🐣 NEWCOMER';
}

// ── Canvas card ────────────────────────────────────────────────────────────
async function buildCard(user, phoneNum, rankTitle, gta) {
    const { createCanvas } = require('@napi-rs/canvas');

    const W = 800, H = 560;
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, W, H);

    // ── Neon border ──────────────────────────────────────────────────────────
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.strokeStyle = '#00ffcc22';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, W - 24, H - 24);

    // ── Header ───────────────────────────────────────────────────────────────
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('// CODEX IDENTITY CARD //', 24, 38);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px monospace';
    ctx.fillText('+' + phoneNum, 24, 76);

    const xpNeeded = xpForLevel(user.level + 1);
    const xpPrev   = xpForLevel(user.level);
    const xpProg   = user.xp - xpPrev;
    const xpTotal  = Math.max(xpNeeded - xpPrev, 1);
    const xpPct    = Math.round((xpProg / xpTotal) * 100);

    // Right side header — W:L
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px monospace';
    ctx.fillText(`W:${user.battle.wins} L:${user.battle.losses}`, W - 110, 38);

    // Rank + level
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 14px monospace';
    const cleanRank = rankTitle.replace(/[^\w\s]/g, '').trim().toUpperCase();
    ctx.fillText(`${cleanRank}  •  LV.${user.level}  •  ${fmt(user.xp)} XP total`, 24, 100);

    // ── Divider ──────────────────────────────────────────────────────────────
    ctx.strokeStyle = '#00ffcc44';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(24, 112); ctx.lineTo(W - 24, 112); ctx.stroke();

    // ── Column helper ────────────────────────────────────────────────────────
    const LCOL = 24, RCOL = 420;
    const ICON_COLOR = '#00ffcc';
    const LABEL_COLOR = '#888888';
    const VALUE_COLOR = '#ffffff';

    function iconBox(x, y, code) {
        ctx.fillStyle = '#1a2a1a';
        ctx.fillRect(x, y - 12, 28, 18);
        ctx.fillStyle = ICON_COLOR;
        ctx.font = '10px monospace';
        ctx.fillText(code.substring(0,3), x + 2, y);
    }

    function row(x, y, label, value, valColor) {
        iconBox(x, y, label);
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = '12px monospace';
        ctx.fillText(label + ':', x + 34, y);
        ctx.fillStyle = valColor || VALUE_COLOR;
        ctx.font = 'bold 13px monospace';
        const lw = ctx.measureText(label + ': ').width;
        ctx.fillText(value, x + 34 + lw, y);
    }

    function bar(x, y, pct, color, maxW) {
        maxW = maxW || 140;
        const safePct  = Math.max(0, Math.min(pct, 100));
        const filled   = Math.round((safePct / 100) * maxW);
        // Clip bar to right canvas boundary
        const maxRight = W - 24;
        const safeW    = Math.min(maxW, maxRight - x);
        const safeFill = Math.min(filled, maxRight - x);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y - 10, safeW, 12);
        ctx.clip();
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(x, y - 10, safeW, 12);
        ctx.fillStyle = color;
        if (safeFill > 0) ctx.fillRect(x, y - 10, safeFill, 12);
        ctx.restore();
    }

    // ── LEFT COLUMN — ECONOMY ───────────────────────────────────────────────
    ctx.fillStyle = ICON_COLOR;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('— ECONOMY', LCOL, 135);

    const netWorth = (user.wallet || 0) + (user.bank || 0);
    const strk     = user.streak  || 0;

    row(LCOL, 158, 'WAL', fmt(user.wallet));
    row(LCOL, 180, 'BNK', fmt(user.bank));
    row(LCOL, 202, 'NET', fmt(netWorth));
    row(LCOL, 224, 'STR', `Streak: ${strk}d`);
    row(LCOL, 246, 'AST', `Assets: ${user.assets || 0}`);

    // XP bar
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = '11px monospace';
    ctx.fillText(`— XP ${fmt(user.xp)}/${fmt(xpNeeded)} (${xpPct}%)`, LCOL, 272);
    bar(LCOL, 286, xpPct, '#00ffcc', 360);

    // ── LEFT LOWER — TORN STATUS ────────────────────────────────────────────
    ctx.fillStyle = ICON_COLOR;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('— TORN STATUS', LCOL, 318);

    // Health
    const isHealthy = (user.health || 'Healthy').toLowerCase() === 'healthy';
    row(LCOL, 340, 'HLT', user.health || 'Healthy', isHealthy ? '#00ff88' : '#ff4444');

    // Nerve bar
    const nerveVal  = user.nerve    || 0;
    const nerveMax  = user.maxNerve || 100;
    const nervePct  = Math.round((nerveVal / nerveMax) * 100);
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = '11px monospace';
    ctx.fillText(`NRV Nerve ${nerveVal}/${nerveMax}`, LCOL, 362);
    bar(LCOL, 374, nervePct, '#ff6644', 170);

    // Energy bar
    const energyVal = user.energy    || 0;
    const energyMax = user.maxEnergy || 100;
    const energyPct = Math.round((energyVal / energyMax) * 100);
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = '11px monospace';
    ctx.fillText(`ENR Energy ${energyVal}/${energyMax}`, LCOL + 190, 362);
    bar(LCOL + 190, 374, energyPct, '#44ff88', 170);

    // Shield + auto-shield
    const shieldName = user.shield ? (user.inventory?.shield > 0 ? 'Active' : 'None') : 'None';
    row(LCOL, 400, 'SHD', `Shield: ${shieldName}`);
    row(LCOL + 190, 400, 'AUS', `Auto-shield: ${user.autoShield ? 'ON' : 'OFF'}`);

    // Location + Home
    // Location — uses GTA location if available
    const _loc = (gta?.location) || user.location || 'Lagos';
    row(LCOL, 422, 'LOC', `Home (${_loc})`);

    // ── RIGHT COLUMN — BATTLE STATS ─────────────────────────────────────────
    ctx.fillStyle = ICON_COLOR;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('— BATTLE STATS', RCOL, 135);

    const b = user.battle;
    function statBar(x, y, label, val, max) {
        max = max || 100;
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = '12px monospace';
        ctx.fillText(label + ': ' + val, x, y);
        // Cap bar width so it never exceeds canvas right edge
        const maxBarW = Math.min(160, W - 24 - (x + 90));
        bar(x + 90, y, Math.round((val / max) * 100), '#4466ff', maxBarW);
    }

    statBar(RCOL, 158, '💪 STR', b.str || 10, 100);
    statBar(RCOL, 192, '🛡️ DEF', b.def || 10, 100);
    statBar(RCOL, 226, '⚡ SPD', b.spd || 10, 100);
    statBar(RCOL, 260, '🎯 DEX', b.dex || 10, 100);

    // ── PET ──────────────────────────────────────────────────────────────────
    if (user.pet) {
        ctx.strokeStyle = '#00ffcc33';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(RCOL, 290); ctx.lineTo(W - 24, 290); ctx.stroke();

        ctx.fillStyle = LABEL_COLOR;
        ctx.font = '11px monospace';
        ctx.fillText(`🐾 Pet: ${user.pet.emoji || '🐶'} ${user.pet.name} (${user.pet.type || 'dog'})`, RCOL, 310);

        const petHpPct   = Math.round(((user.pet.health   || 100) / 100) * 100);
        const petHappPct = Math.round(((user.pet.happiness|| 100) / 100) * 100);
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = '11px monospace';
        ctx.fillText(`❤️  Health: ${user.pet.health || 100}%`, RCOL, 328);
        bar(RCOL, 340, petHpPct, '#ff4466', 155);
        ctx.fillText(`😊  Happy: ${user.pet.happiness || 100}%`, RCOL, 358);
        bar(RCOL, 370, petHappPct, '#ffaa00', 155);

        const score = user.pet.score || 0;
        const cares = user.pet.cares || 0;
        ctx.fillText(`⭐ Score: ${score}/100  |  🏅 Cares: ${cares}`, RCOL, 390);
    }

    // ── CRYPTO ───────────────────────────────────────────────────────────────
    const cryptoVal = user.cryptoValue || 0;
    if (cryptoVal > 0) {
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = '11px monospace';
        const cryptoY = user.pet ? 415 : 390;
        ctx.fillText(`📈 Crypto Portfolio: ${fmt(cryptoVal)}`, RCOL, cryptoY);
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    ctx.strokeStyle = '#00ffcc44';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(24, H - 30); ctx.lineTo(W - 24, H - 30); ctx.stroke();

    // GTA stats row if available
    if (gta) {
        try {
            const { GANGS: _G, WEAPONS: _W, getWantedLabel: _WL } = require('../../lib/gtaEngine');
            const _stars = '⭐'.repeat(gta.wantedStars||0) || '⚪';
            const _gang  = gta.gang ? `${_G[gta.gang]?.emoji} ${_G[gta.gang]?.name}` : 'No Gang';
            const _wpn   = _W[gta.weapon||'fists']?.name || 'Fists';
            ctx.fillStyle = '#888888';
            ctx.font      = '11px monospace';
            ctx.fillText(`WANTED: ${_stars || 'CLEAN'}  |  GANG: ${_gang}  |  WPN: ${_wpn}`, 24, H - 42);
        } catch {}
    }
    ctx.fillStyle = '#00ffcc55';
    ctx.font = '11px monospace';
    ctx.fillText('CODEX AI v3', W - 100, H - 12);

    return c.toBuffer('image/png');
}

// ── Text fallback (if canvas not installed) ──────────────────────────────
function buildText(user, phoneNum, rankTitle) {
    const xpNeeded = xpForLevel(user.level + 1);
    const xpPrev   = xpForLevel(user.level);
    const xpPct    = Math.round(((user.xp - xpPrev) / Math.max(xpNeeded - xpPrev, 1)) * 100);
    const bar = (pct, w=10) => '█'.repeat(Math.round(pct/100*w)) + '░'.repeat(w - Math.round(pct/100*w));
    const b   = user.battle;
    const netWorth = (user.wallet||0) + (user.bank||0);
    const p   = user.pet;

    return `// CODEX IDENTITY CARD //
+${phoneNum}${' '.repeat(Math.max(1,30 - phoneNum.length))}W:${b.wins} L:${b.losses}
${rankTitle.replace(/[^\w\s]/g,'').trim().toUpperCase()} • LV.${user.level} • ${fmt(user.xp)} XP total

— ECONOMY —————————————— BATTLE STATS ——
💵 ${fmt(user.wallet||0)}                    💪 STR: ${b.str}
🏦 ${fmt(user.bank||0)}                     🛡️ DEF: ${b.def}
💎 ${fmt(netWorth)}                    ⚡ SPD: ${b.spd}
🔥 Streak: ${user.streak||0}d                  🎯 DEX: ${b.dex}
🏢 Assets: ${user.assets||0}
— XP ${fmt(user.xp)}/${fmt(xpNeeded)} (${xpPct}%)
[${bar(xpPct, 20)}]

— TORN STATUS ——————————————————————————
🏥 ${user.health||'Healthy'}
🧠 Nerve  [${bar(Math.round((user.nerve||0)/(user.maxNerve||100)*100),10)}] ${user.nerve||0}/${user.maxNerve||100}
⚡ Energy [${bar(Math.round((user.energy||0)/(user.maxEnergy||100)*100),15)}] ${user.energy||0}/${user.maxEnergy||100}
🛡️ Shield: ${user.shield ? 'Active' : 'None'} | Auto-shield: ${user.autoShield ? 'ON' : 'OFF'}
📍 Home (${user.location||'Lagos'})
${(user.cryptoValue||0)>0?`📈 Crypto Portfolio: ${fmt(user.cryptoValue)}`:''}
${p ? `🐾 Pet: ${p.emoji||'🐶'} ${p.name} (${p.type||'dog'})
❤️ Health: [${bar(p.health||100)}] ${p.health||100}% | 😊 Happy: [${bar(p.happiness||100)}] ${p.happiness||100}%
⭐ Score: ${p.score||0}/100 | 🏅 Cares: ${p.cares||0}` : ''}`.trim();
}

module.exports = {
    name: 'profile',
    aliases: ['eco', 'idcard', 'card', 'id'],
    category: 'economy',
    description: 'View your CODEX identity card',

    async execute(bot, m, args) {
        const db        = loadDB();
        const targetJid = getTarget(m) || m.sender.replace(/:[0-9]+@/, '@');
        const isSelf    = targetJid === m.sender.replace(/:[0-9]+@/, '@');
        const user      = getUser(db, targetJid);
        const phoneNum  = targetJid.split('@')[0];
        const rankTitle = getRank(user.level);

        // Load GTA data
        let gta = null;
        try {
            const { getGtaUser, GANGS, WEAPONS, ARMOR, getWantedLabel } = require('../../lib/gtaEngine');
            gta = getGtaUser(targetJid);
        } catch {}

        saveDB(db);

        // ── Smart caption based on progress ──────────────────────────────────
        const netWorth = (user.wallet||0) + (user.bank||0);
        const xpNeeded = xpForLevel(user.level + 1);
        const xpPct    = Math.round(((user.xp - xpForLevel(user.level)) / Math.max(xpNeeded - xpForLevel(user.level),1)) * 100);

        let caption = '';
        if (netWorth >= 1000000) caption = `💎 *${user.level >= 50 ? 'OVERLORD' : rankTitle}* — This player is a LEGEND. Net worth: 🪙${fmt(netWorth)}`;
        else if (netWorth >= 500000) caption = `👑 *${rankTitle}* — Stacking serious coins. Net worth: 🪙${fmt(netWorth)}`;
        else if (netWorth >= 100000) caption = `🔱 *${rankTitle}* — Making moves. Keep grinding! 🪙${fmt(netWorth)}`;
        else if (netWorth >= 50000)  caption = `⚔️ *${rankTitle}* — Getting there. 🪙${fmt(netWorth)} in the bag`;
        else if (netWorth >= 10000)  caption = `🌿 *${rankTitle}* — Still a youngin. Level up! 🪙${fmt(netWorth)}`;
        else caption = `🐣 *${rankTitle}* — Just starting out. Grind hard! 🪙${fmt(netWorth)}`;

        if (gta?.wantedStars >= 4) caption += `
⭐ HIGH ALERT — ${gta.wantedStars} star wanted level!`;
        if (gta?.gang) {
            try {
                const { GANGS } = require('../../lib/gtaEngine');
                caption += `
${GANGS[gta.gang]?.emoji} *${GANGS[gta.gang]?.name}* member`;
            } catch {}
        }
        if (user.streak >= 7)  caption += `
🔥 ${user.streak} day streak! Consistent grinder!`;
        if (user.pet)          caption += `
🐾 Pet: ${user.pet.emoji} ${user.pet.name}`;
        if (xpPct >= 90)       caption += `
⚡ Almost at next level! (${xpPct}%)`;

        // Try canvas first
        let canvasAvail = false;
        try { require('@napi-rs/canvas'); canvasAvail = true; } catch {}

        if (canvasAvail) {
            try {
                await m.reply('_Generating your ID card..._');
                const imgBuf = await buildCard(user, phoneNum, rankTitle, gta);
                await bot.sendMessage(m.chat, { image: imgBuf, caption }, { quoted: m });
                return;
            } catch(e) {
                console.log('[Profile canvas error]', e.message);
            }
        }

        // Fallback to text
        await m.reply(buildText(user, phoneNum, rankTitle));
    }
};

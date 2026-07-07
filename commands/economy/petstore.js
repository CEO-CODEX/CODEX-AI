const { loadDB, saveDB, getUser, fmt, CURRENCY } = require('../../lib/economyEngine');

const PETS = [
    { id: 'dog',    emoji: '🐶', name: 'Dog',    price: 2000,  desc: 'Loyal and loving companion' },
    { id: 'cat',    emoji: '🐱', name: 'Cat',    price: 1500,  desc: 'Independent and mysterious' },
    { id: 'rabbit', emoji: '🐰', name: 'Rabbit', price: 1000,  desc: 'Cute and fluffy friend' },
    { id: 'fox',    emoji: '🦊', name: 'Fox',    price: 5000,  desc: 'Cunning and clever' },
    { id: 'wolf',   emoji: '🐺', name: 'Wolf',   price: 8000,  desc: 'Wild and fierce protector' },
    { id: 'lion',   emoji: '🦁', name: 'Lion',   price: 15000, desc: 'King of the jungle' },
    { id: 'dragon', emoji: '🐲', name: 'Dragon', price: 50000, desc: 'Mythical fire-breather' },
    { id: 'eagle',  emoji: '🦅', name: 'Eagle',  price: 10000, desc: 'Soars above all others' },
];

const CARE_COST   = 200;
const CARE_CD     = 6 * 60 * 60 * 1000;  // 6 hours
const RENAME_COST = 500;

module.exports = {
    name: 'petstore',
    aliases: ['pet', 'pets', 'mypet'],
    category: 'economy',
    description: 'Buy, name, and care for your pet',

    async execute(bot, m, args) {
        const db   = loadDB();
        const user = getUser(db, m.sender);
        const sub  = args[0]?.toLowerCase();

        // ── No args — show pet status or store ─────────────────────────────
        if (!sub) {
            if (user.pet) {
                const p = user.pet;
                const hpBar   = '█'.repeat(Math.round(p.health/10)) + '░'.repeat(10 - Math.round(p.health/10));
                const happBar = '█'.repeat(Math.round(p.happiness/10)) + '░'.repeat(10 - Math.round(p.happiness/10));
                return await m.reply(
`🐾 *YOUR PET*

${p.emoji} *${p.name}* (${p.type})
❤️ Health:    [${hpBar}] ${p.health}%
😊 Happiness: [${happBar}] ${p.happiness}%
⭐ Score:  ${p.score}/100
🏅 Cares:  ${p.cares}

Use:
${bot.prefix}pet care — feed & play (costs ${fmt(CARE_COST)} coins, 6h cooldown)
${bot.prefix}pet rename <name> — rename (costs ${fmt(RENAME_COST)} coins)
${bot.prefix}pet release — release your pet
${bot.prefix}petstore list — see all pets`);
            }
            return await m.reply(
`🏪 *PET STORE*

You don't have a pet yet!
Use *${bot.prefix}petstore list* to see available pets.
Use *${bot.prefix}petstore buy <pet>* to get one.`);
        }

        // ── List ─────────────────────────────────────────────────────────────
        if (sub === 'list') {
            const list = PETS.map((p, i) =>
                `${i+1}. ${p.emoji} *${p.name}* — 🪙${fmt(p.price)}\n   _${p.desc}_`
            ).join('\n\n');
            return await m.reply(`🏪 *PET STORE*\n\n${list}\n\nUse: *${bot.prefix}petstore buy <name>*`);
        }

        // ── Buy ───────────────────────────────────────────────────────────────
        if (sub === 'buy') {
            if (user.pet) return await m.reply(`❌ You already have a pet: ${user.pet.emoji} *${user.pet.name}*!\nRelease it first with *${bot.prefix}pet release*`);
            const petName = args[1]?.toLowerCase();
            const found   = PETS.find(p => p.id === petName || p.name.toLowerCase() === petName);
            if (!found) return await m.reply(`❌ Pet not found. Use *${bot.prefix}petstore list* to see options.`);
            if ((user.wallet || 0) < found.price) return await m.reply(`❌ Not enough coins!\nNeed: 🪙*${fmt(found.price)}*\nYou have: 🪙*${fmt(user.wallet || 0)}*`);
            user.wallet -= found.price;
            user.pet = {
                type:      found.name.toLowerCase(),
                emoji:     found.emoji,
                name:      found.name,
                health:    100,
                happiness: 100,
                score:     100,
                cares:     0,
                lastCare:  0,
                boughtAt:  Date.now()
            };
            user.assets = (user.assets || 0) + 1;
            saveDB(db);
            return await m.reply(
`✅ You bought ${found.emoji} *${found.name}*!

Cost: 🪙*-${fmt(found.price)}*
New balance: 🪙*${fmt(user.wallet)}*

Name your pet with: *${bot.prefix}pet rename <name>*
Care for it with: *${bot.prefix}pet care*`);
        }

        // ── Care ──────────────────────────────────────────────────────────────
        if (sub === 'care') {
            if (!user.pet) return await m.reply(`❌ You don't have a pet! Buy one with *${bot.prefix}petstore buy <name>*`);
            const now      = Date.now();
            const lastCare = user.pet.lastCare || 0;
            const wait     = CARE_CD - (now - lastCare);
            if (wait > 0) {
                const h = Math.floor(wait/3600000), mn = Math.floor((wait%3600000)/60000);
                return await m.reply(`⏳ You already cared for *${user.pet.name}* recently!\nCome back in *${h}h ${mn}m*`);
            }
            if ((user.wallet||0) < CARE_COST) return await m.reply(`❌ Need 🪙*${fmt(CARE_COST)}* to care for your pet.\nYour balance: 🪙*${fmt(user.wallet||0)}*`);
            user.wallet -= CARE_COST;
            user.pet.health    = Math.min(100, (user.pet.health    || 0) + 15);
            user.pet.happiness = Math.min(100, (user.pet.happiness || 0) + 20);
            user.pet.score     = Math.min(100, (user.pet.score     || 0) + 5);
            user.pet.cares     = (user.pet.cares || 0) + 1;
            user.pet.lastCare  = now;
            saveDB(db);
            return await m.reply(
`💖 You cared for ${user.pet.emoji} *${user.pet.name}*!

❤️ Health:    ${user.pet.health}%  (+15)
😊 Happiness: ${user.pet.happiness}%  (+20)
⭐ Score: ${user.pet.score}/100

Cost: 🪙*-${fmt(CARE_COST)}*
Balance: 🪙*${fmt(user.wallet)}*`);
        }

        // ── Rename ────────────────────────────────────────────────────────────
        if (sub === 'rename') {
            if (!user.pet) return await m.reply(`❌ You don't have a pet!`);
            const newName = args.slice(1).join(' ').trim();
            if (!newName) return await m.reply(`Usage: *${bot.prefix}pet rename <name>*`);
            if (newName.length > 20) return await m.reply('❌ Name too long (max 20 chars)');
            if ((user.wallet||0) < RENAME_COST) return await m.reply(`❌ Renaming costs 🪙*${fmt(RENAME_COST)}*\nYou have: 🪙*${fmt(user.wallet||0)}*`);
            user.wallet -= RENAME_COST;
            const oldName = user.pet.name;
            user.pet.name = newName;
            saveDB(db);
            return await m.reply(`✅ Renamed *${oldName}* → *${newName}*!\nCost: 🪙*-${fmt(RENAME_COST)}*`);
        }

        // ── Release ───────────────────────────────────────────────────────────
        if (sub === 'release') {
            if (!user.pet) return await m.reply(`❌ You don't have a pet!`);
            const p = user.pet;
            user.pet    = null;
            user.assets = Math.max(0, (user.assets || 1) - 1);
            saveDB(db);
            return await m.reply(`😢 You released ${p.emoji} *${p.name}*. Goodbye!`);
        }

        return await m.reply(`Unknown option. Use *${bot.prefix}petstore list* or *${bot.prefix}pet care*`);
    }
};

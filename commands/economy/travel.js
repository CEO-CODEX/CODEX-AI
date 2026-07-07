const fs   = require('fs-extra');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'database/economy.json');
const readDb  = () => { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; } };
const saveDb  = (d) => { fs.ensureDirSync(path.dirname(DB_PATH)); fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2)); };

const DESTINATIONS = [
    { name: 'Lagos',      cost: 500,   reward: [200, 1500], desc: 'You travelled to Lagos and hustled hard 🏙️' },
    { name: 'Dubai',      cost: 2000,  reward: [1000, 5000], desc: 'You flew to Dubai and made major deals 🌴' },
    { name: 'New York',   cost: 3000,  reward: [1500, 8000], desc: 'You hit New York and closed big business 🗽' },
    { name: 'Abuja',      cost: 300,   reward: [100, 900],  desc: 'You went to Abuja and got government connections 🏛️' },
    { name: 'London',     cost: 4000,  reward: [2000, 10000], desc: 'You went to London and balled out 🎩' },
    { name: 'Accra',      cost: 800,   reward: [400, 2500], desc: 'You visited Accra and linked with big players 🇬🇭' },
    { name: 'Tokyo',      cost: 5000,  reward: [3000, 12000], desc: 'You explored Tokyo and found hidden opportunities 🗼' },
    { name: 'Port Harcourt', cost: 200, reward: [50, 700],  desc: 'You went to PH and pumped some oil money ⛽' },
];

const COOLDOWN = 2 * 60 * 60 * 1000; // 2 hours

module.exports = {
    name: 'travel',
    aliases: ['trip', 'goto'],
    category: 'economy',
    description: 'Travel to a city and earn coins',

    async execute(bot, m, args) {
        const db  = readDb();
        const uid = m.sender;
        if (!db[uid]) db[uid] = { balance: 0, bank: 0, level: 1, xp: 0, lastTravel: 0 };

        const user = db[uid];
        const now  = Date.now();
        const dest = args[0]?.toLowerCase();

        // Cooldown check
        const timeSince = now - (user.lastTravel || 0);
        if (timeSince < COOLDOWN && !dest?.startsWith('f')) {
            const remaining = COOLDOWN - timeSince;
            const hrs  = Math.floor(remaining / 3600000);
            const mins = Math.floor((remaining % 3600000) / 60000);
            return await m.reply(`✈️ You just came back from a trip!\n\nNext travel available in: *${hrs}h ${mins}m*`);
        }

        // List destinations
        if (!dest || dest === 'list') {
            const list = DESTINATIONS.map((d, i) =>
                `${i+1}. *${d.name}* — Cost: 🪙${d.cost} | Earn: 🪙${d.reward[0]}-${d.reward[1]}`
            ).join('\n');
            return await m.reply(
`✈️ *TRAVEL DESTINATIONS*

${list}

Usage: ${bot.prefix}travel <city name>
Example: ${bot.prefix}travel Lagos

Your balance: 🪙*${user.balance || 0}*`);
        }

        // Find destination
        const found = DESTINATIONS.find(d => d.name.toLowerCase().includes(dest));
        if (!found) {
            return await m.reply(`❌ Unknown destination: *${args.join(' ')}*\n\nUse \`${bot.prefix}travel list\` to see available cities.`);
        }

        // Check balance
        if ((user.balance || 0) < found.cost) {
            return await m.reply(`❌ Not enough coins!\n\nYou need: 🪙*${found.cost}*\nYou have: 🪙*${user.balance || 0}*`);
        }

        // Deduct travel cost
        user.balance = (user.balance || 0) - found.cost;

        // Random outcome — 70% earn, 30% lose extra
        const luck = Math.random();
        let earned, msg;

        if (luck > 0.30) {
            earned = Math.floor(Math.random() * (found.reward[1] - found.reward[0] + 1)) + found.reward[0];
            user.balance += earned;
            user.xp = (user.xp || 0) + 10;
            msg = `${found.desc}\n\n✅ You earned: 🪙*+${earned}*\nTrip cost: 🪙*-${found.cost}*\nNet gain: 🪙*+${earned - found.cost}*`;
        } else {
            const lost = Math.floor(found.cost * (0.3 + Math.random() * 0.5));
            msg = `${found.desc}\n\n❌ Bad luck! You lost an extra 🪙*${lost}* on the trip.\nTrip cost: 🪙*-${found.cost}*\nTotal lost: 🪙*-${found.cost + lost}*`;
            user.balance = Math.max(0, user.balance - lost);
        }

        user.lastTravel = now;
        user.location = found.name;
        db[uid] = user;
        saveDb(db);

        return await m.reply(
`✈️ *TRAVEL — ${found.name.toUpperCase()}*

${msg}

💰 New balance: 🪙*${user.balance}*`);
    }
};

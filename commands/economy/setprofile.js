const { loadDB, saveDB, getUser } = require('../../lib/economyEngine');

const VALID_KEYS = ['name', 'knownas', 'occupation', 'experience'];

const HELP =
`📝 *SETPROFILE USAGE*

Set your profile fields one at a time:

  *.setprofile name=YourName*
  *.setprofile knownas=The Legend*
  *.setprofile occupation=Software Developer*
  *.setprofile experience=3 years*

All 4 fields are optional — set what you want.
View your card with *.profile*`;

module.exports = {
    name: 'setprofile',
    aliases: ['editprofile', 'myprofile'],
    category: 'economy',
    description: 'Set your profile name, known as, occupation and experience',

    async execute(bot, m, args) {
        const raw = args.join(' ').trim();

        if (!raw || !raw.includes('=')) return await m.reply(HELP);

        const eqIdx = raw.indexOf('=');
        const key   = raw.slice(0, eqIdx).trim().toLowerCase().replace(/\s+/g, '');
        const value = raw.slice(eqIdx + 1).trim();

        if (!VALID_KEYS.includes(key)) {
            return await m.reply(`❌ Unknown field: *${key}*\n\nValid fields: *name*, *knownas*, *occupation*, *experience*`);
        }
        if (!value) return await m.reply(`❌ Value cannot be empty.`);
        if (value.length > 60) return await m.reply(`❌ Value too long. Max 60 characters.`);

        const db   = loadDB();
        const user = getUser(db, m.sender);

        // Init profileCard if first time
        if (!user.profileCard) {
            user.profileCard = {};
        }

        // Generate a unique ID only once ever
        if (!user.profileCard.id) {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
            user.profileCard.id = 'CX-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        }

        user.profileCard[key] = value;
        saveDB(db);

        const fieldLabels = { name: 'Name', knownas: 'Known As', occupation: 'Occupation', experience: 'Experience' };
        await m.reply(`✅ *Profile updated!*\n${fieldLabels[key]}: *${value}*\n\nView your full card with *.profile*`);
    }
};

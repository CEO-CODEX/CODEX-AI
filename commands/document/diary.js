
const fs = require('fs');
const path = require('path');

const DIARY_PATH = path.join(process.cwd(), 'database', 'diary.json');

function loadDiary() {
    try { 
        if (fs.existsSync(DIARY_PATH)) return JSON.parse(fs.readFileSync(DIARY_PATH, 'utf8')); 
    } catch {
        // Return empty object on fail
    }
    return {};
}

function saveDiary(data) {
    fs.mkdirSync(path.dirname(DIARY_PATH), { recursive: true });
    fs.writeFileSync(DIARY_PATH, JSON.stringify(data, null, 2));
}

// Simple XOR encryption
function encrypt(text, key) {
    return text.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('');
}

const decrypt = encrypt;

module.exports = {
    name: 'diary',
    aliases: ['journal', 'mydiary', 'dnote'],
    category: 'documents',
    reactions: { start: '⚙️' },
    description: 'Write and read encrypted diary entries.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        const sub = args[0]?.toLowerCase();
        const rest = args.slice(1).join(' ');

        if (sub === 'write') {
            const parts = rest.split('|').map(p => p.trim());
            const password = parts[0];
            const entry = parts.slice(1).join('|').trim();

            if (!password || !entry) {
                return await m.reply(`Usage: ${prefix}diary write <password> | <entry>\nExample: ${prefix}diary write secret123 | Today was a great day!`);
            }

            const diary = loadDiary();
            const phone = (m.sender || '').split('@')[0];
            if (!diary[phone]) diary[phone] = [];

            const encrypted = Buffer.from(encrypt(entry, password)).toString('base64');
            const date = new Date().toISOString().split('T')[0];
            
            diary[phone].push({ date, entry: encrypted });
            saveDiary(diary);

            return await m.reply(`*📔 ENTRY SAVED!*\n\n*Date:* ${date}\n🔒 _Encrypted securely with your password._`);
        }

        if (sub === 'read') {
            const parts = rest.split('|').map(p => p.trim());
            const password = parts[0];
            const date = parts[1];

            if (!password) {
                return await m.reply(`Usage: ${prefix}diary read <password> | <date>\nExample: ${prefix}diary read secret123 | 2026-08-15`);
            }

            const diary = loadDiary();
            const phone = (m.sender || '').split('@')[0];
            const entries = diary[phone] || [];

            let filtered = entries;
            if (date) filtered = entries.filter(e => e.date === date);
            if (!filtered.length) return await m.reply('❌ No entries found for that date.');

            const latest = filtered[filtered.length - 1];
            try {
                const decoded = Buffer.from(latest.entry, 'base64').toString();
                const decrypted = decrypt(decoded, password);
                
                return await m.reply(`*📔 DIARY ENTRY*\n*Date:* ${latest.date}\n\n${decrypted}`);
            } catch (e) {
                return await m.reply('❌ Failed to read entry. Ensure your password is correct.');
            }
        }

        if (sub === 'list') {
            const password = rest.trim();
            if (!password) {
                return await m.reply(`Usage: ${prefix}diary list <password>\nExample: ${prefix}diary list secret123`);
            }

            const diary = loadDiary();
            const phone = (m.sender || '').split('@')[0];
            const entries = diary[phone] || [];

            if (!entries.length) return await m.reply('❌ No diary entries found.');

            let list = '*📔 YOUR DIARY ENTRIES*\n\n';
            entries.forEach((e, i) => {
                try {
                    const decoded = Buffer.from(e.entry, 'base64').toString();
                    const preview = decrypt(decoded, password).substring(0, 30);
                    const cleanPreview = preview.replace(/\n/g, ' '); // Clean linebreaks for the preview
                    
                    list += `*${i + 1}.* 📅 ${e.date}: ${cleanPreview}...\n`;
                } catch {
                    // Ignore entries that fail to decrypt
                }
            });

            return await m.reply(list.trim());
        }

        // Default menu fallback
        const helpText = 
            `*📔 DIARY COMMANDS*\n\n` +
            `*Write:* ${prefix}diary write <password> | <text>\n` +
            `*Read:* ${prefix}diary read <password> | <date>\n` +
            `*List:* ${prefix}diary list <password>`;
            
        return await m.reply(helpText);
    }
};
                  

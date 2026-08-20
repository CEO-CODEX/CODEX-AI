module.exports = { name: 'delpp', aliases: ['removepp', 'deletepp'], category: 'owner', ownerOnly: true, execute: async (sock, m, { reply }) => { try { const profileJid = sock.user?.id || sock.user?.jid || sock.authState?.creds?.me?.id || sock.authState?.creds?.me?.jid;
            if (!profileJid) return reply('Bot profile JID is unavailable.');
            await sock.removeProfilePicture(profileJid); return reply('Profile picture removed successfully.'); } catch (error) { return reply(`Failed to remove profile picture: ${error.message}`); } } };

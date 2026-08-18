const axios = require('axios');

module.exports = {
    name: 'animesearch',
    aliases: ['anisearch', 'findanime'],
    category: 'anime',
    reactions: { start: '🔍', success: '📚' },
    description: 'Search for anime information using AniList.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        const searchQuery = args.join(' ').trim();
        
        if (!searchQuery) {
            return await m.reply(`Usage: ${prefix}animesearch <title>\nExample: ${prefix}animesearch cowboy bebop`);
        }

        try {
            await m.reply(`🔍 Searching AniList for: *${searchQuery}*...`);

            // AniList uses a GraphQL API. We construct our query here to get exactly what we need.
            const graphqlQuery = `
            query ($search: String) {
              Media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
                title {
                  romaji
                  english
                }
                status
                episodes
                genres
                averageScore
                description(asHtml: false)
                coverImage {
                  large
                }
                siteUrl
              }
            }
            `;

            const res = await axios.post('https://graphql.anilist.co', {
                query: graphqlQuery,
                variables: { search: searchQuery }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                timeout: 10000
            });

            const anime = res.data?.data?.Media;

            if (!anime) {
                return await m.reply(`❌ No results found for "${searchQuery}".`);
            }

            // Clean up the titles
            const title = anime.title.english || anime.title.romaji || 'Unknown Title';
            const altTitle = anime.title.english && anime.title.romaji && anime.title.english !== anime.title.romaji 
                ? `_(${anime.title.romaji})_` 
                : '';
                
            // Format data points
            const status = anime.status ? anime.status.replace(/_/g, ' ') : 'N/A';
            const episodes = anime.episodes || 'Unknown';
            const score = anime.averageScore ? `${anime.averageScore}/100` : 'N/A';
            const genres = anime.genres && anime.genres.length > 0 ? anime.genres.join(', ') : 'N/A';
            
            // Clean up description (AniList sometimes leaves <br> tags even with asHtml set to false)
            let description = anime.description || 'No description available.';
            description = description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, ''); 
            if (description.length > 300) description = description.slice(0, 297) + '...';

            // Build a clean, bolded text string
            const text = 
                `*🎬 ${title}*\n${altTitle}\n\n` +
                `*Status:* ${status}\n` +
                `*Episodes:* ${episodes}\n` +
                `*Score:* ${score}\n` +
                `*Genres:* ${genres}\n\n` +
                `*Synopsis:*\n${description}\n\n` +
                `🔗 *Link:* ${anime.siteUrl}`;

            // Send the anime poster with the text as the caption
            if (anime.coverImage && anime.coverImage.large) {
                await bot.sendMessage(m.chat, {
                    image: { url: anime.coverImage.large },
                    caption: text
                }, { quoted: m });
            } else {
                await m.reply(text); // Fallback if image fails
            }

        } catch (err) {
            console.error('[ANIMESEARCH ERROR]', err.message);
            
            // AniList returns a 404 if the search finds absolutely nothing
            if (err.response?.status === 404) {
                return await m.reply(`❌ No results found for "${searchQuery}". Please check your spelling.`);
            }
            
            await m.reply('❌ Failed to fetch anime data. Please try again later.');
        }
    }
};

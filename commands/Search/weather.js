
const axios = require('axios');

// ─── HELPER FUNCTIONS ─────────────────────────────────────────
function getDaySuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1:  return 'st';
        case 2:  return 'nd';
        case 3:  return 'rd';
        default: return 'th';
    }
}

function degToCompass(num) {
    const val = Math.floor((num / 22.5) + 0.5);
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[(val % 16)];
}

module.exports = {
    name: 'weather',
    alias: ['w', 'temp'],
    desc: 'Get comprehensive weather, condition states, and astronomical seasons for a city',
    category: 'Search',

    execute: async (sock, m, { text, args, reply }) => {
        try {
            // ROBUST EXTRACTION: In case your handler doesn't pass 'text' properly, this grabs it manually.
            const rawMsg = m.message?.conversation || m.message?.extendedTextMessage?.text || m.text || '';
            const extractedArgs = rawMsg.trim().split(/ +/).slice(1);
            
            // Check all possible places for the city name
            const query = (text && typeof text === 'string') ? text.trim() : (args ? args.join(' ') : extractedArgs.join(' '));

            if (!query) {
                return reply(
                    `✘ Usage: .weather <city>\n\n` +
                    `Example:\n` +
                    `• .weather Lagos`
                );
            }

            // Start processing reaction
            await sock.sendMessage(m.chat, { react: { text: '☀', key: m.key } });

            // ─── STEP 1: GEOCODING SEARCH ─────────────────────────────
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
            const geoResp = await axios.get(geoUrl, { timeout: 15000 });
            const location = geoResp.data?.results?.[0];

            if (!location) {
                await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } });
                return reply(`✘ City not found: ${query}`);
            }

            const cityName = location.name;
            const region   = location.admin1 || 'N/A';
            const country  = location.country || 'N/A';
            const lat      = parseFloat(location.latitude);
            const lon      = parseFloat(location.longitude);
            const timezone = location.timezone || 'UTC';

            // ─── STEP 2: METEOROLOGICAL FETCH ─────────────────────────
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,uv_index,visibility,dew_point_2m&timezone=${encodeURIComponent(timezone)}`;
            const weatherResp = await axios.get(weatherUrl, { timeout: 15000 });
            const cur = weatherResp.data?.current;

            if (!cur) {
                await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } });
                return reply(`✘ Failed to extract weather conditions for ${cityName}.`);
            }

            // ─── STEP 3: DYNAMIC DATE & TIMEZONE CALCULATIONS ─────────
            const now = new Date();
            const localYear  = parseInt(now.toLocaleDateString('en-US', { timeZone: timezone, year: 'numeric' }));
            const localMonth = parseInt(now.toLocaleDateString('en-US', { timeZone: timezone, month: 'numeric' })) - 1; 
            const rawDate    = parseInt(now.toLocaleDateString('en-US', { timeZone: timezone, day: 'numeric' }));

            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const currentMonth = monthNames[localMonth];
            const formattedDayStr = `${rawDate}${getDaySuffix(rawDate)}`;

            const dayOfWeekStr = now.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' });
            const weekdayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
            const dayOfWeek = weekdayMap[dayOfWeekStr];
            const weekOfMonthNum = Math.ceil((rawDate + 6 - dayOfWeek) / 7);

            const weekOrdinals = ["First", "Second", "Third", "Fourth", "Fifth"];
            const weekString = weekOrdinals[weekOfMonthNum - 1] || `${weekOfMonthNum}th`;

            const localTime = now.toLocaleTimeString('en-US', { 
                timeZone: timezone,
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit', 
                hour12: true 
            });

            // ─── STEP 4: MASTER WEATHER CONDITION MAPPER ──────────────
            const wmocode = cur.weather_code;
            let condition = 'Clear Sky ☀';

            const weatherMap = {
                0: 'Clear Sky ☀', 1: 'Mainly Clear 🌤', 2: 'Partly Cloudy ⛅', 3: 'Overcast / Cloudy ☁',
                45: 'Foggy Weather 🌫', 48: 'Depositing Rime Fog 🌫🥶',
                51: 'Light Drizzle 🌧', 53: 'Moderate Drizzle 🌧', 55: 'Dense Drizzle 🌧🌧',
                56: 'Light Freezing Drizzle 🥶🌧', 57: 'Dense Freezing Drizzle 🥶🌧',
                61: 'Slight Rain 🌦', 63: 'Moderate Rain 🌧', 65: 'Heavy Rain ⛈🌧',
                66: 'Light Freezing Rain 🥶🌦', 67: 'Heavy Freezing Rain 🥶🌧',
                71: 'Slight Snow Fall 🌨❄', 73: 'Moderate Snow Fall 🌨❄', 75: 'Heavy Snow Fall 🪟❄',
                77: 'Snow Grains 🌨',
                80: 'Slight Rain Showers 🌦', 81: 'Moderate Rain Showers 🌧', 82: 'Violent Rain Showers ⛈',
                85: 'Slight Snow Showers 🌨', 86: 'Heavy Snow Showers 🌨❄',
                95: 'Thunderstorm ⛈', 96: 'Thunderstorm with Slight Hail ⛈⚡', 99: 'Severe Thunderstorm with Heavy Hail ⛈🌪'
            };
            if (weatherMap[wmocode]) condition = weatherMap[wmocode];

            // Build dynamic condition matrix text strings 
            let fullMatrixStr = "";
            Object.entries(weatherMap).forEach(([code, name]) => {
                const pointer = parseInt(code) === wmocode ? " 👉 " : " ▫ ";
                fullMatrixStr += `${pointer}Code ${code.padEnd(2, ' ')}: ${name}\n`;
            });

            // ─── STEP 5: MASTER GLOBAL SEASON CALCULATOR ──────────────
            let season = 'Unknown 🗺';
            const month1Based = localMonth + 1;

            if (Math.abs(lat) <= 23.5) {
                if (lat >= 0) {
                    if (month1Based >= 4 && month1Based <= 10) season = 'Rainy Season 🌧⛈';
                    else season = 'Dry / Harmattan Season 🌾🍂';
                } else {
                    if (month1Based >= 11 || month1Based <= 4) season = 'Rainy Season 🌧⛈';
                    else season = 'Dry Season 🪵☀️';
                }
            } else {
                if (lat > 23.5) {
                    if (month1Based === 12 || month1Based === 1 || month1Based === 2) season = 'Winter Season ❄🥶';
                    else if (month1Based >= 3 && month1Based <= 5) season = 'Spring Season 🌱🌸';
                    else if (month1Based >= 6 && month1Based <= 8) season = 'Summer Season ☀️🏖';
                    else if (month1Based >= 9 && month1Based <= 11) season = 'Autumn / Fall 🍂🍁';
                } else if (lat < -23.5) {
                    if (month1Based === 12 || month1Based === 1 || month1Based === 2) season = 'Summer Season ☀️🏖';
                    else if (month1Based >= 3 && month1Based <= 5) season = 'Autumn / Fall 🍂🍁';
                    else if (month1Based >= 6 && month1Based <= 8) season = 'Winter Season ❄🥶';
                    else if (month1Based >= 9 && month1Based <= 11) season = 'Spring Season 🌱🌸';
                }
            }

            // ─── STEP 6: FORMAT DATA AND SEND MESSAGE ─────────────────
            const tempC    = cur.temperature_2m;
            const tempF    = ((tempC * 9/5) + 32).toFixed(1);
            const feelsC   = cur.apparent_temperature;
            const feelsF   = ((feelsC * 9/5) + 32).toFixed(1);
            const humid    = cur.relative_humidity_2m + '%';
            const wind     = cur.wind_speed_10m + ' km/h';
            const windDir  = degToCompass(cur.wind_direction_10m);
            const pressure = cur.pressure_msl + ' hPa';
            const cloud    = cur.cloud_cover + '%';
            const vis      = (cur.visibility / 1000).toFixed(1) + ' km';
            const dew      = cur.dew_point_2m + '°C';
            const precip   = cur.precipitation + ' mm';
            const uv       = cur.uv_index;
            const isDay    = cur.is_day === 1 ? '☼ Day' : '☾ Night';

            // Success reaction
            await sock.sendMessage(m.chat, { react: { text: '☼', key: m.key } });

            // EXACT ORIGINAL DESIGN
            await reply(
                `彡 WEATHER FORECAST\n` +
                `⎙  ${formattedDayStr} ${currentMonth} ${localYear} • [ ${weekString} Week ]\n\n` +
                `☯︎ Location  : ${cityName}\n` +
                `☙ Region    : ${region}, ${country}\n` +
                `❂ Coords    : ${lat}°, ${lon}°\n` +
                `𝌆 Time      : ${localTime}\n` +
                `♧ Period    : ${isDay}\n` +
                `🍂 Season    : ${season}\n\n` +
                `☁ Condition : ${condition}\n` +
                `✲ Temp      : ${tempC}°C / ${tempF}°F\n` +
                `☽ Feels     : ${feelsC}°C / ${feelsF}°F\n` +
                `❈ Dew Point : ${dew}\n` +
                `≋ Humidity  : ${humid}\n` +
                `☇ Wind      : ${wind} (${windDir})\n` +
                `⌂ Visibility: ${vis}\n` +
                `☁ Cloud     : ${cloud}\n` +
                `⌘ Pressure  : ${pressure}\n` +
                `☯︎ Precip    : ${precip}\n` +
                `☙ UV Index  : ${uv}\n\n` +
                `☛⃠ *GLOBAL RADAR MATRIX (ALL STATES):*\n` +
                `${fullMatrixStr}\n` +
                `─ · · · · · · · · · · · · · · · · · · ─\n` +
                `☯︎   Powered by C☯︎DEX`
            );

        } catch (err) {
            await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } });
            console.error('[WEATHER COMMAND ERROR]', err);
            await reply(`◈ Weather fetch failed: ${err.message || err}`);
        }
    }
};

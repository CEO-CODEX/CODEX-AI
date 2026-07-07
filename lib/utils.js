const fs = require('fs-extra');

class Utils {
    static formatUptime(seconds) {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    }

    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static readDB(file) {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {
            return {};
        }
    }

    static writeDB(file, data) {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }

    /**
     * getVar(bot, key, defaultValue)
     * Reads a runtime variable off the live bot.config object (which already
     * has database/variables.json merged into it at boot, and is updated live
     * by .setvar / dedicated toggle commands like .aibadge). Coerces common
     * truthy/falsy string forms ("on"/"off", "true"/"false", "1"/"0") to a
     * real boolean. Falls back to defaultValue when unset.
     */
    static getVar(bot, key, defaultValue) {
        const v = bot?.config?.[key];
        if (v === undefined || v === null || v === '') return defaultValue;
        if (v === true  || v === 'true'  || v === 'on'  || v === 1 || v === '1') return true;
        if (v === false || v === 'false' || v === 'off' || v === 0 || v === '0') return false;
        return v;
    }
}

module.exports = Utils;

// Also export static methods directly for destructured imports
module.exports.formatUptime = Utils.formatUptime;
module.exports.formatBytes  = Utils.formatBytes;
module.exports.getVar       = Utils.getVar;

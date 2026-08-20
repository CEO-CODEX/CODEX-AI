const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(process.cwd(), 'database', 'anticall.json');
const defaultConfig = {
  enabled: false,
  reason: '📵 Calls are not permitted.',
  unknownReason: '📵 Unknown numbers cannot call this account.',
  schedule: { enabled: false, type: 'always', start: '22:00', end: '06:00', days: [], dates: [], months: [] },
  blacklist: [],
  whitelist: [],
  pendingPhoneReject: [],
};

function cloneDefaults() { return JSON.parse(JSON.stringify(defaultConfig)); }
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return mergeConfig(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
  } catch (_) {}
  return cloneDefaults();
}
function mergeConfig(value = {}) {
  const base = cloneDefaults();
  return { ...base, ...value, schedule: { ...base.schedule, ...(value.schedule || {}) }, blacklist: Array.isArray(value.blacklist) ? value.blacklist : [], whitelist: Array.isArray(value.whitelist) ? value.whitelist : [], pendingPhoneReject: Array.isArray(value.pendingPhoneReject) ? value.pendingPhoneReject : [] };
}
function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(mergeConfig(config), null, 2));
}
function normalizeJid(jid) { return String(jid || '').trim().toLowerCase().replace(/:\d+(@|$)/, '$1'); }
function isInList(jid, list) { const value = normalizeJid(jid); return list.some(item => normalizeJid(item) === value); }
function isInBlacklist(jid, list) { return isInList(jid, list); }
function isInWhitelist(jid, list) { return isInList(jid, list); }
function isWithinSchedule(schedule) {
  if (!schedule?.enabled) return true;
  const now = new Date();
  if (schedule.type === 'once') return now >= new Date(schedule.start) && now <= new Date(schedule.end);
  const [sh, sm] = String(schedule.start || '00:00').split(':').map(Number);
  const [eh, em] = String(schedule.end || '23:59').split(':').map(Number);
  const current = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm; const end = eh * 60 + em;
  const inTime = end >= start ? current >= start && current <= end : current >= start || current <= end;
  return inTime && (!schedule.days?.length || schedule.days.includes(now.getDay())) && (!schedule.dates?.length || schedule.dates.includes(now.getDate())) && (!schedule.months?.length || schedule.months.includes(now.getMonth()));
}
function findLidForPhone(phone) {
  try {
    const dir = path.join(process.cwd(), 'sessions');
    for (const file of fs.readdirSync(dir).filter(name => name.startsWith('lid-mapping'))) {
      const map = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      for (const [lid, jid] of Object.entries(map)) if (String(jid).includes(String(phone))) return lid;
    }
  } catch (_) {}
  return null;
}
function toJid(input) { const value = String(input || '').trim(); if (!value) return ''; if (/^\d+$/.test(value)) return findLidForPhone(value) || `${value}@s.whatsapp.net`; return value; }
function resolveAction(call, config) {
  const jid = normalizeJid(call.from);
  if (isInList(jid, config.whitelist)) return { action: 'allow', reason: 'whitelist' };
  if (isInList(jid, config.blacklist)) return { action: 'block', reason: 'blacklist' };
  if (config.schedule.enabled && !isWithinSchedule(config.schedule)) return { action: 'allow', reason: 'outside-schedule' };
  if (!config.enabled) return { action: 'reject', reason: 'global-off' };
  return { action: config.mode === 'block' ? 'block' : 'reject', reason: 'unknown' };
}
module.exports = { CONFIG_PATH, defaultConfig, loadConfig, saveConfig, normalizeJid, isInBlacklist, isInWhitelist, isWithinSchedule, findLidForPhone, toJid, resolveAction };

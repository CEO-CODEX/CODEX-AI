const { loadDB, saveDB, getUser, fmt, onCooldown, setCooldown, addXP } = require('./economyEngine');

function runAdventure(m, { key, label, cost = 0, reward = [500, 2000], cooldown = 15 * 60 * 1000, risk = 0.25, xp = 25, text }) {
  const db = loadDB(); const user = getUser(db, m.sender); const left = onCooldown(user, key, cooldown);
  if (left) return m.reply(`Cooldown active: ${Math.ceil(left / 60000)} minutes remaining.`);
  if ((user.wallet || 0) < cost) return m.reply(`You need ${fmt(cost)} coins.`);
  user.wallet -= cost; user.stats.spent = (user.stats.spent || 0) + cost; setCooldown(user, key);
  const won = Math.random() >= risk;
  if (won) { const amount = Math.floor(Math.random() * (reward[1] - reward[0] + 1)) + reward[0]; user.wallet += amount; user.stats.earned = (user.stats.earned || 0) + amount; addXP(user, xp); saveDB(db); return m.reply(`${label}\n${text || 'Operation completed.'}\nReward: ${fmt(amount)} coins.`); }
  saveDB(db); return m.reply(`${label}\nThe operation failed. Cost lost: ${fmt(cost)} coins.`);
}
module.exports = { runAdventure };

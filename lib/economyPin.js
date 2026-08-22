const crypto = require('crypto');

function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

function normalizePin(pin) {
  return /^\d{4,8}$/.test(String(pin || '')) ? String(pin) : null;
}

function setPin(user, pin) {
  const normalized = normalizePin(pin);
  if (!normalized) return false;
  user.pinHash = hashPin(normalized);
  return true;
}

function verifyPin(user, pin) {
  const normalized = normalizePin(pin);
  return Boolean(user.pinHash && normalized && hashPin(normalized) === user.pinHash);
}

function requirePin(user, pin) {
  if (!user.pinHash) return { ok: false, message: 'Set your economy PIN first with *.setpin <4-8 digits>*.' };
  if (!verifyPin(user, pin)) return { ok: false, message: 'Invalid PIN. Usage: *.command <amount> <PIN>*.' };
  return { ok: true };
}

module.exports = { hashPin, normalizePin, setPin, verifyPin, requirePin };

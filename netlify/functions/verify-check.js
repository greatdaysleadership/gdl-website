// Validates a Snapshot magic-link token (HMAC signature + 24 hour expiry).
const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  const pass = process.env.VERIFY_SMTP_PASS;
  const secret = process.env.VERIFY_SIGNING_SECRET || pass;
  const vt = (event.queryStringParameters || {}).vt || '';

  const invalid = { statusCode: 200, headers, body: JSON.stringify({ valid: false }) };
  if (!secret || vt.indexOf('.') === -1) return invalid;

  const parts = vt.split('.');
  const payload = parts[0];
  const sig = parts[1];
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  let ok = false;
  try {
    ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch (e) { ok = false; }
  if (!ok) return invalid;

  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch (e) { return invalid; }
  if (!data || typeof data.x !== 'number' || Date.now() > data.x) {
    return { statusCode: 200, headers, body: JSON.stringify({ valid: false, expired: true }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ valid: true, email: data.e }) };
};

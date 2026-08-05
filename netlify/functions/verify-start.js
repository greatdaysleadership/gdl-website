// Sends the Snapshot magic link. If SMTP is not configured, reports
// enabled:false and the page shows results instantly (the pre-gate behavior).
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const FREE_DOMAINS = ['gmail.com','googlemail.com','yahoo.com','ymail.com','hotmail.com','outlook.com','live.com','msn.com','icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','pm.me','gmx.com','gmx.net','mail.com','zoho.com','yandex.com','comcast.net','att.net','verizon.net','sbcglobal.net','bellsouth.net','charter.net','cox.net','earthlink.net'];

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method-not-allowed' }) };
  }

  const user = process.env.VERIFY_SMTP_USER;
  const pass = process.env.VERIFY_SMTP_PASS;
  const secret = process.env.VERIFY_SIGNING_SECRET || pass;
  if (!user || !pass) {
    return { statusCode: 200, headers, body: JSON.stringify({ enabled: false }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim().slice(0, 100);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ enabled: true, error: 'invalid-email' }) };
  }
  if (FREE_DOMAINS.includes(email.split('@')[1])) {
    return { statusCode: 400, headers, body: JSON.stringify({ enabled: true, error: 'free-domain' }) };
  }

  const exp = Date.now() + 24 * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ e: email, x: exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const link = 'https://greatdaysleadership.com/assessment.html?vt=' + payload + '.' + sig;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: '"Great Days Leadership" <' + user + '>',
    to: email,
    subject: 'Your Great Days Index Snapshot results',
    text: (name ? name + ' - ' : '') + 'Your Snapshot is ready. Open this link on the device where you completed it to see your results:\n\n' + link + '\n\nThe link works for 24 hours.\n\nGreat Days Leadership\ngreatdaysleadership.com'
  });

  return { statusCode: 200, headers, body: JSON.stringify({ enabled: true, sent: true }) };
};

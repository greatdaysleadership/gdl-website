// Sends the Snapshot email: the magic link plus the Snapshot as a PDF attachment.
// If SMTP is not configured, reports enabled:false and the page shows results
// instantly (the pre-gate behavior).
//
// The PDF is scored here from the raw answers with the same code the page uses
// (assets/snapshot-core.js), so the only free text that reaches the PDF is the
// visitor's own name and organization, length-capped. If anything about the PDF
// fails, the email still goes out with the link alone. A visitor must never lose
// their results because of the attachment.
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const core = require('../../assets/snapshot-core.js');
const { buildSnapshotPdf, fileName } = require('../lib/snapshot-pdf');

const FREE_DOMAINS = ['gmail.com','googlemail.com','yahoo.com','ymail.com','hotmail.com','outlook.com','live.com','msn.com','icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','pm.me','gmx.com','gmx.net','mail.com','zoho.com','yandex.com','comcast.net','att.net','verizon.net','sbcglobal.net','bellsouth.net','charter.net','cox.net','earthlink.net'];

const oneLine = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, max);

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
  const name = oneLine(body.name, 100);
  const organization = oneLine(body.organization, 120);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ enabled: true, error: 'invalid-email' }) };
  }
  if (FREE_DOMAINS.includes(email.split('@')[1])) {
    return { statusCode: 400, headers, body: JSON.stringify({ enabled: true, error: 'free-domain' }) };
  }

  const exp = Date.now() + 24 * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ e: email, x: exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const link = 'https://greatdaysleadership.com/assessment?vt=' + payload + '.' + sig;

  // Build the PDF. Any failure here falls back to the link-only email.
  let attachment = null;
  try {
    const answers = (body.answers && typeof body.answers === 'object') ? body.answers : null;
    const result = answers ? core.score(answers, core.normalizeState(body.state)) : null;
    if (result) {
      const date = new Date();
      const contact = { name, organization, email };
      const pdf = await buildSnapshotPdf(result, { mode: 'customer', contact, date });
      attachment = { filename: fileName(contact, date), content: pdf.buffer, contentType: 'application/pdf' };
    }
  } catch (e) {
    attachment = null;
  }

  const greeting = name ? name + ' - ' : '';
  const text = attachment
    ? greeting + 'Your Great Days Index Snapshot is attached as a PDF.\n\n' +
      'To see it on our site as well, open this link on the device where you completed it. The link works for 24 hours.\n\n' +
      link + '\n\n' +
      'If you would like to talk through what it shows, reply to this email.\n\n' +
      'Great Days Leadership\ngreatdaysleadership.com'
    : greeting + 'Your Snapshot is ready. Open this link on the device where you completed it to see your results:\n\n' +
      link + '\n\nThe link works for 24 hours.\n\nGreat Days Leadership\ngreatdaysleadership.com';

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: '"Great Days Leadership" <' + user + '>',
    replyTo: 'info@greatdaysleadership.com',
    to: email,
    subject: 'Your Great Days Index Snapshot results',
    text,
    attachments: attachment ? [attachment] : []
  });

  return { statusCode: 200, headers, body: JSON.stringify({ enabled: true, sent: true, pdf: !!attachment }) };
};

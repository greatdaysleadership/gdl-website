// Emails a completed Snapshot straight to the team.
//
// This exists because Netlify Forms runs every submission through a spam filter.
// In August 2026 that filter silently classified every Snapshot as spam for five
// days, including a real lead, and nobody was notified. Netlify Forms is still
// the searchable record and CSV export. This path is the one that cannot be
// intercepted.
//
// The recipient is hardcoded, so this endpoint cannot be used to send mail to
// anyone else. Fields are length-capped so an oversized post cannot be relayed.
//
// The team copy of the Snapshot PDF is attached when the page sends the raw
// answers. It is scored here with the same code the page uses. If the PDF
// fails for any reason, the lead email still goes out without it.
const nodemailer = require('nodemailer');
const core = require('../../assets/snapshot-core.js');
const { buildSnapshotPdf, fileName } = require('../lib/snapshot-pdf');

const TO = 'info@greatdaysleadership.com';
const MAX = 4000;

const clean = (v) => String(v == null ? '' : v).slice(0, MAX);

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method-not-allowed' }) };
  }

  const user = process.env.VERIFY_SMTP_USER;
  const pass = process.env.VERIFY_SMTP_PASS;
  if (!user || !pass) {
    return { statusCode: 200, headers, body: JSON.stringify({ sent: false, reason: 'smtp-not-configured' }) };
  }

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { b = {}; }

  const email = clean(b.email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ sent: false, reason: 'invalid-email' }) };
  }

  const name = clean(b.name).trim();
  const org = clean(b.organization).trim();
  const phone = clean(b.phone).trim();

  const lines = [
    'A Snapshot was just completed.',
    '',
    'Name:          ' + (name || '(not given)'),
    'Organization:  ' + (org || '(not given)'),
    'Email:         ' + email,
    'Phone:         ' + (phone || '(not given)'),
    'Email status:  ' + (clean(b.verified).trim() || 'unknown'),
    '',
    'First move:    ' + clean(b['first-move']).trim(),
    '',
    'Levers',
    '  ' + clean(b.levers).trim(),
    '',
    'Dimensions',
    '  ' + clean(b.dimensions).trim(),
    '',
    'Profile',
    '  ' + clean(b.profile).trim(),
    '',
    '---',
    'Sent directly by the site so it cannot be lost to spam filtering.',
    'The same submission is also recorded in Netlify Forms under gdi-snapshot.'
  ];

  let attachment = null;
  try {
    const snap = b.snapshot && typeof b.snapshot === 'object' ? b.snapshot : null;
    const state = snap ? core.normalizeState(snap.state) : null;
    const result = snap && snap.answers && typeof snap.answers === 'object' ? core.score(snap.answers, state) : null;
    if (result) {
      const date = new Date();
      const contact = { name: name.slice(0, 100), organization: org.slice(0, 120), email, phone: phone.slice(0, 40) };
      const pdf = await buildSnapshotPdf(result, {
        mode: 'team', contact, state, date, verified: clean(b.verified).trim().slice(0, 40) || 'unknown'
      });
      attachment = { filename: fileName(contact, date), content: pdf.buffer, contentType: 'application/pdf' };
    }
  } catch (e) {
    attachment = null;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass }
  });

  try {
    await transporter.sendMail({
      from: '"Great Days Index Snapshot" <' + user + '>',
      to: TO,
      replyTo: email,
      subject: 'Snapshot completed: ' + (name || email) + (org ? ' (' + org + ')' : ''),
      text: lines.join('\n'),
      attachments: attachment ? [attachment] : []
    });
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ sent: false, reason: 'send-failed' }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ sent: true }) };
};

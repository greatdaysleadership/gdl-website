// Builds the one-page Great Days Index Snapshot PDF.
//
// Two versions from one layout:
//   customer - goes to the person who completed the Snapshot. No contact details,
//              no profile tags, adds the one-leader's-view note and a next step.
//   team     - goes to info@ with the lead email. Profile tags and contact
//              details on top, the same as the hand-built internal Snapshots.
//
// Scores come from assets/snapshot-core.js, the same code the page uses.
const PDFDocument = require('pdfkit');
const A = require('./snapshot-assets');

const C = {
  navy: '#0F3C61', orange: '#F68623', orangeDeep: '#C2571B',
  ink: '#2A343C', grey: '#57636E', greySoft: '#8A97A0',
  mist: '#F2F6F9', line: '#E3E9EE', paleOnNavy: '#C9D6E0'
};

const PAGE_W = 612, PAGE_H = 792, M = 54, W = PAGE_W - 2 * M;

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function longDate(d) {
  return d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' });
}

// Profile values arrive as the prequal radio codes; these turn them into tag text.
const TAGS = {
  orgtype: { business: 'Business', highered: 'Education', nonprofit: 'Nonprofit', other: 'Other org type' },
  role: { ceo: 'CEO / President / ED', founder: 'Founder / Owner', exec: 'C-suite / VP', dir: 'Director / Manager', board: 'Board member' },
  headcount: { u25: 'Under 25 people', '25-100': '25–100 people', '100-500': '100–500 people', '500+': '500+ people' },
  board: { yes: 'Has a board', no: 'No board' },
  ownerled: { yes: 'Owner-led', no: 'Not owner-led' },
  priorfirm: { current: 'Prior firm: current', past: 'Prior firm: past', never: 'Prior firm: never' },
  timing: { active: 'Actively working on it', exploring: 'Exploring', curious: 'Just curious' }
};
function profileTags(state) {
  const out = [];
  ['orgtype', 'role', 'headcount', 'board', 'ownerled', 'priorfirm', 'timing'].forEach((k) => {
    const v = state && state[k];
    if (!v) return;
    const label = (TAGS[k] && TAGS[k][v]) || String(v).replace(/[-_]/g, ' ');
    out.push(label.slice(0, 40));
  });
  return out;
}

// Curly quotes and apostrophes for print. The site copy uses straight ones.
function smart(s) {
  return String(s)
    .replace(/(^|[\s(\[])"/g, '$1“').replace(/"/g, '”')
    .replace(/(^|[\s(\[])'/g, '$1‘').replace(/'/g, '’');
}

// The footer rule sits at 734pt. Long organization names, wrapped profile tags,
// and nine dimensions can push the page past it, so the layout is drawn once at
// normal spacing and, if it would collide, once more at tight spacing.
const FOOTER_LIMIT = 718;
async function buildSnapshotPdf(result, opts) {
  const first = await drawSnapshotPdf(result, opts, false);
  if (first.contentBottom <= FOOTER_LIMIT) return first;
  return drawSnapshotPdf(result, opts, true);
}

function drawSnapshotPdf(result, opts, tight) {
  const mode = opts.mode === 'team' ? 'team' : 'customer';
  const contact = opts.contact || {};
  const date = opts.date || new Date();

  const doc = new PDFDocument({
    size: 'LETTER', margin: 0, font: Buffer.from(A.latoRegular, 'base64'),
    info: {
      Title: 'Great Days Index Snapshot' + (contact.organization ? ' – ' + contact.organization : ''),
      Author: 'Great Days Leadership', Creator: 'Great Days Leadership', Producer: 'Great Days Leadership'
    }
  });
  doc.registerFont('sans', Buffer.from(A.latoRegular, 'base64'));
  doc.registerFont('bold', Buffer.from(A.latoBold, 'base64'));
  doc.registerFont('italic', Buffer.from(A.latoItalic, 'base64'));
  doc.registerFont('serif', Buffer.from(A.serif, 'base64'));

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const caps = (text, x, y, o) => {
    doc.font(o.font || 'bold').fontSize(o.size || 8).fillColor(o.color || C.navy)
      .text(text.toUpperCase(), x, y, Object.assign({ characterSpacing: o.spacing == null ? 1.6 : o.spacing, lineBreak: false }, o.textOpts || {}));
  };
  const rule = (y) => { doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.75).strokeColor(C.line).stroke(); };
  const chip = (label, hex, x, y, w, h) => {
    doc.rect(x, y, w, h).fill(hex);
    doc.font('bold').fontSize(6.6).fillColor('#FFFFFF');
    const t = label.toUpperCase();
    const tw = doc.widthOfString(t, { characterSpacing: 0.8 });
    doc.text(t, x + (w - tw) / 2, y + (h - 6.6) / 2 + 0.4, { characterSpacing: 0.8, lineBreak: false });
  };

  const dims = result.sorted;
  const many = dims.length > 7;
  let y = 46;

  // Running header
  caps(mode === 'team' ? 'Internal · Great Days Index Snapshot' : 'Great Days Index Snapshot', M, y, { color: C.orange, spacing: 1.8, size: 8.2 });
  const rightHdr = (mode === 'team' ? 'Submitted ' : 'Completed ') + longDate(date);
  doc.font('sans').fontSize(8.2);
  const rw = doc.widthOfString(rightHdr.toUpperCase(), { characterSpacing: 1.4 });
  caps(rightHdr, M + W - rw, y, { font: 'sans', color: C.grey, spacing: 1.4, size: 8.2 });
  y += 16; rule(y); y += 14;

  // Title block
  const title = (contact.organization || contact.name || 'Your organization').slice(0, 90);
  doc.font('serif').fontSize(27).fillColor(C.navy).text(title, M, y, { width: W, lineGap: 0 });
  y = doc.y + 3;
  const who = contact.name ? contact.name : 'one leader';
  const lede = mode === 'team'
    ? 'One leader\'s read of the leadership system, submitted by ' + who + ' from the website Snapshot.'
    : 'One leader\'s read of the leadership system, completed by ' + who + '.';
  doc.font('italic').fontSize(10.5).fillColor(C.grey).text(smart(lede), M, y, { width: W });
  y = doc.y + 8;

  if (mode === 'team') {
    let tx = M;
    doc.font('bold').fontSize(6.6);
    profileTags(opts.state).forEach((t) => {
      const tw = doc.widthOfString(t.toUpperCase(), { characterSpacing: 0.6 }) + 14;
      if (tx + tw > M + W) { tx = M; y += 22; }
      doc.rect(tx, y, tw, 16).fill(C.mist);
      doc.font('bold').fontSize(6.6).fillColor(C.navy).text(t.toUpperCase(), tx + 7, y + 5, { characterSpacing: 0.6, lineBreak: false });
      tx += tw + 6;
    });
    y += 26;
    doc.font('sans').fontSize(9.5).fillColor(C.grey).text('Email ', M, y, { continued: true })
      .font('bold').fillColor(C.navy).text(contact.email || '', { continued: !!contact.phone });
    if (contact.phone) doc.font('sans').fillColor(C.grey).text('      Phone ', { continued: true }).font('bold').fillColor(C.navy).text(contact.phone);
    y = doc.y + 4;
    if (opts.verified) {
      doc.font('italic').fontSize(8).fillColor(C.greySoft).text('Email verification: ' + opts.verified + '.', M, y);
      y = doc.y;
    }
    y += 6;
  }
  rule(y); y += 14;

  // Three levers
  caps('The three levers', M, y, { color: C.navy, spacing: 1.8, size: 8.2 });
  const legend = 'Scores run 1 to 5. 4.25 and up strong · 3.25 to 4.24 strained · under 3.25 needs attention.';
  doc.font('italic').fontSize(8).fillColor(C.grey).text(legend, M + 150, y + 0.5, { width: W - 150, align: 'right', lineBreak: false });
  y += 18;
  const gap = 13, cw = (W - 2 * gap) / 3, ch = tight ? 118 : 128;
  result.levers.forEach((lv, i) => {
    const x = M + i * (cw + gap);
    doc.rect(x, y, cw, ch).lineWidth(0.75).strokeColor(C.line).stroke();
    doc.font('serif').fontSize(24).fillColor(C.navy).text(lv.avg.toFixed(2), x + 12, y + 12, { lineBreak: false });
    doc.font('bold').fontSize(6.6);
    const lbl = lv.band.label.toUpperCase();
    const chw = doc.widthOfString(lbl, { characterSpacing: 0.8 }) + 12;
    chip(lv.band.label, lv.band.hex, x + cw - 12 - chw, y + 17, chw, 15);
    caps(lv.name, x + 12, y + (tight ? 42 : 46), { color: C.navy, spacing: 1.6, size: 8 });
    doc.font('sans').fontSize(8.6).fillColor(C.grey).text(smart(lv.read), x + 12, y + (tight ? 55 : 60), { width: cw - 24, lineGap: 1.2 });
    const gy = y + ch - 26, gw = cw - 24;
    doc.rect(x + 12, gy, gw, 5).fill(C.mist);
    doc.rect(x + 12, gy, gw * Math.max(0, Math.min(1, lv.avg / 5)), 5).fill(lv.band.hex);
    doc.font('sans').fontSize(6.5).fillColor(C.greySoft).text('1', x + 12, gy + 9, { lineBreak: false });
    doc.text('5', x + 12 + gw - doc.widthOfString('5'), gy + 9, { lineBreak: false });
  });
  y += ch + (tight ? 11 : 14); rule(y); y += tight ? 11 : 14;

  // Dimensions, lowest first
  const n = dims.length;
  const word = NUMBER_WORDS[n] || String(n);
  caps(word + ' dimensions, lowest read first', M, y, { color: C.navy, spacing: 1.8, size: 8.2 });
  const summary = mode === 'team' ? result.summary.replace('your first move', 'the first move') : result.summary;
  doc.font('italic').fontSize(8).fillColor(C.grey).text(summary, M + 250, y + 0.5, { width: W - 250, align: 'right', lineGap: 1 });
  y = Math.max(y + 18, doc.y + 6);
  const rh = tight ? 17.5 : (many ? 19 : 22);
  dims.forEach((d) => {
    doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font('sans').fontSize(10.2).fillColor(C.ink).text(d.name, M, y + (rh - 10.2) / 2, { lineBreak: false });
    const sc = d.avg.toFixed(2);
    doc.font('sans').fontSize(10).fillColor(C.grey);
    doc.text(sc, M + W - 110 - 18 - doc.widthOfString(sc), y + (rh - 10) / 2, { lineBreak: false });
    chip(d.band.label, d.band.hex, M + W - 110, y + (rh - 13) / 2, 110, 13);
    y += rh;
  });
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor(C.line).stroke();
  y += tight ? 12 : 16;

  // First move panel
  const t = result.target;
  const fmBody = smart(t.read) + ' This came back as ' + (mode === 'team' ? 'the' : 'your') +
    ' lowest read, which usually means it is quietly taxing everything else. The engagement built for this moment is ';
  const tx0 = M + 62, tw0 = W - 62 - 22;
  doc.font('sans').fontSize(9.2);
  const bodyH = doc.heightOfString(fmBody + t.eng.name + '.', { width: tw0, lineGap: 2 });
  const showLink = mode === 'customer';
  const fmH = 18 + 12 + 24 + bodyH + (showLink ? 18 : 0) + (tight ? 12 : 16);
  doc.rect(M, y, W, fmH).fill(C.navy);
  // arrow
  const ay = y + 38;
  doc.moveTo(M + 22, ay).lineTo(M + 42, ay).lineWidth(1.4).strokeColor(C.orange).stroke();
  doc.moveTo(M + 36, ay - 5).lineTo(M + 42, ay).lineTo(M + 36, ay + 5).lineWidth(1.4).strokeColor(C.orange).stroke();
  caps(mode === 'team' ? 'First move' : 'Your first move', tx0, y + 18, { color: C.orange, spacing: 1.8, size: 8 });
  doc.font('serif').fontSize(17).fillColor('#FFFFFF').text(cap(t.name) + '. ' + t.eng.name + '.', tx0, y + 32, { width: tw0 });
  doc.font('sans').fontSize(9.2).fillColor(C.paleOnNavy)
    .text(fmBody, tx0, doc.y + 4, { width: tw0, lineGap: 2, continued: true })
    .font('bold').fillColor('#FFFFFF').text(t.eng.name, { continued: true })
    .font('sans').fillColor(C.paleOnNavy).text('.');
  if (showLink) {
    const slug = String(t.eng.href || '').replace(/\.html$/, '');
    doc.font('bold').fontSize(8.6).fillColor(C.orange)
      .text('greatdaysleadership.com/' + slug, tx0, doc.y + 6, { link: 'https://greatdaysleadership.com/' + slug, underline: false });
  }
  y += fmH + (tight ? 12 : 16);

  if (mode === 'customer') {
    const note = smart('This Snapshot reflects one leader\'s view. When we run the full Great Days Index, leadership teams routinely diverge from the senior leader\'s read, and the gap is usually where the real cost sits.');
    doc.font('italic').fontSize(10);
    const nh = doc.heightOfString(note, { width: W - 16, lineGap: 2 });
    doc.rect(M, y, 2.5, nh + 2).fill(C.orange);
    doc.font('italic').fontSize(10).fillColor(C.navy).text(note, M + 14, y, { width: W - 16, lineGap: 2 });
    y = doc.y + 10;
    doc.font('sans').fontSize(9.2).fillColor(C.grey).text('To talk through your results, write to ', M + 14, y, { continued: true })
      .font('bold').fillColor(C.navy).text('info@greatdaysleadership.com', { link: 'mailto:info@greatdaysleadership.com', continued: true })
      .font('sans').fillColor(C.grey).text(' or visit ', { link: null, continued: true })
      .font('bold').fillColor(C.navy).text('greatdaysleadership.com/contact', { link: 'https://greatdaysleadership.com/contact', continued: true })
      .font('sans').fillColor(C.grey).text('.', { link: null });
    y = doc.y;
  }

  // Footer
  const fy = PAGE_H - 46;
  rule(fy - 12);
  doc.image(Buffer.from(A.logo, 'base64'), M, fy - 3.5, { width: 86 });
  const fc = '© 2026 · Confidential and proprietary'.toUpperCase();
  doc.font('sans').fontSize(6.8);
  const fcw = doc.widthOfString(fc, { characterSpacing: 1.2 });
  doc.fillColor(C.grey).text(fc, M + (W - fcw) / 2, fy, { characterSpacing: 1.2, lineBreak: false });
  const pg = 'PAGE 1 OF 1';
  const pgw = doc.widthOfString(pg, { characterSpacing: 1.2 });
  doc.text(pg, M + W - pgw, fy, { characterSpacing: 1.2, lineBreak: false });

  doc.end();
  return done.then((buf) => ({ buffer: buf, contentBottom: y }));
}

function fileName(contact, date) {
  const org = String((contact && (contact.organization || contact.name)) || 'Snapshot').replace(/[^A-Za-z0-9]+/g, '');
  const d = (date || new Date()).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  return 'GDL_Snapshot_' + (org || 'Snapshot').slice(0, 40) + '_' + d + '.pdf';
}

module.exports = { buildSnapshotPdf, fileName, profileTags };

/* Google Apps Script backing the Refer a Member form. Setup: tools/REFERRALS.md */

const SHEET_NAME = 'Referrals';
const NOTIFICATION_EMAIL = 'contact@siliconhillsproject.com';
const HEADERS = [
  'Submitted', 'Referrer name', 'Referrer email', 'Referee name', 'Reason',
  'Link', 'Referee email', 'Referee phone', 'Status'
];
const LIMITS = {
  referrerName: 120, referrerEmail: 254, refereeName: 120, reason: 240,
  link: 500, refereeEmail: 254, refereePhone: 40
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (error) {
    return reply({ ok: false, error: 'invalid_json' });
  }

  // Bots fill the hidden field; pretend success so they move on.
  if (data.website) return reply({ ok: true });

  const values = {};
  for (const key of Object.keys(LIMITS)) {
    const value = String(data[key] || '').trim();
    if (!value || value.length > LIMITS[key]) return reply({ ok: false, error: 'invalid_' + key });
    values[key] = value;
  }
  if (!EMAIL_RE.test(values.referrerEmail) || !EMAIL_RE.test(values.refereeEmail)) {
    return reply({ ok: false, error: 'invalid_email' });
  }
  if (!/^https?:\/\//i.test(values.link)) return reply({ ok: false, error: 'invalid_link' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let reviewUrl;
  try {
    const sheet = getSheet();
    sheet.appendRow([
      new Date(),
      ...Object.keys(LIMITS).map((key) => sanitize(values[key])),
      'Pending'
    ]);
    reviewUrl = getReviewUrl(sheet, sheet.getLastRow());
  } finally {
    lock.releaseLock();
  }

  sendReferralNotification(values, reviewUrl);
  return reply({ ok: true });
}

function sendReferralNotification(values, reviewUrl) {
  const lines = [
    'A new member referral is awaiting review.',
    '',
    'Referee: ' + values.refereeName,
    'Referred by: ' + values.referrerName + ' (' + values.referrerEmail + ')',
    'Reason: ' + values.reason,
    'Link: ' + values.link,
    'Referee email: ' + values.refereeEmail,
    'Referee phone: ' + values.refereePhone,
    '',
    'Review this referral: ' + reviewUrl
  ];

  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: 'New member referral awaiting review',
    body: lines.join('\n'),
    name: 'Silicon Hills Project referrals',
    replyTo: values.referrerEmail
  });
}

function getReviewUrl(sheet, row) {
  return sheet.getParent().getUrl()
    + '#gid=' + sheet.getSheetId()
    + '&range=A' + row + ':I' + row;
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Stop submitted text from being evaluated as a spreadsheet formula.
function sanitize(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

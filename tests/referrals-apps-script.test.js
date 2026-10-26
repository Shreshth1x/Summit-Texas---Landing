const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(
  path.join(__dirname, '..', 'tools', 'referrals-apps-script.gs'),
  'utf8'
);

function createContext() {
  const rows = [];
  const emails = [];
  const sheet = {
    appendRow(row) { rows.push(row); },
    getLastRow() { return rows.length; },
    getParent() { return spreadsheet; },
    getSheetId() { return 123456; }
  };
  const spreadsheet = {
    getSheetByName() { return sheet; },
    getUrl() { return 'https://docs.google.com/spreadsheets/d/example/edit'; }
  };
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} })
    },
    MailApp: { sendEmail: (message) => emails.push(message) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (body) => ({
        body,
        setMimeType() { return this; }
      })
    }
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return { context, rows, emails };
}

test('valid referrals are saved and trigger a review email', () => {
  const { context, rows, emails } = createContext();
  const payload = {
    referrerName: 'Alex Referrer',
    referrerEmail: 'alex@example.com',
    refereeName: 'Taylor Builder',
    reason: 'Taylor is building useful tools for Austin founders.',
    link: 'https://example.com/taylor',
    refereeEmail: 'taylor@example.com',
    refereePhone: '+1 512 555 0100',
    website: ''
  };

  const response = context.doPost({
    postData: { contents: JSON.stringify(payload) }
  });

  assert.equal(JSON.parse(response.body).ok, true);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][8], 'Pending');
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'contact@siliconhillsproject.com');
  assert.equal(emails[0].replyTo, 'alex@example.com');
  assert.match(emails[0].body, /Taylor Builder/);
  assert.match(emails[0].body, /#gid=123456&range=A1:I1/);
});

test('honeypot submissions do not save rows or send email', () => {
  const { context, rows, emails } = createContext();
  const response = context.doPost({
    postData: { contents: JSON.stringify({ website: 'spam.example' }) }
  });

  assert.equal(JSON.parse(response.body).ok, true);
  assert.equal(rows.length, 0);
  assert.equal(emails.length, 0);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const navigationPages = [
  'about.html', 'admin-login.html', 'blog.html', 'companies.html', 'contact.html',
  'donate.html', 'join.html', 'members.html', 'refer.html', 'sponsorships.html'
];

function read(filename) {
  return fs.readFileSync(path.join(root, filename), 'utf8');
}

test('shared action navigation keeps the requested two-row order', () => {
  const expected = [
    'Donate', 'Sponsor', 'Contact', 'Blog',
    'Apply', 'Refer a Member', 'Member Directory', 'Company Directory'
  ];

  for (const filename of navigationPages) {
    const navigation = read(filename).match(/<nav class="action-nav"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(navigation, `${filename} should contain the shared action navigation`);
    const labels = [...navigation.matchAll(/<a[^>]*>([^<]+)/g)].map(match => match[1].trim());
    assert.deepEqual(labels, expected, `${filename} should use the shared action order`);
  }
});

test('donate page exposes both Support the House options as direct cards', () => {
  const html = read('donate.html');
  const amazon = 'https://www.amazon.com/hz/wishlist/ls/GEQI6NKXU2G/ref=hz_ls_biz_ex';
  const mealTrain = 'https://www.mealtrain.com/trains/427358';

  assert.match(html, /<h2 class="simple-title" id="house-support-title">Support the House<\/h2>/);
  for (const url of [amazon, mealTrain]) {
    assert.equal(html.split(`href="${url}"`).length - 1, 1, `${url} should have a direct link`);
  }
  assert.doesNotMatch(html, /<iframe/);
  assert.equal((html.match(/class="house-support__card"/g) || []).length, 2);
});

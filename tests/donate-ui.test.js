'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'donate.js'), 'utf8');

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  dispatch(type, detail = {}) {
    for (const handler of this.listeners.get(type) || []) handler({ type, ...detail });
  }
}

function element(tag = 'div') {
  return {
    tag, children: [], textContent: '', hidden: false, attributes: {},
    append(...children) { this.children.push(...children); },
    replaceChildren(fragment) { this.children = [...fragment.children]; },
    setAttribute(name, value) { this.attributes[name] = value; }
  };
}

function snapshot(amount = 0) {
  return {
    currency: 'usd', totalAmount: amount, contributionCount: amount ? 1 : 0,
    contributions: amount ? [{ name: 'Public Donor', amount, date: '2026-09-13' }] : []
  };
}

async function flush() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function fixture({ hidden = false } = {}) {
  const doc = new Events();
  const win = new Events();
  const nodes = Object.fromEntries(['total', 'count', 'list', 'status', 'empty', 'thanks']
    .map(name => [name, element()]));
  const timers = new Map();
  const requests = [];
  let clock = 0, nextTimer = 0;
  Object.assign(doc, {
    hidden,
    querySelector: selector => nodes[selector.match(/^\[data-donate-(.+)\]$/)?.[1]] || null,
    createElement: element,
    createDocumentFragment: () => element('fragment')
  });
  Object.assign(win, {
    location: { search: '' },
    setTimeout(callback, delay) {
      timers.set(++nextTimer, { callback, due: clock + delay });
      return nextTimer;
    },
    clearTimeout: id => timers.delete(id)
  });
  const fetchImpl = (url, options) => new Promise((resolve, reject) => {
    const request = {
      url, options,
      respond(data, ok = true) { resolve({ ok, json: async () => data }); },
      fail: () => reject(new Error('Upstream unavailable'))
    };
    options.signal.addEventListener('abort', () => reject(new Error('Aborted')));
    requests.push(request);
  });
  vm.runInNewContext(source, {
    window: win, document: doc, fetch: fetchImpl, AbortController, URLSearchParams
  });
  async function advance(duration) {
    const target = clock + duration;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.due <= target)
        .sort((left, right) => left[1].due - right[1].due)[0];
      if (!next) break;
      const [id, timer] = next;
      clock = timer.due;
      timers.delete(id);
      timer.callback();
      await flush();
    }
    clock = target;
  }
  return { win, doc, nodes, timers, requests, advance };
}

test('visible donations refresh every ten seconds and render a newly paid contribution', async () => {
  const f = fixture();
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, '/api/donations');
  assert.equal(f.requests[0].options.cache, 'no-store');
  f.requests[0].respond(snapshot());
  await flush();
  assert.equal(f.nodes.total.textContent, '$0');
  await f.advance(9999);
  assert.equal(f.requests.length, 1);
  await f.advance(1);
  assert.equal(f.requests.length, 2);
  f.requests[1].respond(snapshot(2500));
  await flush();
  assert.equal(f.nodes.total.textContent, '$25');
  assert.equal(f.nodes.count.textContent, '1 contribution');
  assert.equal(f.nodes.list.children.length, 1);
  assert.equal(f.nodes.list.children[0].children[0].children[0].textContent, 'Public Donor');
  assert.equal(f.nodes.empty.hidden, true);
});

test('checkout return and focus refresh immediately without overlapping requests', async () => {
  const f = fixture();
  f.win.dispatch('pageshow');
  f.win.dispatch('focus');
  f.doc.dispatch('visibilitychange');
  assert.equal(f.requests.length, 1, 'initial browser events share the pending request');
  f.requests[0].respond(snapshot());
  await flush();

  f.win.dispatch('pageshow', { persisted: true });
  assert.equal(f.requests.length, 2, 'BFCache restoration refreshes before the poll deadline');
  f.win.dispatch('focus');
  f.doc.dispatch('visibilitychange');
  await f.advance(10000);
  assert.equal(f.requests.length, 2, 'return events and the old poll cannot duplicate a request');
  f.requests[1].respond(snapshot(2500));
  await flush();
  f.win.dispatch('focus');
  assert.equal(f.requests.length, 3, 'returning from another window triggers a fresh request');
  f.requests[2].respond(snapshot(3500));
  await flush();
  assert.equal(f.nodes.total.textContent, '$35');
});

test('hidden pages do not fetch or poll and recover immediately when visible', async () => {
  const f = fixture({ hidden: true });
  f.win.dispatch('pageshow', { persisted: true });
  f.win.dispatch('focus');
  await f.advance(30000);
  assert.equal(f.requests.length, 0);
  f.doc.hidden = false;
  f.doc.dispatch('visibilitychange');
  assert.equal(f.requests.length, 1);
  f.requests[0].respond(snapshot(2500));
  await flush();

  f.doc.hidden = true;
  f.doc.dispatch('visibilitychange');
  f.win.dispatch('focus');
  await f.advance(30000);
  assert.equal(f.requests.length, 1);
  f.doc.hidden = false;
  f.win.dispatch('pageshow', { persisted: true });
  assert.equal(f.requests.length, 2);
  f.requests[1].respond(snapshot(3500));
  await flush();
  assert.equal(f.nodes.total.textContent, '$35');
});

test('a stalled request preserves the previous total and polling recovers after its deadline', async () => {
  const f = fixture();
  f.requests[0].respond(snapshot(2500));
  await flush();
  f.win.dispatch('focus');
  await f.advance(12000);
  assert.equal(f.requests[1].options.signal.aborted, true);
  assert.equal(f.nodes.total.textContent, '$25');
  assert.match(f.nodes.status.textContent, /Showing the last update/);
  assert.equal(f.nodes.list.attributes['aria-busy'], 'false');
  await f.advance(10000);
  assert.equal(f.requests.length, 3);
  f.requests[2].respond(snapshot(3500));
  await flush();
  assert.equal(f.nodes.total.textContent, '$35');
  assert.equal(f.nodes.status.textContent, '');
});

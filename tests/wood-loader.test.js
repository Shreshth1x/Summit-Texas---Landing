'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createWoodLoader, BLOCK_SEQUENCE, entryOffset, ENTRY_GAP } = require('../wood-loader.js');

const homeHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const primer = [...homeHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('__shpWoodIntroRequested'));
assert.ok(primer, 'home page must contain its pre-render intro primer');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type, detail = {}) { [...(this.listeners.get(type) || [])].forEach(handler => handler({ type, ...detail })); }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
}
class Block extends Events {
  constructor(id, side, index, context) {
    super();
    this.dataset = { blockId: id, blockSide: side };
    this.style = { transform: 'none', opacity: '1', clipPath: 'none' };
    this.rect = { left: 80 + index * 120, top: 80 + (index % 3) * 150, right: 180 + index * 120, bottom: 170 + (index % 3) * 150 };
    this.reads = 0;
    this.getBoundingClientRect = () => {
      this.reads++;
      context.log.push('read:' + id);
      return { ...this.rect };
    };
    this.animate = (frames, timing) => {
      context.log.push('animate:' + id);
      const completion = deferred();
      const animation = {
        element: this, frames, timing, finished: completion.promise,
        hiddenAtCreation: context.classes.has('wood-intro-pending'), cancelled: false,
        complete: completion.resolve,
        cancel() { this.cancelled = true; completion.reject(new Error('cancelled')); }
      };
      context.animations.push(animation);
      return animation;
    };
  }
}
function fixture({ requested = true, reduced = false, hidden = false } = {}) {
  const animations = [], images = [], timers = new Map(), stored = new Map(), log = [];
  let timerId = 0;
  const window = new Events(), document = new Events(), motion = new Events();
  motion.matches = reduced;
  const classes = new Set(['wood-intro-pending']);
  const body = { dataset: { woodState: 'pending' }, classList: {
    add: (...values) => values.forEach(value => classes.add(value)),
    remove: (...values) => values.forEach(value => classes.delete(value))
  } };
  const sides = { a: 'left', b: 'right', c: 'right', d: 'left', e: 'left', f: 'right', g: 'bottom', core: 'right' };
  const blocks = Object.entries(sides).map(([id, side], index) => new Block(id, side, index, { animations, classes, log }));
  const mosaic = { querySelectorAll: () => blocks };
  document.body = body;
  document.hidden = hidden;
  document.querySelector = () => mosaic;
  Object.assign(window, {
    __shpWoodIntroRequested: requested,
    innerWidth: 1512, innerHeight: 827,
    matchMedia: () => motion,
    getComputedStyle: () => ({ getPropertyValue: () => '1' }),
    sessionStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
    Image: class extends Events {
      constructor() { super(); this.decoded = deferred(); images.push(this); }
      decode() { return this.decoded.promise; }
    }
  });
  window.__shpWoodIntroTimer = window.setTimeout(() => {}, 1800);
  const controller = createWoodLoader(window, document);
  const runTimer = delay => {
    const entry = [...timers].find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `expected ${delay}ms timer`);
    timers.delete(entry[0]); entry[1].callback();
  };
  const listenerCount = () => window.listenerCount + document.listenerCount + motion.listenerCount
    + [...blocks, ...images].reduce((sum, element) => sum + element.listenerCount, 0);
  return { controller, window, document, motion, body, classes, blocks, animations, images, timers, stored, log, runTimer, listenerCount };
}
async function flush() { for (let index = 0; index < 8; index++) await Promise.resolve(); }
async function begin(f) { f.controller.start(); f.images[0].decoded.resolve(); await flush(); }
function prime(f, { url = 'https://www.siliconhillsproject.com/', navigationType = 'navigate' } = {}) {
  f.classes.clear(); f.classes.add('is-loading'); f.timers.clear();
  f.window.__shpWoodIntroTimer = null;
  f.window.location = { href: url };
  f.window.performance = { getEntriesByType: () => [{ type: navigationType }] };
  vm.runInNewContext(primer, { window: f.window, document: f.document, URL });
}
function vector(transform) {
  const match = /^translate3d\((-?[\d.]+)px, (-?[\d.]+)px, 0px\)$/.exec(transform);
  assert.ok(match, 'assembly uses translation only');
  return { x: Number(match[1]), y: Number(match[2]) };
}
function assertSettled(f) {
  assert.equal(f.controller.state, 'settled');
  assert.equal(f.body.dataset.woodState, 'settled');
  assert.equal(f.listenerCount(), 0);
  assert.equal(f.timers.size, 0);
  assert.ok(!f.classes.has('wood-intro-pending') && !f.classes.has('wood-intro-running'));
  assert.ok(f.animations.every(animation => animation.cancelled));
}

test('entry vectors place complete rectangles outside desktop and mobile viewport edges', () => {
  for (const viewport of [{ width: 1512, height: 827 }, { width: 390, height: 844 }]) {
    const rect = { left: 24, top: 100, right: 240, bottom: 280 };
    for (const side of ['left', 'right', 'top', 'bottom']) {
      const { x, y } = entryOffset(rect, side, viewport);
      if (side === 'left') { assert.equal(rect.right + x, -ENTRY_GAP); assert.equal(y, 0); }
      if (side === 'right') { assert.equal(rect.left + x, viewport.width + ENTRY_GAP); assert.equal(y, 0); }
      if (side === 'top') { assert.equal(rect.bottom + y, -ENTRY_GAP); assert.equal(x, 0); }
      if (side === 'bottom') { assert.equal(rect.top + y, viewport.height + ENTRY_GAP); assert.equal(x, 0); }
      assert.equal((rect.right + x) - (rect.left + x), rect.right - rect.left);
      assert.equal((rect.bottom + y) - (rect.top + y), rect.bottom - rect.top);
    }
  }
  assert.throws(() => entryOffset({ left: 0, top: 0, right: 0, bottom: 1 }, 'left', { width: 390, height: 844 }));
  assert.throws(() => entryOffset({ left: 0, top: 0, right: 1, bottom: 1 }, 'diagonal', { width: 390, height: 844 }));
});

test('every block shares the same duration and stagger, with the logo completing last', () => {
  assert.deepEqual(BLOCK_SEQUENCE.map(block => block.id), ['a', 'b', 'd', 'c', 'f', 'g', 'e', 'core']);
  assert.equal(new Set(BLOCK_SEQUENCE.map(block => block.id)).size, 8);
  assert.deepEqual(Object.fromEntries(BLOCK_SEQUENCE.map(({ id, side }) => [id, side])), {
    a: 'left', b: 'right', d: 'left', c: 'right', f: 'right', g: 'bottom', e: 'left', core: 'right'
  });
  assert.equal(new Set(BLOCK_SEQUENCE.map(block => block.duration)).size, 1);
  for (let index = 1; index < BLOCK_SEQUENCE.length; index++) {
    assert.equal(BLOCK_SEQUENCE[index].delay - BLOCK_SEQUENCE[index - 1].delay, 150);
  }
  const lastOuterEnd = Math.max(...BLOCK_SEQUENCE.slice(0, -1).map(block => block.delay + block.duration));
  assert.ok(BLOCK_SEQUENCE.at(-1).delay < lastOuterEnd, 'logo joins the ongoing assembly');
  assert.equal(BLOCK_SEQUENCE.at(-1).delay + BLOCK_SEQUENCE.at(-1).duration, lastOuterEnd + 150);
});

test('assembly measures all blocks once before eight opaque transform-only effects take over visibility', async () => {
  const f = fixture();
  const originalStyles = f.blocks.map(block => ({ ...block.style }));
  await begin(f);
  assert.equal(f.controller.state, 'assembling');
  assert.equal(f.window.__shpWoodIntroTimer, null);
  assert.equal(f.animations.length, 8);
  assert.ok(f.blocks.every(block => block.reads === 1));
  assert.ok(f.log.slice(0, 8).every(event => event.startsWith('read:')));
  assert.ok(f.log.slice(8).every(event => event.startsWith('animate:')));
  assert.deepEqual(f.animations.map(animation => animation.element.dataset.blockId), BLOCK_SEQUENCE.map(block => block.id));
  for (const animation of f.animations) {
    assert.ok(animation.hiddenAtCreation);
    assert.equal(animation.timing.fill, 'both');
    assert.equal(animation.currentTime, 0);
    assert.ok(animation.frames.every(frame => Object.keys(frame).join(',') === 'transform'));
    const start = vector(animation.frames[0].transform);
    assert.deepEqual(vector(animation.frames.at(-1).transform), { x: 0, y: 0 });
    const { rect, dataset } = animation.element;
    if (dataset.blockSide === 'left') assert.ok(rect.right + start.x < 0);
    if (dataset.blockSide === 'right') assert.ok(rect.left + start.x > f.window.innerWidth);
    if (dataset.blockSide === 'bottom') assert.ok(rect.top + start.y > f.window.innerHeight);
  }
  assert.ok(!f.classes.has('wood-intro-pending') && f.classes.has('wood-intro-running'));
  assert.deepEqual(f.blocks.map(block => block.style), originalStyles);
  f.controller.finish();
  assertSettled(f);
});

test('the logo completion settles the whole assembly and repeated start cannot replay this document', async () => {
  const f = fixture();
  await begin(f);
  f.animations.slice(0, 7).forEach(animation => animation.complete());
  await flush();
  assert.equal(f.controller.state, 'assembling');
  f.animations[7].complete();
  await flush();
  assertSettled(f);
  await f.controller.start();
  assert.equal(f.images.length, 1);
  assert.equal(f.animations.length, 8);
  assert.equal(f.stored.size, 0);
});

test('every anchor can settle its arrival immediately on click or keyboard focus', async () => {
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'core']) {
    for (const event of ['click', 'focusin']) {
      const f = fixture();
      await begin(f);
      f.blocks.find(block => block.dataset.blockId === id).dispatch(event, { preventDefault() { assert.fail('native link blocked'); } });
      assertSettled(f);
      await flush();
    }
  }
});

test('pointer focus preserves the in-flight pose while visible keyboard focus settles it', async () => {
  const f = fixture();
  await begin(f);
  const block = f.blocks[0];
  block.matches = selector => { assert.equal(selector, ':focus-visible'); return false; };
  block.dispatch('focusin');
  assert.equal(f.controller.state, 'assembling');
  assert.ok(f.animations.every(animation => !animation.cancelled));
  block.matches = () => true;
  block.dispatch('focusin');
  assertSettled(f);
});

test('unsupported focus-visible selectors leave a stable keyboard target', async () => {
  const f = fixture();
  await begin(f);
  f.blocks[0].matches = () => { throw new Error('Unsupported selector'); };
  f.blocks[0].dispatch('focusin');
  assertSettled(f);
});

test('resize, visibility, history lifecycle, Escape, and live reduced motion restore the final layout', async () => {
  const interruptions = [
    f => { f.window.innerWidth = 390; f.window.dispatch('resize'); },
    f => { f.document.hidden = true; f.document.dispatch('visibilitychange'); },
    f => f.window.dispatch('pagehide'),
    f => f.window.dispatch('pageshow', { persisted: true }),
    f => f.document.dispatch('keydown', { key: 'Escape' }),
    f => { f.motion.matches = true; f.motion.dispatch('change', { matches: true }); }
  ];
  for (const interrupt of interruptions) {
    const f = fixture();
    await begin(f);
    interrupt(f);
    assertSettled(f);
    await flush();
  }
});

test('interruption during decode prevents delayed asset success from restarting assembly', async () => {
  for (const interrupt of [f => f.blocks[2].dispatch('focusin'), f => { f.window.innerHeight = 844; f.window.dispatch('resize'); }]) {
    const f = fixture();
    f.controller.start();
    interrupt(f);
    assertSettled(f);
    f.images[0].decoded.resolve();
    await flush();
    assert.equal(f.animations.length, 0);
    await f.controller.start();
    assert.equal(f.images.length, 1);
  }
});

test('initial mobile resize events with unchanged dimensions do not cancel preflight or assembly', async () => {
  const f = fixture();
  f.window.innerWidth = 390;
  f.window.innerHeight = 844;
  f.controller.start();
  f.window.dispatch('resize');
  assert.equal(f.controller.state, 'pending');
  f.images[0].decoded.resolve();
  await flush();
  f.window.dispatch('resize');
  assert.equal(f.controller.state, 'assembling');
  assert.equal(f.animations.length, 8);
  assert.ok(f.animations.every(animation => !animation.cancelled));
  f.controller.finish();
  assertSettled(f);
});

test('start is idempotent during preflight and while assembling', async () => {
  const f = fixture();
  f.controller.start(); f.controller.start();
  assert.equal(f.images.length, 1);
  f.images[0].decoded.resolve();
  await flush();
  await f.controller.start();
  assert.equal(f.animations.length, 8);
  f.controller.finish();
  assertSettled(f);
});

test('skips, missing CSS or block support, and malformed block identity fail open', async () => {
  const cases = [
    f => { f.window.__shpWoodIntroRequested = false; },
    f => { f.motion.matches = true; },
    f => { f.document.hidden = true; },
    f => { f.window.getComputedStyle = () => ({ getPropertyValue: () => '' }); },
    f => { f.blocks[0].animate = undefined; },
    f => { f.blocks.pop(); },
    f => { f.blocks[1].dataset.blockId = 'a'; }
  ];
  for (const change of cases) {
    const f = fixture(); change(f);
    await f.controller.start();
    assertSettled(f);
    assert.equal(f.images.length, 0);
    assert.equal(f.animations.length, 0);
  }
});

test('bad geometry and partial animation setup errors expose every block and cancel owned effects', async () => {
  const geometry = fixture();
  geometry.blocks[3].rect.right = geometry.blocks[3].rect.left;
  await begin(geometry);
  assertSettled(geometry);
  assert.equal(geometry.animations.length, 0);
  const partial = fixture();
  partial.blocks[3].animate = () => { throw new Error('effect failed'); };
  await begin(partial);
  assertSettled(partial);
  assert.ok(partial.animations.length > 0 && partial.animations.length < 8);
});

test('asset failure before or after the bounded preflight settles without stale callbacks', async () => {
  const early = fixture(); early.controller.start();
  early.images[0].decoded.reject(new Error('404'));
  await flush(); assertSettled(early); assert.equal(early.animations.length, 0);
  const late = fixture(); late.controller.start(); late.runTimer(300);
  await flush(); assert.equal(late.controller.state, 'assembling');
  late.images[0].decoded.reject(new Error('404'));
  await flush(); assertSettled(late);
});

test('watchdog bounds unresolved effects, while unrelated events do not interrupt assembly', async () => {
  const f = fixture(); await begin(f);
  f.window.dispatch('pageshow', { persisted: false });
  f.document.dispatch('keydown', { key: 'Enter' });
  f.motion.dispatch('change', { matches: false });
  assert.equal(f.controller.state, 'assembling');
  f.runTimer(4000); assertSettled(f);
  f.animations.forEach(animation => animation.complete());
  await flush(); assertSettled(f);
});

test('direct loads and reloads ignore old seen and skip session flags', async () => {
  for (const navigationType of ['navigate', 'reload']) {
    const f = fixture();
    const legacy = [['shp:wood-intro-seen', 'v1'], ['shp:skip-intro', '1']];
    legacy.forEach(([key, value]) => f.stored.set(key, value));
    prime(f, { navigationType });
    assert.equal(f.window.__shpWoodIntroRequested, true);
    await begin(f);
    assert.equal(f.controller.state, 'assembling');
    f.controller.finish();
    assert.deepEqual([...f.stored], legacy);
  }
});

test('Home skip is one-use, actual reload overrides its query, and history or reduced motion settles', async () => {
  const home = fixture();
  prime(home, { url: 'https://www.siliconhillsproject.com/?skip-intro=1' });
  assert.equal(home.window.__shpWoodIntroRequested, false);
  await home.controller.start(); assertSettled(home);
  const reload = fixture();
  prime(reload, { url: 'https://www.siliconhillsproject.com/?skip-intro=1', navigationType: 'reload' });
  assert.equal(reload.window.__shpWoodIntroRequested, true);
  await begin(reload); assert.equal(reload.controller.state, 'assembling'); reload.controller.finish();
  const history = fixture(); prime(history, { navigationType: 'back_forward' });
  assert.equal(history.window.__shpWoodIntroRequested, false);
  await history.controller.start(); assertSettled(history);
  const reduced = fixture({ reduced: true });
  prime(reduced, { url: 'https://www.siliconhillsproject.com/?skip-intro=1', navigationType: 'reload' });
  assert.equal(reduced.window.__shpWoodIntroRequested, false);
  await reduced.controller.start(); assertSettled(reduced);
});

test('blocked storage is irrelevant and the primer watchdog prevents a late controller from hiding content', async () => {
  const blocked = fixture();
  Object.defineProperty(blocked.window, 'sessionStorage', { get() { throw new Error('storage blocked'); } });
  prime(blocked); await begin(blocked); blocked.controller.finish(); assertSettled(blocked);
  const late = fixture(); prime(late); late.runTimer(1800);
  assert.equal(late.window.__shpWoodIntroRequested, false);
  assert.equal(late.body.dataset.woodState, 'settled');
  await late.controller.start(); assertSettled(late); assert.equal(late.animations.length, 0);
});

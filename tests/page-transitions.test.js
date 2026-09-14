'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createPageTransitions = require('../page-transitions.js');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class Events {
  constructor() { this.listeners = new Map(); this.registrations = []; }
  addEventListener(type, handler, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
    this.registrations.push({ type, capture: typeof options === 'boolean' ? options : Boolean(options?.capture) });
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type, detail = {}) {
    const event = { type, ...detail };
    [...(this.listeners.get(type) || [])].forEach(handler => handler(event));
    return event;
  }
}

function classList(values = []) {
  const set = new Set(values);
  return {
    add: (...names) => names.forEach(name => set.add(name)),
    remove: (...names) => names.forEach(name => set.delete(name)),
    contains: name => set.has(name)
  };
}

async function flush() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function fixture({ hero = false, reduced = false, hidden = false, animationSupport = true, failAt = 0, width = 900, height = 700 } = {}) {
  const win = new Events();
  const doc = new Events();
  const preference = new Events();
  preference.matches = reduced;
  const animations = [], navigations = [], timers = new Map(), operations = [];
  let nextTimer = 0, animateCalls = 0, clock = 0;

  function element(name, attributes = {}) {
    const values = { ...attributes };
    const bounds = attributes.bounds || { left: 20, top: 20, width: 80, height: 60 };
    function dataKey(attribute) { return attribute.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); }
    const node = {
      name,
      dataset: Object.fromEntries(Object.entries(attributes).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [dataKey(key), value])),
      classList: classList(attributes.classes),
      style: { opacity: '0.85', transform: 'none', clipPath: 'inset(0)' },
      hasAttribute: key => Object.hasOwn(values, key),
      getAttribute: key => values[key] ?? null,
      setAttribute(key, value) {
        values[key] = value;
        if (key.startsWith('data-')) node.dataset[dataKey(key)] = value;
      },
      getBoundingClientRect: () => ({ ...bounds, right: bounds.left + bounds.width, bottom: bounds.top + bounds.height }),
      animate(frames, timing) {
        operations.push('animate:' + name);
        animateCalls += 1;
        if (failAt && animateCalls === failAt) throw new Error('animation setup failed');
        const completion = deferred();
        const animation = {
          element: node,
          frames: frames.map(frame => ({ ...frame })),
          timing: { ...timing },
          finished: completion.promise,
          cancelled: false,
          complete: completion.resolve,
          reject: () => completion.reject(new Error('animation interrupted')),
          cancel() {
            this.cancelled = true;
            completion.reject(new Error('animation cancelled'));
          }
        };
        animations.push(animation);
        return animation;
      }
    };
    if ('href' in attributes) {
      node.href = new URL(attributes.href, 'https://www.siliconhillsproject.com/about').href;
      node.target = attributes.target || '';
      node.closest = selector => selector === 'a[href]' ? node : null;
    }
    return node;
  }

  const body = element('body');
  if (!animationSupport) body.animate = undefined;
  const contents = [element('header'), element('main')];
  const actions = [
    element('donate', { href: '/donate', classes: ['action-box'] }),
    element('sponsor', { href: '/sponsorships', classes: ['action-box'] }),
    element('blog', { href: '/blog', classes: ['action-box'] })
  ];
  const mosaic = hero ? element('mosaic') : null;
  const core = hero ? element('core', {
    href: '/about', 'data-block-id': 'core', 'data-block-side': 'right',
    bounds: { left: width * 0.4, top: height * 0.4, width: width * 0.4, height: height * 0.15 }
  }) : null;
  const sides = ['left', 'right', 'right', 'left', 'left', 'right', 'bottom'];
  const tiles = hero ? sides.map((side, index) => element('tile-' + index, {
    href: '/about', 'data-block-id': String.fromCharCode(97 + index), 'data-block-side': side,
    bounds: {
      left: width * (0.1 + (index % 3) * 0.25), top: height * (0.12 + Math.floor(index / 3) * 0.25),
      width: width * 0.2, height: height * (index % 2 ? 0.18 : 0.12)
    }
  })) : [];
  const blocks = hero ? [...tiles, core] : [];

  Object.assign(win, {
    innerWidth: width,
    innerHeight: height,
    getComputedStyle(node) {
      operations.push('snapshot:' + node.dataset.blockId);
      return { transform: node.style.transform };
    },
    matchMedia: () => preference,
    location: {
      href: 'https://www.siliconhillsproject.com/' + (hero ? '' : 'about'),
      assign: href => { operations.push('navigate'); navigations.push(href); }
    },
    setTimeout(callback, delay) {
      timers.set(++nextTimer, { callback, due: clock + delay });
      return nextTimer;
    },
    clearTimeout: id => timers.delete(id),
    SHPWoodLoader: { finish: () => operations.push('finish-wood') },
    SHPWoodHover: { reset: () => operations.push('reset-wood-hover') }
  });
  Object.assign(doc, {
    body,
    hidden,
    querySelector(selector) {
      if (selector === '[data-logo-mosaic]') return mosaic;
      if (selector === '[data-logo-core]') return core;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.simple-header, .simple-main, .about-home, body > .page') return contents;
      if (selector === '.action-box') return actions;
      if (selector === '[data-peel-tile]') return tiles;
      if (selector === '[data-block-id]') return blocks;
      return [];
    }
  });

  const controller = createPageTransitions(win, doc);
  function click(link = actions[0], overrides = {}) {
    const event = {
      target: { closest: () => link },
      button: 0,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...overrides
    };
    return doc.dispatch('click', event);
  }
  async function nextDeadline() {
    assert.ok(timers.size, 'a bounded recovery deadline should be installed');
    const [id, timer] = [...timers].sort((left, right) => left[1].due - right[1].due)[0];
    const delay = timer.due - clock;
    clock = timer.due;
    timers.delete(id);
    timer.callback();
    await flush();
    return delay;
  }
  function assertReset() {
    assert.equal(controller.state, 'idle');
    assert.ok(!body.classList.contains('is-page-leaving'));
    assert.ok(!body.classList.contains('is-mission-leaving'));
    assert.equal(timers.size, 0);
    assert.ok(animations.every(animation => animation.cancelled));
  }
  return { win, doc, preference, controller, body, contents, actions, core, tiles, blocks, animations, navigations, timers, operations, element, click, nextDeadline, assertReset };
}

test('initial content remains visible without shared JavaScript arrival effects on any page', () => {
  for (const options of [{}, { hero: true }, { hidden: true }, { reduced: true }, { animationSupport: false }]) {
    const f = fixture(options);
    assert.equal(f.animations.length, 0);
    assert.equal(f.navigations.length, 0);
    assert.deepEqual(f.contents.map(node => node.style), [
      { opacity: '0.85', transform: 'none', clipPath: 'inset(0)' },
      { opacity: '0.85', transform: 'none', clipPath: 'inset(0)' }
    ]);
    f.assertReset();
  }
});

test('inner same-origin links navigate immediately without hiding content or waiting for effects', async () => {
  for (const attributes of [
    { href: '/donate' },
    { href: '/sponsorships' },
    { href: '/blog' },
    { href: '/contact' },
    { href: '/letter' },
    { href: '/blog', target: '_SELF' },
    { href: '/blog#latest' },
    { href: '/about?view=all#details' }
  ]) {
    const f = fixture();
    const originalStyles = f.contents.map(node => ({ ...node.style }));
    const link = f.element('destination', attributes);
    assert.equal(f.click(link).defaultPrevented, true);
    assert.deepEqual(f.navigations, [link.href], 'navigation must happen in the click handler');
    assert.equal(f.controller.state, 'navigating');
    assert.equal(f.animations.length, 0);
    assert.deepEqual(f.contents.map(node => node.style), originalStyles);
    assert.ok(!f.body.classList.contains('is-mission-leaving'));
    assert.equal(await f.nextDeadline(), 1500);
    f.assertReset();
    assert.equal(f.navigations.length, 1);
  }
});

test('hero clicks are captured before target entry cleanup while inner-page clicks remain bubbling', async () => {
  for (const hero of [true, false]) {
    const f = fixture({ hero });
    const clickListeners = f.doc.registrations.filter(registration => registration.type === 'click');
    assert.deepEqual(clickListeners, [{ type: 'click', capture: hero }]);
    f.controller.reset();
    await flush();
    f.assertReset();
  }
});

test('rapid inner-page clicks preserve the first destination until recovery or page lifecycle reset', async () => {
  const f = fixture();
  f.click(f.actions[0]);
  assert.deepEqual(f.navigations, [f.actions[0].href]);
  assert.equal(f.click(f.actions[1]).defaultPrevented, true);
  assert.equal(f.click(f.actions[2]).defaultPrevented, true);
  assert.deepEqual(f.navigations, [f.actions[0].href]);
  assert.equal(f.animations.length, 0);
  assert.equal(await f.nextDeadline(), 1500);
  f.assertReset();
  f.click(f.actions[1]);
  assert.deepEqual(f.navigations, [f.actions[0].href, f.actions[1].href]);
  f.win.dispatch('pagehide');
  await flush();
  f.assertReset();
  f.click(f.actions[2]);
  assert.deepEqual(f.navigations, f.actions.map(link => link.href));
  f.controller.reset();
  f.assertReset();
});

test('modified, download, same-document hash, skip, new-context, and unsupported links remain native', () => {
  const f = fixture();
  const cases = [
    [f.actions[0], { metaKey: true }],
    [f.actions[0], { ctrlKey: true }],
    [f.actions[0], { shiftKey: true }],
    [f.actions[0], { altKey: true }],
    [f.actions[0], { button: 1 }],
    [f.actions[0], { button: 2 }],
    [f.actions[0], { defaultPrevented: true }],
    [f.element('download', { href: '/asset.pdf', download: '' })],
    [f.element('hash', { href: '/about#details' })],
    [f.element('skip', { href: '/blog', classes: ['skip-link'] })],
    [f.element('new-tab', { href: '/blog', target: '_blank' })],
    [f.element('parent', { href: '/blog', target: '_parent' })],
    [f.element('named-context', { href: '/blog', target: 'reader' })],
    [f.element('unsupported', { href: 'ftp://example.com/file' })],
    [null],
    [null, { target: {} }]
  ];
  for (const [link, overrides = {}] of cases) {
    let prevented = 0;
    f.click(link, { ...overrides, preventDefault() { prevented += 1; } });
    assert.equal(prevented, 0, link?.name || 'non-link');
  }
  assert.equal(f.animations.length, 0);
  assert.equal(f.navigations.length, 0);
  f.assertReset();
});

test('external HTTP, mail, and telephone links remain fully native from inner and hero pages', () => {
  for (const hero of [false, true]) {
    for (const href of [
      'https://example.com/partner?from=shp', 'http://example.com/partner',
      'mailto:contact@siliconhillsproject.com', 'tel:+15125550100'
    ]) {
      const f = fixture({ hero });
      const link = f.element('external-handler', { href });
      assert.equal(f.click(link).defaultPrevented, false);
      assert.equal(f.navigations.length, 0);
      assert.equal(f.animations.length, 0);
      f.assertReset();
    }
  }
});

test('Home commits immediately and preserves its one-use intro skip, other parameters, and fragment', async () => {
  const f = fixture();
  const href = 'https://www.siliconhillsproject.com/?skip-intro=1&from=sponsor&label=Texas%20builders#main-content';
  const home = f.element('home', { href });
  assert.equal(f.click(home).defaultPrevented, true);
  assert.deepEqual(f.navigations, [href], 'only the arriving homepage may consume the skip parameter');
  assert.equal(f.animations.length, 0);
  assert.equal(f.controller.state, 'navigating');
  f.controller.reset();
  await flush();
  f.assertReset();
});

test('clicking the exact current URL prevents an unnecessary reload without any transition', () => {
  for (const hero of [false, true]) {
    const f = fixture({ hero });
    f.win.location.href += '?view=all#details';
    const current = f.element('current-page', { href: f.win.location.href.split('#')[0] });
    assert.equal(f.click(current).defaultPrevented, true);
    assert.equal(f.navigations.length, 0);
    assert.equal(f.animations.length, 0);
    f.assertReset();
    const hash = f.element('current-page-hash', { href: f.win.location.href });
    assert.equal(f.click(hash).defaultPrevented, false);
    f.assertReset();
  }
});

test('hidden pages, reduced motion, and absent WAAPI keep navigation native', () => {
  for (const hero of [false, true]) {
    for (const options of [{ hidden: true }, { reduced: true }, { animationSupport: false }]) {
      const f = fixture({ hero, ...options });
      assert.equal(f.click(hero ? f.core : f.actions[0]).defaultPrevented, false);
      assert.equal(f.animations.length, 0);
      assert.equal(f.navigations.length, 0);
      f.assertReset();
    }
  }
});

test('enabling reduced motion immediately cancels and commits a pending hero departure once', async () => {
  const f = fixture({ hero: true });
  f.click(f.core);
  f.preference.matches = true;
  f.preference.dispatch('change', { matches: true });
  await flush();
  assert.deepEqual(f.navigations, [f.core.href]);
  assert.ok(f.animations.every(animation => animation.cancelled));
  f.preference.dispatch('change', { matches: true });
  await flush();
  assert.equal(f.navigations.length, 1);
  f.controller.reset();
  f.assertReset();
});

test('a rejected hero departure animation releases effects and still navigates once', async () => {
  const f = fixture({ hero: true });
  f.click(f.core);
  f.animations.at(-1).reject();
  await flush();
  assert.deepEqual(f.navigations, [f.core.href]);
  assert.ok(f.animations.every(animation => animation.cancelled));
  await f.nextDeadline();
  f.assertReset();
  assert.equal(f.navigations.length, 1);
});

test('unresolved hero departure navigates at 800ms and restores a cancelled navigation at 1500ms', async () => {
  const f = fixture({ hero: true });
  f.click(f.core);
  assert.equal(f.navigations.length, 0);
  assert.equal(await f.nextDeadline(), 800);
  assert.deepEqual(f.navigations, [f.core.href]);
  assert.equal(await f.nextDeadline(), 1500);
  f.assertReset();
  f.animations.forEach(animation => animation.complete());
  await flush();
  assert.equal(f.navigations.length, 1);
});

test('first or partial departure setup failure fails open without leaving stale effects', async () => {
  for (const failAt of [1, 3]) {
    const f = fixture({ hero: true, failAt });
    assert.doesNotThrow(() => f.click(f.core));
    await flush();
    assert.deepEqual(f.navigations, [f.core.href]);
    assert.ok(f.animations.every(animation => animation.cancelled));
    await f.nextDeadline();
    f.assertReset();
  }
});

test('pagehide and BFCache restoration invalidate pending callbacks and clear departure state', async () => {
  for (const event of ['pagehide', 'pageshow']) {
    const f = fixture({ hero: true });
    f.click(f.core);
    f.win.dispatch(event, { persisted: true });
    await flush();
    f.assertReset();
    f.animations.forEach(animation => animation.complete());
    await flush();
    assert.equal(f.navigations.length, 0);
    f.click(f.core);
    f.animations.filter(animation => !animation.cancelled).forEach(animation => animation.complete());
    await flush();
    assert.deepEqual(f.navigations, [f.core.href]);
    f.win.dispatch('pageshow', { persisted: true });
    await flush();
    f.assertReset();
    assert.equal(f.navigations.length, 1);
  }
});

test('BFCache restores an inner page without effects or a stale navigation lock', async () => {
  const f = fixture();
  f.click(f.actions[0]);
  f.win.dispatch('pageshow', { persisted: true });
  await flush();
  f.assertReset();
  assert.equal(f.animations.length, 0);
  f.click(f.actions[1]);
  assert.deepEqual(f.navigations, [f.actions[0].href, f.actions[1].href]);
  f.win.dispatch('pagehide');
  f.assertReset();
});

test('hiding a pending hero departure or pressing Escape commits once immediately', async () => {
  for (const event of ['visibilitychange', 'keydown']) {
    const f = fixture({ hero: true });
    f.click(f.core);
    if (event === 'visibilitychange') f.doc.hidden = true;
    f.doc.dispatch(event, { key: 'Escape' });
    await flush();
    assert.deepEqual(f.navigations, [f.core.href]);
    f.doc.dispatch(event, { key: 'Escape' });
    assert.equal(f.navigations.length, 1);
    f.controller.reset();
    await flush();
    f.assertReset();
  }
});

test('hero departure snapshots all eight blocks, stops entry and hover, then separates the full assembly', async () => {
  const f = fixture({ hero: true });
  const originalStyles = f.blocks.map(block => ({ ...block.style }));
  assert.equal(f.animations.length, 0, 'the shared arrival should not compete with the hero intro');
  assert.equal(f.click(f.core).defaultPrevented, true);
  assert.deepEqual(f.operations.slice(0, 8), f.blocks.map(block => 'snapshot:' + block.dataset.blockId));
  assert.deepEqual(f.operations.slice(8, 10), ['finish-wood', 'reset-wood-hover']);
  assert.ok(f.operations[10].startsWith('animate:'));
  assert.equal(f.animations.length, 8);
  assert.equal(new Set(f.animations.map(animation => animation.element)).size, 8);
  assert.ok(f.blocks.every(block => f.animations.some(animation => animation.element === block)));
  assert.deepEqual(f.blocks.map(block => block.style), originalStyles);
  assert.ok(f.body.classList.contains('is-mission-leaving'));
  assert.equal(f.navigations.length, 0);
  f.click(f.tiles[0]);
  assert.equal(f.operations.filter(operation => operation === 'reset-wood-hover').length, 1);
  assert.equal(f.animations.length, 8);
  f.animations.forEach(animation => animation.complete());
  await flush();
  assert.deepEqual(f.navigations, [f.core.href]);
  f.win.dispatch('pagehide');
  await flush();
  f.assertReset();
  assert.deepEqual(f.blocks.map(block => block.style), originalStyles);
});

test('hero departure remains usable when the optional hover controller is unavailable', async () => {
  const f = fixture({ hero: true });
  delete f.win.SHPWoodHover;
  assert.doesNotThrow(() => f.click(f.core));
  assert.equal(f.animations.length, 8);
  assert.ok(f.animations.some(animation => animation.element === f.core));
  f.animations.forEach(animation => animation.complete());
  await flush();
  assert.deepEqual(f.navigations, [f.core.href]);
  f.controller.reset();
  await flush();
  f.assertReset();
});

test('activating any of the eight block links separates the assembly and navigates to About once', async () => {
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'core']) {
    const f = fixture({ hero: true });
    const link = f.blocks.find(block => block.dataset.blockId === id);
    assert.equal(f.click(link).defaultPrevented, true, id);
    assert.equal(f.controller.state, 'leaving', id);
    assert.equal(f.animations.length, 8, id);
    assert.equal(f.navigations.length, 0, id);
    f.animations.slice(0, -1).forEach(animation => animation.complete());
    await flush();
    assert.equal(f.navigations.length, 0, 'the clicked block must not commit before the whole assembly leaves');
    f.animations.at(-1).complete();
    await flush();
    assert.deepEqual(f.navigations, ['https://www.siliconhillsproject.com/about'], id);
    f.controller.reset();
    await flush();
    f.assertReset();
  }
});

test('intact departures clear each declared viewport edge without fading, clipping, or shrinking', async () => {
  for (const [width, height] of [[900, 700], [390, 844], [844, 390]]) {
    const f = fixture({ hero: true, width, height });
    f.click(f.core);
    for (const animation of f.animations) {
      assert.ok(animation.frames.every(frame => Object.keys(frame).length === 1 && 'transform' in frame));
      assert.ok(animation.frames.every(frame => !/scale|rotate|perspective/i.test(frame.transform)));
      const match = animation.frames.at(-1).transform.match(/^translate3d\((-?[\d.]+)px,(-?[\d.]+)px,0\)$/);
      assert.ok(match, 'a full-size board should leave by translation alone');
      const [, x, y] = match.map(Number);
      const rect = animation.element.getBoundingClientRect();
      const side = animation.element.dataset.blockSide;
      if (side === 'left') {
        assert.equal(y, 0);
        assert.ok(rect.right + x < 0);
      } else if (side === 'right') {
        assert.equal(y, 0);
        assert.ok(rect.left + x > width);
      } else if (side === 'bottom') {
        assert.equal(x, 0);
        assert.ok(rect.top + y > height);
      } else assert.fail('unexpected fixture side');
    }
    const departureOrder = [...f.animations].sort((a, b) => a.timing.delay - b.timing.delay)
      .map(animation => animation.element.dataset.blockId);
    assert.deepEqual(departureOrder, ['core', 'e', 'g', 'f', 'c', 'd', 'b', 'a']);
    assert.ok(f.animations.every(animation => animation.timing.duration > 0 && animation.timing.duration <= 400));
    const lastEnd = Math.max(...f.animations.map(animation => animation.timing.delay + animation.timing.duration));
    assert.ok(lastEnd <= 600, 'the complete departure must remain fast');
    const watchdog = await f.nextDeadline();
    assert.ok(watchdog > lastEnd && watchdog <= 900, 'the watchdog should bound a stalled departure without cutting off its configured timeline');
    assert.deepEqual(f.navigations, [f.core.href]);
    f.controller.reset();
    await flush();
    f.assertReset();
  }

  const top = fixture({ hero: true });
  top.core.setAttribute('data-block-side', 'top');
  top.click(top.core);
  const animation = top.animations.find(effect => effect.element === top.core);
  const match = animation.frames.at(-1).transform.match(/^translate3d\((-?[\d.]+)px,(-?[\d.]+)px,0\)$/);
  assert.ok(match);
  assert.equal(Number(match[1]), 0);
  assert.ok(top.core.getBoundingClientRect().bottom + Number(match[2]) < 0);
  top.controller.reset();
  await flush();
  top.assertReset();
});

test('interrupting entry keeps every block at its captured position when departure begins', async () => {
  const f = fixture({ hero: true });
  const current = new Map(f.blocks.map((block, index) => [block, `matrix(1, 0, 0, 1, ${index * 37 - 160}, ${index * 11 - 30})`]));
  f.blocks.forEach(block => { block.style.transform = current.get(block); });
  f.win.SHPWoodLoader.finish = () => {
    f.operations.push('finish-wood');
    // Real entry cancellation exposes the underlying assembled position.
    f.blocks.forEach(block => { block.style.transform = 'none'; });
  };
  f.click(f.tiles[3]);
  assert.equal(f.animations.length, 8);
  for (const animation of f.animations) {
    assert.equal(animation.frames[0].transform, current.get(animation.element));
    assert.equal(animation.timing.fill, 'both', 'delayed departures must hold the captured position while waiting');
  }
  assert.ok(f.operations.slice(0, 8).every(operation => operation.startsWith('snapshot:')));
  assert.equal(f.operations[8], 'finish-wood');
  f.animations.forEach(animation => animation.complete());
  await flush();
  assert.deepEqual(f.navigations, [f.core.href]);
  f.win.dispatch('pagehide');
  await flush();
  f.assertReset();
});

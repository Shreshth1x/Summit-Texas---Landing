# Wood block assembly

The hero now assembles from eight intact wooden rectangles. Blocks slide in from the viewport edges at a regular stagger, with the central Silicon Hills Project block last in the sequence. All eight share the same duration and easing. Every block is a real `/about` link. Clicking a block separates the assembly before navigation. Paint masks, brush edges, stencil reveals, and wet-sheen effects are removed.

[Open the local implementation](http://127.0.0.1:4179/). The timings below describe source configuration. Current assembly/browser verification is tracked separately from the historical paint-motion evidence at the end of this document. Current changes are local and have not been deployed.

## Arrival sequence

`wood-loader.js` exports `BLOCK_SEQUENCE` and `entryOffset()` for inspection and tests. The controller measures every block's final bounds once, plus viewport width/height, before creating any effect. Each starting translation places the complete rectangle 48 px beyond its assigned viewport edge, leaving room for its shadow. It then translates to its exact final layout position.

| Order | Block | Entry side | Start | Duration | End |
| --- | --- | --- | ---: | ---: | ---: |
| 1 | A | Left | 40 ms | 700 ms | 740 ms |
| 2 | B | Right | 190 ms | 700 ms | 890 ms |
| 3 | D | Left | 340 ms | 700 ms | 1040 ms |
| 4 | C | Right | 490 ms | 700 ms | 1190 ms |
| 5 | F | Right | 640 ms | 700 ms | 1340 ms |
| 6 | G | Bottom | 790 ms | 700 ms | 1490 ms |
| 7 | E | Left | 940 ms | 700 ms | 1640 ms |
| 8 | Central logo | Right | 1090 ms | 700 ms | 1790 ms |

Each block starts 150 ms after the preceding one and moves for 700 ms, including the logo. The core begins at 1090 ms while surrounding blocks are still arriving; there is no separate final pause or faster logo treatment. The last outer block finishes at 1640 ms and the core at 1790 ms. These timings start after image preflight, which resolves on decode or after at most 300 ms. The configured sequence therefore spans 1790–2090 ms, excluding script delivery and browser scheduling.

All eight native Web Animations change only `transform`, using `translate3d(...)` and `cubic-bezier(0.22, 0.75, 0.25, 1)`. The rectangles remain fully opaque and retain their size, shape, material, and logo. There is no arrival fade, clipping, scale, rotation, warping, or material transition. Both keyframes describe the same intact block at different positions.

Pending CSS temporarily hides the blocks while preflight runs. All eight effects are created with `fill: both` before that hidden state is removed, so delayed pieces already occupy their off-viewport starting positions. The homepage clips at the viewport boundary; the inner screen and mosaic allow blocks to travel across their layout edges. CSS returns to the final assembled composition when owned effects are cancelled.

## Breakup and shared navigation

`page-transitions.js` translates the eight blocks back beyond the edges identified by `data-block-side`. It uses whole-block transforms, not the former shrinking/clipped peel. Outward endpoints place rectangles 24 px outside the viewport. The reverse order is:

| Block | Start | Duration | End |
| --- | ---: | ---: | ---: |
| Central logo | 0 ms | 380 ms | 380 ms |
| E | 40 ms | 380 ms | 420 ms |
| G | 60 ms | 380 ms | 440 ms |
| F | 80 ms | 380 ms | 460 ms |
| C | 100 ms | 380 ms | 480 ms |
| D | 120 ms | 380 ms | 500 ms |
| B | 140 ms | 380 ms | 520 ms |
| A | 160 ms | 380 ms | 540 ms |

Breakup uses `cubic-bezier(0.55, 0.05, 0.68, 0.53)` and follows the accepted URL when all effects finish, with an 800 ms navigation deadline. The route implementation snapshots computed block transforms before finishing the entry controller and resets hover before creating departure effects. Its hero click listener runs in document capture. Pointer focus preserves the moving pose; keyboard `:focus-visible` settles the assembly so the focused link is stable. If that selector is unsupported, focus falls back to settling. Real mouse and emulated touch checks confirmed that early breakup retains the unfinished core's offscreen transform rather than jumping it into its final position.

All eight blocks are ordinary anchors with accessible names, keyboard activation, and `/about` as the destination. New-tab/modifier clicks, downloads, skip links, same-document fragment links, and unsupported schemes retain native behavior. The first accepted destination is retained during repeated clicks.

Secondary-page navigation is shared across About, Blog, Donate, Sponsor, Contact, the founder letter, and the note template. Same-origin links, including Home, start document navigation immediately. They no longer wait for separate content or button exit effects. The outgoing page stays available while the next document loads; browsers supporting cross-document view transitions blend the two root snapshots over **240 ms**, using opacity only and `cubic-bezier(0.2, 0, 0.2, 1)`. There is no content translation, button clipping, shrink, or per-item stagger. This uses the same-origin, both-pages opt-in model described in [Chrome's cross-document view transition documentation](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document).

The root image pair explicitly uses `isolation: isolate`, with `mix-blend-mode: plus-lighter` on both old and new snapshots. This keeps their complementary opacity fades within one isolated blend and avoids a background-color wash during the dissolve.

Every active template loads `page-transitions.css` and the classic, synchronous `page-transitions.js` in the head. Before the first paint, the script sets `data-page-motion="native"` on the root when `CSSViewTransitionRule` is available, or `data-page-motion="fade"` otherwise. Controller setup waits for the DOM. Native support uses `@view-transition { navigation: auto; }`; the CSS fallback reveals the header, main, footer, and Home link together over 240 ms. The fallback never waits for a deferred script to hide already-painted content and never adds a second fade after the block assembly. Returning Home receives `.is-home-return`, so fallback browsers can fade in the already assembled composition.

Letter and note-template backgrounds now use the same warm limestone treatment as the other pages. Their SVG diagrams start in their completed state, so the shared transition does not overlap a separate line-drawing or node-fade sequence.

External sites and app handlers use native navigation immediately: Apply and sponsorship forms, Stripe checkout, email, and telephone links incur no animation delay. Same-page links without a new query or fragment do not reload the page. The existing fragment, modifier, new-tab, download, and skip-link exceptions remain native.

## Home, reload, and lifecycle

| Situation | Behavior |
| --- | --- |
| Direct visit without a skip query | Assemble all eight blocks. |
| Home link to `/?skip-intro=1` | Navigate immediately and crossfade into the assembled composition; boot removes the query. Use a first-paint fade when native cross-document transitions are unavailable. |
| Actual browser reload | Assemble, even if `skip-intro=1` is still present before cleanup. |
| Fresh `back_forward` navigation or BFCache restoration | Show the assembled composition; supported browsers apply the native cross-document transition without replaying the intro. |
| Initial or newly enabled reduced motion | Show the assembled layout immediately and disable tilt. |
| Old `shp:skip-intro` or `shp:wood-intro-seen` session values | Ignore them; no session marker is read or written. |

`window.SHPWoodLoader` retains `start()`, `finish()`, and a state getter. States are now `pending`, `assembling`, and `settled`. Repeated calls are safe; a settled controller does not restart within its document. Reload creates a new controller governed by the primer above.

Start requires the primer request, a visible document, no reduced-motion preference, `--wood-loader-ready: 1`, eight uniquely identified blocks, and Web Animations support. Accepting start clears the primer's 1800 ms script-start watchdog. Texture preflight is capped at 300 ms; a separate 4000 ms controller watchdog bounds the whole operation. A late image error still settles the sequence.

The loader attaches click and keyboard-focus interruption to all eight anchors, plus Escape, hidden-page, `resize`, `pagehide`, persisted `pageshow`, and live reduced-motion handling. A change in viewport width or height settles immediately instead of continuing with stale offsets. A resize event with unchanged dimensions is ignored, including the initial no-op event observed in mobile emulation. `finish()` cancels only owned effects, clears timers and listeners, releases pending preflight work, removes pending/running classes, and exposes the final layout. Epoch guards prevent delayed decode or completion callbacks from restarting a finished run. No element inline styles are changed by assembly.

Without JavaScript, the initial semantic layout and anchors remain visible. Missing controller code releases the pending state through the primer watchdog. Missing loader CSS, bad/missing blocks, unsupported animation, failed image decode, invalid geometry, or partial setup errors all settle to the assembled fallback. Reduced-motion CSS can expose the blocks before JavaScript receives the preference event.

Shared navigation resets on `pagehide` and persisted `pageshow`. Reduced motion disables both native crossfades and fallback fades and leaves links immediately usable. Escape, hiding the page, or enabling reduced motion during an accepted hero departure preserves the destination and completes navigation. Accepted internal navigations have a 1500 ms restoration timer for slow or cancelled navigation; external sites and app handlers never enter the staged controller. These safeguards have unit coverage. New real external-app invocation remains untested.

## Settled interaction and implementation files

After assembly, every block stays at its exact grid position. Idle translation is removed: the old negative-phase float caused a visible adjustment when entry effects ended. Fine-pointer highlight and tilt still apply after settlement and outside departure; tilt stays within ±1.5° per axis. Keyboard focus retains its visible outline. Touch/coarse-pointer gating, preference handling, and reset hooks remain in `wood-hover.js` / `wood-hover.css`.

The outer pieces are now links rather than inert decorative `div` elements, so they have a pointer cursor and visible keyboard focus treatment. After settlement there are zero idle animations; cursor interaction may create short CSS transitions.

| File | Responsibility |
| --- | --- |
| `index.html` | Primer, eight real block anchors, `data-block-id` / `data-block-side`, asset loading. |
| `wood-loader.js` | Eight transform-only arrivals, geometry snapshot, ordering, lifecycle and failure recovery. |
| `wood-loader.css` | Fully drawn materials/logo, pending visibility, temporary compositor hints, reduced-motion fallback. |
| `page-transitions.js` / `.css` | Whole-block breakup, immediate internal navigation, pre-paint motion selection, native root crossfades, fallback fades, and restoration. |
| `wood-hover.js` / `.css` | Fixed grid positions, highlight/tilt, focus response, viewport clipping and hover cleanup. |
| `script.js` | One-use Home-query cleanup and idempotent loader boot/BFCache settlement. |
| `tests/wood-loader.test.js` | Assembly geometry, ordering, eight-effect ownership, primer and interruption/failure behavior. |
| `tests/page-transitions.test.js` | Immediate inner navigation, native-link exceptions, eight-block breakup, destination ownership, and interruption/failure recovery. |

The wood texture remains `assets/wood-grain.webp` (1536×1024, 240,266 bytes). This pass adds no asset or dependency. Material and logo children remain fully drawn throughout whole-block movement.

## Before / after

| Before | After |
| --- | --- |
| Stationary rectangles were revealed with paint masks and wet edges. | Intact, opaque rectangles physically translate in from their assigned viewport sides. All paint, brush, mask, stencil, and sheen animation code is removed. |
| The central logo remained static throughout the intro and exit. | The logo block is last in the regular arrival stagger and leads the reverse-order breakup. |
| Fourteen tile paint/sheen effects ended at 1780 ms. | Eight block transforms end at 1790 ms, after preflight capped at 300 ms. Geometry is measured once before effects are created. |
| Only the central plaque navigated; outer boards were decorative. | Every block is an accessible `/about` anchor. Settled outer blocks retain hover/focus feedback. |
| Outer tiles shrank, faded, rotated, and clipped away while the core stayed visible. | All eight rectangles translate intact toward their assigned edges; breakup finishes by 540 ms with an 800 ms navigation deadline. |
| Paint could continue with viewport-independent masks after a resize. | Changed viewport dimensions settle assembly immediately to avoid stale entry vectors; unchanged-size resize events do not interrupt it. |
| Pointer focus could settle an unfinished entry before the click captured its position. | Only keyboard-visible focus settles entry; document-capture click snapshots the current pose before breakup. |
| Home skipped once and reload replayed paint. | The same Home/reload/history rules now govern physical assembly. Reduced-motion and failure fallbacks remain immediate. |
| Previous tests and browser results validated paint/static-core behavior. | All 39 tests pass with the shared-duration timing; Chrome verifies the same duration, easing and stagger for every block. Previous browser evidence is labeled below. |
| Settlement started negative-phase idle float and shifted the fitted blocks. | Blocks stay at their exact landing positions after entry effects end. |
| The logo had a separate pause and shorter arrival duration. | Every block uses 700 ms with a uniform 150 ms stagger and the same easing; the core starts at 1090 ms and finishes at 1790 ms. |
| Inner content and action boxes ran separate staggered exits before navigation began. | Internal navigation begins immediately and supported browsers crossfade the entire page in place over 240 ms. |
| Home could receive two competing transforms and then cut abruptly to the hero. | Home returns to the fitted composition through the same page transition, with no block intro replay. |
| Deferred inner-page arrival code could hide content after it had already painted. | Head-time feature selection enables native transitions or a single CSS fade from the first paint. |
| Letter backgrounds and diagram animations changed independently of the route transition. | Letter and template share the limestone background and display completed diagrams. |

## Current verification

`node --test tests/wood-loader.test.js tests/page-transitions.test.js` passed **39 tests** after the shared-navigation change. Current browser evidence is separated below from older assembly checks.

| Current check | Result |
| --- | --- |
| Desktop internal navigation | Real Chrome verified Home, Sponsor, Blog, Letter, Letter → Home, Back, and Forward with the native root crossfade. No old inner-page translate, clipped-box, or scale effects remain. |
| Home | Returns to the settled eight-block composition through the 240 ms crossfade without replaying assembly. |
| Genuine homepage reload | Eight 700 ms block effects replay; no native view transition runs on reload. The existing assembly timing remains unchanged. |
| Mobile Home | Chrome touch emulation at 390×844 verified the native 240 ms Home transition, with no clipping or intro replay. |
| Reduced motion | Zero route or assembly motion. |
| CSS fallback | Verified in Chrome with the native constructor and opt-in disabled for QA. About's main, footer, and Home had synchronized opacity-only 240 ms CSS effects already present at `DOMContentLoaded`. Home showed one fade on the assembled grid with the intro request false. A full reload played eight block effects and settled without a second fade. This is forced-fallback browser evidence, not a physical unsupported-browser test. |
| Native blending | A native transition frozen at 90 ms was visually inspected after explicit isolated `plus-lighter` blending was added. |
| Slower navigation | With 450 ms network latency applied, Home completed with the native 240 ms crossfade and no intro replay. Old-frame visibility during the load was not quantified because the CDP context swap raced the measurement. |

The earlier shared-duration arrival check in Chrome at 1512×827 reported eight 700 ms effects, one shared easing, and delays of 40, 190, 340, 490, 640, 790, 940 and 1090 ms. A natural reload reached the fitted final composition without overflow or persistent animations. This arrival configuration is unchanged by the current navigation update.

### Historical assembly verification

The following **previous assembly checks** used Chrome desktop **1512×827** and mobile **390×844**. They predate the shared 700 ms duration and the current native page crossfades, and do not verify either refinement:

| Check | Result |
| --- | --- |
| Previous final alignment refinement | Browser geometry comparison before and after entry cleanup measured zero positional shift, still zero 1.2 seconds later. A natural reload finished with zero idle animations and no overflow. The then-current logo timing was 1660 ms delay / 420 ms duration. |
| Previous arrival and final layout | Eight transform-only entry effects. Under the old timing, all seven outer blocks finished while the core was still off-right; the final composition was intact with no overflow. |
| Early mouse activation | Real mouse-down left the loader `assembling` with `:focus-visible` false. Click created eight exits, preserving the core's offscreen starting X translation of 1009.8 px, then reached About. |
| Home and actual reload | Clicking Home returned to clean `/`, `settled`, request false, and zero entry effects. Actual reload returned to `assembling`, request true, and eight effects. |
| Keyboard | Tab to the first block settled assembly; Enter reached About. |
| Emulated coarse touch | Mobile reload retained all eight entry effects after the no-op resize fix. With coarse-pointer emulation active, early touch produced eight exits, preserved the offscreen core's 326.305 px starting X translation, and reached About. |
| Reduced motion | Settled immediately with zero effects and all eight blocks visible. |
| Settled pointer interaction | Board A selected with cursor X 50.98% and tilt X 0.12 degrees. Clicking the central logo produced eight intact exits and reached About. |
| History return | Browser Back restored `/` with the loader settled, transitions idle, and zero entry effects. |
| JavaScript disabled | All eight blocks remained visible and retained their `/about` anchors. |
| Local routes and assets | Homepage, About, Sponsor, Blog, and every local homepage script and stylesheet returned HTTP 200. |

Physical Safari/Android devices and new real external-app invocation have not been tested. Emulated touch is browser evidence, not a physical-device performance benchmark. Earlier screenshots below remain historical and are not presented as current assembly proof.

## Historical evidence: replaced implementations

These records are retained for traceability and do not describe the current arrival or breakup.

| Earlier pass | Preserved evidence |
| --- | --- |
| First wood-paint intro | 10 controller tests passed. Chrome desktop 1512×771/772 and mobile 390×844 checked an 18-effect paint/stencil sequence, once-per-session behavior and explicit replay, pointer/keyboard About navigation, Back restoration, initial/live reduced motion, no JavaScript, blocked controller/GSAP/texture/CSS, orientation change, hidden tab, Escape, and skip-query cleanup. Controller effects settled to zero. A 4× CPU-throttled local sample recorded 280 animation-frame intervals over about 2.8 seconds, 17 ms at the 95th percentile and 101 ms maximum including startup; this was not a physical-device benchmark. |
| Every-load intro and shared navigation | 13 loader + 15 route tests passed (28 total), with syntax/whitespace/internal-link checks. Chrome desktop 1512×771 and mobile 390×844 checked two genuine reloads with old session flags, 18 effects during painting and zero after three seconds, pointer/keyboard hero exits, Sponsor/Donate/Blog routes, Back/Home, reduced motion, and no mobile overflow. The then-current Home link replayed the full intro. |
| Static-core paint and ambient hover | 15 loader + 17 route tests passed (32 total), with syntax/whitespace/internal-link checks. Chrome desktop 1512×827 and mobile 390×844 checked 14 finite paint effects, zero core effects, seven settled float effects, selected-board pause/highlight (Board A cursor X 67.93%, tilt X 0.83°), selection cleanup, no hover during paint, a static-core exit, actual Home skip followed by a true reload, and live reduced motion yielding zero total effects. Mobile screenshots showed a full-contrast logo without clipping, overlap, or horizontal overflow. |
| Replaced staggered inner-page navigation | The former controller entered content over 320 ms and action boxes over 300 ms with per-item delays, then exited content over 260 ms and clipped/shrank boxes over 300 ms before navigation. It used a 900 ms arrival watchdog and a 650 ms inner departure watchdog. Those inner-page effects and timers are removed; their earlier passing checks are not evidence for the current crossfade. |

Earlier browser overrides were reset after QA. Historical touch/coarse-pointer exclusion was code-reviewed, not tested on physical touch hardware; external HTTP/mail/telephone handling had unit coverage without new real app invocation.

The original paint treatment drew on [Codrops mask separation](https://tympanus.net/codrops/2026/03/11/svg-mask-transitions-on-scroll-with-gsap-and-scrolltrigger/), [Zion & Zion brush reveals](https://www.zionandzion.com/how-to-manipulate-an-svg-to-create-brush-stroke-animation/), and [Rubio Monocoat finishing rhythm](https://help.rubiomonocoatusa.com/en-US/how-to-apply-oil-plus-2c-to-furniture-273135). These are historical material-direction references, not a description of the current physical assembly.

Historical browser frames, not current assembly mockups or proof:

- [Brushed stain, 650 ms](/Users/shreshth/.codex/visualizations/2026/09/13/01a09bcd-7f79-7541-9a7b-547b56877aaf/wood-motion/wood-loader-final-650.png)
- [Plaque paint passes, 1500 ms](/Users/shreshth/.codex/visualizations/2026/09/13/01a09bcd-7f79-7541-9a7b-547b56877aaf/wood-motion/wood-loader-final-1500.png)
- [Stencil reveal, 2000 ms](/Users/shreshth/.codex/visualizations/2026/09/13/01a09bcd-7f79-7541-9a7b-547b56877aaf/wood-motion/wood-loader-final-2000.png)
- [Old final composition](/Users/shreshth/.codex/visualizations/2026/09/13/01a09bcd-7f79-7541-9a7b-547b56877aaf/wood-motion/wood-loader-final-settled.png)
- [Mobile paint passes, 1500 ms](/Users/shreshth/.codex/visualizations/2026/09/13/01a09bcd-7f79-7541-9a7b-547b56877aaf/wood-motion/wood-loader-mobile-1500.png)

/* =========================================================
   MIRABELLE.B — scroll-driven motion layer
   ---------------------------------------------------------
   - Lenis smooth scroll drives everything
   - The fixed background video is SCRUBBED by scroll position;
     it is never played. Scroll progress maps to currentTime.
   - GSAP ScrollTrigger handles pins, reveals and parallax.
   ========================================================= */

import Lenis from "lenis";
import { setupBooking } from "./booking.js";
import { setupReviews } from "./reviews.js";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ---------------------------------------------------------
   Environment guards
   --------------------------------------------------------- */

const prefersReduced = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const isTouch = window.matchMedia("(hover: none), (max-width: 768px)").matches;

/** Scrub the video only where it is actually visible and affordable. */
const useVideo = !prefersReduced && !isTouch;

/** Pinned sections are desktop-only — they fight touch scrolling. */
const usePins = !prefersReduced && !isTouch;

/* ---------------------------------------------------------
   Smooth scroll
   --------------------------------------------------------- */

let lenis = null;

function setupLenis() {
  if (prefersReduced) return; // native scrolling, no smoothing

  lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.6,
  });

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* Landing on the page WITH a hash — which is what every "Book this style"
   button does: /?service=knotless-braids#book.

   The browser jumps to the anchor natively before any of this runs, so the
   document ends up thousands of pixels down while Lenis initialises believing
   it is at zero. From then on the two disagree: Lenis drives the scroll and
   thinks there is nothing above, so scrolling up does nothing and the visitor
   is stranded at the booking form with no way back up the page.

   The fix refuses the browser's jump, lets the pins measure from the top,
   then travels to the anchor through Lenis so both agree on where we are. */
/* The nav is fixed, so scrolling a section to y=0 parks its heading behind
   it. Every anchor travel therefore stops short by the height of the bar.

   Measured at call time, never hardcoded: the bar is 92px on desktop and 82px
   on a phone, and both numbers moved when the logo grew from 38px to 56/46.
   A constant here would have been wrong within the week. */
function navOffset() {
  const nav = document.querySelector(".nav");
  return nav ? -Math.round(nav.getBoundingClientRect().height) : 0;
}

function setupInitialHash() {
  const hash = window.location.hash;
  if (!hash || hash === "#") return;

  let target;
  try {
    target = document.querySelector(hash);
  } catch {
    return; // not a valid selector
  }
  if (!target) return;

  // Undo the native jump before anything measures from it.
  window.scrollTo(0, 0);
  if (lenis) lenis.scrollTo(0, { immediate: true });

  const settle = () => {
    ScrollTrigger.refresh();
    // Two frames: refresh() re-lays the pins, and the new positions are not
    // final until the following paint.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (lenis)
          lenis.scrollTo(target, {
            immediate: true,
            force: true,
            offset: navOffset(),
          });
        else target.scrollIntoView();
      })
    );
  };

  if (document.readyState === "complete") settle();
  else window.addEventListener("load", settle, { once: true });
}

/** Anchor links routed through Lenis so pins don't get skipped. */
function setupAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: navOffset(), duration: 1.4 });
      else target.scrollIntoView({ behavior: "smooth" });
    });
  });
}

/* ---------------------------------------------------------
   Background video scrub
   ---------------------------------------------------------
   Page scroll progress (0..1) maps linearly onto the video
   timeline. Seeks below the threshold are dropped so the
   decoder is not thrashed on every scroll frame.
   --------------------------------------------------------- */

let bgVideo = null;

function setupVideoScrub() {
  bgVideo = document.getElementById("bgv");
  if (!bgVideo) return;

  if (!useVideo) {
    // Free the download entirely on touch / reduced-motion.
    bgVideo.removeAttribute("src");
    bgVideo.load();
    return;
  }

  let metaReady = false;
  let lastVideoT = -1;
  let pendingT = -1;

  /* Source frame duration. bg.mp4 is 24fps, built by
     scripts/hero-from-image.sh — keep these in step if the hero is rebuilt by
     a different script (hero-from-portrait.sh emits 30fps). Seeking to a time
     between two frames decodes the same picture as seeking to the frame
     itself, so finer targets are pure decoder work. */
  const FRAME = 1 / 24;

  /* A scrubbed video is a frozen image until someone scrolls, so the hero
     reads as a broken still on arrival. It loops gently instead, and hands
     the timeline to the scrubber the moment the visitor actually scrolls. */
  let ambient = false;

  function startAmbient() {
    ambient = true;
    bgVideo.loop = true;
    const p = bgVideo.play();
    // Autoplay can still be refused despite muted+playsinline. Not fatal —
    // the first scroll takes over regardless.
    if (p && typeof p.catch === "function") p.catch(() => {});
  }

  function endAmbient() {
    if (!ambient) return;
    ambient = false;
    bgVideo.loop = false;
    bgVideo.pause();
  }

  const onReady = () => {
    metaReady = true;
    startAmbient();
  };

  bgVideo.addEventListener("loadedmetadata", onReady, { once: true });

  /* Seeks issued while one is already in flight are discarded by the browser,
     and a fast scroll issues them faster than the decoder retires them — the
     background then lags and snaps late. Park the newest target and apply it
     when the decoder frees up. */
  bgVideo.addEventListener("seeked", () => {
    if (pendingT < 0) return;
    const t = pendingT;
    pendingT = -1;
    if (t !== lastVideoT) {
      bgVideo.currentTime = t;
      lastVideoT = t;
    }
  });

  // The markup ships preload="none" on purpose: at ~10 MB this file will
  // otherwise hold the window `load` event open for seconds, which delays
  // ScrollTrigger.refresh() and makes the page read as "still loading".
  // We opt into full buffering only once the page is already interactive.
  const beginBuffering = () => {
    bgVideo.preload = "auto";
    bgVideo.load();
  };

  if (document.readyState === "complete") beginBuffering();
  else window.addEventListener("load", beginBuffering, { once: true });

  function syncVideo() {
    if (!metaReady) return;

    const duration = bgVideo.duration;
    if (!duration || !isFinite(duration)) return;

    const scroll = lenis ? lenis.scroll : window.scrollY;
    const limit = lenis
      ? lenis.limit
      : document.documentElement.scrollHeight - window.innerHeight;

    // Below this the visitor has not really scrolled — let the loop run.
    if (ambient) {
      if (scroll < 24) return;
      endAmbient();
    }

    const progress = limit > 0 ? Math.min(1, Math.max(0, scroll / limit)) : 0;
    const t = Math.round((progress * (duration - 0.05)) / FRAME) * FRAME;

    if (t === lastVideoT) return;

    if (bgVideo.seeking) {
      pendingT = t; // newest target wins; `seeked` applies it
      return;
    }

    bgVideo.currentTime = t;
    lastVideoT = t;
  }

  if (lenis) lenis.on("scroll", syncVideo);
  else window.addEventListener("scroll", syncVideo, { passive: true });

  window.addEventListener("resize", syncVideo);
}

/* ---------------------------------------------------------
   Marquee
   ---------------------------------------------------------
   Renders a row twice and translates the track by exactly
   one copy, so the seam never arrives. See the CSS for why
   spacing is margin-right rather than gap.

   Duration scales with item count: a fixed 20s would have
   five covers crawling and fourteen tiles racing. Seconds
   per item keeps every strip moving at the same speed.
   --------------------------------------------------------- */

function marquee(scroller, secondsPerItem = 5) {
  if (!scroller || scroller.dataset.marquee === "on") return;

  const items = [...scroller.children];
  if (!items.length) return;

  const track = document.createElement("div");
  track.className = "marquee__track";
  items.forEach((item) => track.appendChild(item));

  /* The second copy exists only to fill the frame while the first scrolls
     out. Anything focusable inside it duplicates a real control, so it is
     hidden from assistive tech and taken out of the tab order — clicks still
     work, because the handler is delegated on the section. */
  items.forEach((item) => {
    const clone = item.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.dataset.clone = "true";
    if (typeof clone.tabIndex === "number") clone.tabIndex = -1;
    clone.querySelectorAll("a, button, input, [tabindex]").forEach((f) => {
      f.tabIndex = -1;
    });
    track.appendChild(clone);
  });

  track.style.setProperty(
    "--marquee-duration",
    items.length * secondsPerItem + "s"
  );
  scroller.classList.add("marquee");
  scroller.dataset.marquee = "on";
  scroller.appendChild(track);
}

/* ---------------------------------------------------------
   Pattern row — one cover each, click to open the set
   ---------------------------------------------------------
   Buttons rather than tabs, deliberately. A tablist implies
   one panel is always showing and arrow keys move between
   them; here every panel starts closed, clicking the open
   one closes it again, and the resting state is five covers.
   That is disclosure, not tabs, so aria-expanded and native
   button behaviour are the honest mapping.

   The row and every panel are marquees, so each card exists
   twice in the DOM. Clicks are therefore delegated, and
   state is written to every copy of a card keyed on the
   panel it controls — binding to elements would miss the
   clones and leave them showing the wrong caret.
   --------------------------------------------------------- */

function setupPatterns() {
  const root = document.querySelector("#patterns");
  if (!root) return;

  const row = root.querySelector(".patterns__row");
  const panels = [...root.querySelectorAll(".pattern__panel")];
  if (!row || !panels.length) return;

  marquee(row, 5);

  panels.forEach((panel) => {
    const strip = panel.querySelector(".styles__grid");
    if (!strip) return;
    /* Hand the strip over to the marquee rules. .styles__grid sizes tiles at
       width:100% of a grid column; left in place it wins the cascade against
       .marquee__track img and blows each tile up to the full track width. */
    strip.classList.replace("styles__grid", "pattern__strip");
    marquee(strip, 5);
  });

  function toggle(id) {
    const current = root.querySelector(`.pattern[aria-controls="${id}"]`);
    const opening = current?.getAttribute("aria-expanded") !== "true";

    root.querySelectorAll(".pattern").forEach((b) => {
      const active = b.getAttribute("aria-controls") === id && opening;
      b.setAttribute("aria-expanded", String(active));
      b.classList.toggle("is-open", active);
    });

    panels.forEach((p) => {
      p.hidden = !(p.id === id && opening);
    });

    // A row that keeps moving under the pointer is hostile once the visitor
    // has started choosing. Opening anything stops it.
    row.classList.toggle("is-paused", opening);

    // Panel heights differ, and the pinned sections below are measured in
    // absolute scroll distance.
    ScrollTrigger.refresh();
  }

  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".pattern");
    if (btn && root.contains(btn)) toggle(btn.getAttribute("aria-controls"));
  });
}

function setupScrim() {
  const root = document.documentElement;

  function render() {
    const scroll = lenis ? lenis.scroll : window.scrollY;
    const vh = window.innerHeight;

    /* Clear through the hero, ramping to a firm dim just after it. The
       background is fixed, so every section below the fold shares one frame;
       without this the copy competes with whatever is behind it. */
    const boost =
      gsap.utils.clamp(0, 1, (scroll - vh * 0.45) / (vh * 0.55)) * 0.52;

    root.style.setProperty("--scrim-boost", boost.toFixed(3));
  }

  render();

  if (lenis) lenis.on("scroll", render);
  else window.addEventListener("scroll", render, { passive: true });

  window.addEventListener("resize", render);
}

/* ---------------------------------------------------------
   Nav condensed state
   --------------------------------------------------------- */

function setupNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;

  ScrollTrigger.create({
    start: 80,
    end: "max",
    onToggle: (self) => nav.classList.toggle("is-stuck", self.isActive),
  });
}

/* ---------------------------------------------------------
   Our Work — board on wide screens, cards below 1100px
   ---------------------------------------------------------
   Both sets live in the DOM so rotating a phone or dragging a
   window across the breakpoint swaps instantly. Only one set is
   ever fetched: the board is 443 KB and the ten tiles are about
   220 KB, and CSS alone cannot stop the hidden one downloading.
   So src is parked in data-src until a set is the visible one.

   The query below mirrors the 1100px breakpoint in style.css.
   Changing one without the other loads the wrong set.
   --------------------------------------------------------- */

function setupWorkShowcase() {
  const section = document.querySelector("#styles");
  if (!section) return;

  // The composed board is retired: it could not carry a price, a Book button,
  // or anything a search engine can read. The cards run at every width now, so
  // there is no swap to manage and the board is never fetched.
  const cards = [...section.querySelectorAll(".work-card img")];

  cards.forEach((el) => {
    if (!el.dataset.src) return;
    el.src = el.dataset.src;
    delete el.dataset.src;
  });
}

/* ---------------------------------------------------------
   Mobile menu
   ---------------------------------------------------------
   .nav__links is display:none below 1024px, which left phones
   with no navigation at all on a page 11,000px tall. This is
   the replacement. Two rules it has to keep:

   1. The 1024px breakpoint here and in style.css must agree,
      or a width exists with two navigations or none.
   2. Lenis has to be paused while it is open. body{overflow:
      hidden} alone does not hold, because Lenis drives scroll
      on a transform and ignores overflow.
   --------------------------------------------------------- */

function setupMenu() {
  const btn = document.querySelector("#nav-menu-btn");
  const panel = document.querySelector("#nav-overlay");
  if (!btn || !panel) return;

  const wide = window.matchMedia("(min-width: 1025px)");
  let lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-label", "Close menu");
    document.body.classList.add("is-menu-open");
    if (lenis) lenis.stop();
    panel.querySelector("a")?.focus();
  }

  function close({ restoreFocus = true } = {}) {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Open menu");
    document.body.classList.remove("is-menu-open");
    if (lenis) lenis.start();
    // Returning focus after a link click would yank the visitor back to the
    // header they just navigated away from.
    if (restoreFocus) (lastFocus || btn).focus();
  }

  const isOpen = () => !panel.hidden;

  btn.addEventListener("click", () => (isOpen() ? close() : open()));

  // Any link closes it. setupAnchors already owns the smooth scroll, and it
  // needs Lenis running again before it fires, so close first.
  //
  // Capture phase is load-bearing, not a style choice. setupAnchors binds its
  // handler to the <a> itself, so in the bubble phase the link handler runs
  // first and calls lenis.scrollTo() while Lenis is still stopped — and
  // Lenis drops any scrollTo issued while stopped. The drawer would close
  // onto an unmoved page and the first tap would do nothing. Capturing here
  // restarts Lenis before the link handler fires.
  panel.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("a")) close({ restoreFocus: false });
    },
    true
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) close();
  });

  // Keep focus inside while open, so tabbing cannot land on the page behind.
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const items = [...panel.querySelectorAll("a,button")].filter(
      (el) => el.offsetParent !== null
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      btn.focus(); // the toggle is the natural next stop, and it closes
    }
  });

  // Rotating to landscape can cross the breakpoint with the panel open,
  // which would leave an overlay covering a page that has its own nav back.
  wide.addEventListener("change", (e) => {
    if (e.matches && isOpen()) close({ restoreFocus: false });
  });
}

/* ---------------------------------------------------------
   Generic reveals
   --------------------------------------------------------- */

function setupReveals() {
  const items = gsap.utils.toArray(".reveal");
  if (!items.length) return;

  if (prefersReduced) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }

  ScrollTrigger.batch(items, {
    start: "top 88%",
    once: true,
    onEnter: (batch) =>
      batch.forEach((el, i) =>
        setTimeout(() => el.classList.add("is-in"), i * 90)
      ),
  });
}

/* ---------------------------------------------------------
   Hero — scroll-expand
   ---------------------------------------------------------
   The hero frame starts as a 300x400 card and grows to fill
   the viewport as the section is scrolled through. The
   wordmark splits at its dot and clears the frame on the way
   out; the copy fades in once the picture is open.

   Ported from a React/Framer Motion component that hijacked
   wheel and touch events and held window.scrollY at 0 until
   the expansion finished. That fights the browser, breaks
   keyboard and scrollbar scrolling, and would collide with
   Lenis. A pinned ScrollTrigger buys the same effect from
   real scroll distance, matches the other pinned sections,
   and stays reversible and interruptible for free.
   --------------------------------------------------------- */

function setupHeroExpand() {
  const section = document.querySelector("#home");
  const pin = document.querySelector("#hero-pin");
  const card = document.querySelector("#hero-card");
  if (!section || !pin || !card) return;

  const bed = document.querySelector("#hero-bed");
  const veil = document.querySelector("#hero-veil");
  const meta = document.querySelector("#hero-meta");
  const reveal = document.querySelector("#hero-reveal");
  const scrim = document.querySelector("#hero-scrim");
  const wordL = document.querySelector(".hero__word--l");
  const wordR = document.querySelector(".hero__word--r");
  const metaL = document.querySelector(".hero__meta-l");
  const metaR = document.querySelector(".hero__meta-r");

  const clamp = gsap.utils.clamp(0, 1);

  // crowned-by-hand-hero.webp, 2688x1520. The pan needs this to know how far
  // cover overflows the card at any given size.
  const SRC_ASPECT = 2688 / 1520;

  /* Progress window each element moves through, as [start, end]. Staggering
     these is what stops the expansion reading as one blunt zoom: the bed
     clears early, the wordmark leaves through the middle, the copy only
     arrives once there is a picture to sit on. */
  const BED = [0, 0.72];
  const WORD_FADE = [0.5, 0.92];
  const META_FADE = [0.08, 0.5];
  const COPY = [0.76, 1];

  const at = ([a, b], p) => clamp((p - a) / (b - a));

  function render(p) {
    const vw = window.innerWidth;
    const vh = pin.clientHeight || window.innerHeight;

    // Resting size, held off the edges on narrow screens so the card never
    // starts out already touching them.
    const w0 = Math.min(300, vw * 0.72);
    const h0 = Math.min(400, vh * 0.62);

    const w = w0 + (vw - w0) * p;
    const h = h0 + (vh - h0) * p;

    card.style.width = w + "px";
    card.style.height = h + "px";
    card.style.borderRadius = 14 * (1 - p) + "px";
    // The shadow is what separates the card from the bed. Once the card IS
    // the frame there is nothing left to separate it from.
    card.style.boxShadow = `0 30px 90px rgba(0, 0, 0, ${0.55 * (1 - p)})`;

    /* The card is centred in the frame, but the subject was not centred in
       the card: at 3:4 the crop window is narrow, and the natural 50% lands
       on the empty left third of the source. Hold the hands mid-card while
       it is small, then ease back to the true composition as the frame opens
       and there is room for the whole picture again. */
    const img = card.firstElementChild;
    if (img) {
      /* A left-to-right pan across the photograph.

         Panning by a fixed percentage does not work here, because how far
         the picture CAN travel changes as the card grows: at 3:4 cover
         overflows by more than twice the card width, at full bleed by about
         10%. A percentage tuned to look right while small overshoots the
         overflow at full bleed and pulls the image off its own right edge —
         which is exactly what a fixed -24% did, leaving a 150px strip of
         backdrop down the right of the frame.

         So the pan is expressed as a fraction of whatever slack actually
         exists at this size, and cannot exceed it by construction. +1 is
         hard against the left of the picture, -1 hard against the right.

         The subject sits in the right half of the source: the left ~45% is
         unlit room and the sconce. Opening hard on that left third left the
         small card looking empty, so the resting crop now sits on the hands
         with just enough room to their left to keep the candle in frame.
         From there it drifts further right as the frame opens, so the zoom
         reads as moving INTO the work rather than travelling across dead
         space to find it. */
      const zoom = 1 + p * 0.28;
      const coverW = w / h < SRC_ASPECT ? h * SRC_ASPECT : w;
      const slack = Math.max(0, (coverW * zoom - w) / 2);
      const pan = -0.28 - p * 0.3;

      img.style.objectPosition = "50% 50%";
      img.style.transform = `translateX(${pan * slack}px) scale(${zoom})`;

      // Comes up out of the dark as it grows rather than simply getting
      // bigger — the picture is the reward for scrolling.
      img.style.filter = `brightness(${0.84 + p * 0.26}) saturate(${
        0.88 + p * 0.22
      })`;
    }

    // Widened from 0.5->0.28. The old range barely moved, so the expansion
    // read as a resize; most of the reveal now happens in the veil.
    if (veil) veil.style.opacity = String(0.6 - p * 0.54);
    if (bed) bed.style.opacity = String(1 - at(BED, p));

    const wordOut = p * 62;
    const wordFade = 1 - at(WORD_FADE, p);
    if (wordL) {
      wordL.style.transform = `translateX(${-wordOut}vw)`;
      wordL.style.opacity = String(wordFade);
    }
    if (wordR) {
      wordR.style.transform = `translateX(${wordOut}vw)`;
      wordR.style.opacity = String(wordFade);
    }

    const metaOut = p * 40;
    if (meta) meta.style.opacity = String(1 - at(META_FADE, p));
    if (metaL) metaL.style.transform = `translateX(${-metaOut}vw)`;
    if (metaR) metaR.style.transform = `translateX(${metaOut}vw)`;

    // Leads the copy slightly so the type never lands on an unscrimmed frame.
    if (scrim) scrim.style.opacity = String(at([0.62, 0.94], p));
    if (reveal) reveal.style.opacity = String(at(COPY, p));
  }

  if (!usePins) {
    // Static hero: full-bleed picture, wordmark back in the copy column.
    section.classList.add("hero--static");
    return;
  }

  render(0);

  ScrollTrigger.create({
    trigger: section,
    start: "top top",
    /* Long enough that the growth is legible rather than a snap, short
       enough that a visitor is not scrolling blind. Matches the 1.7x the
       impact pin uses. */
    end: () => "+=" + window.innerHeight * 1.6,
    pin,
    scrub: 0.6,
    invalidateOnRefresh: true,
    onUpdate: (self) => render(self.progress),
  });
}

/* ---------------------------------------------------------
   Subtle image parallax
   --------------------------------------------------------- */

function setupParallax() {
  if (prefersReduced) return;

  gsap.utils.toArray("[data-parallax]").forEach((el) => {
    const strength = parseFloat(el.dataset.parallax) || 0.1;

    gsap.fromTo(
      el,
      { yPercent: -strength * 100 },
      {
        yPercent: strength * 100,
        ease: "none",
        scrollTrigger: {
          trigger: el.closest(".media-frame") || el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true,
        },
      }
    );
  });
}

/* ---------------------------------------------------------
   Misc
   --------------------------------------------------------- */

function setupYear() {
  const el = document.getElementById("year");
  if (el) el.textContent = String(new Date().getFullYear());
}

/* ---------------------------------------------------------
   Placeholder guard
   ---------------------------------------------------------
   The phone number, pricing, address and booking target are
   stand-ins taken from the brand kit's unresolved items
   (Appendix A). Fabricated contact details are the kind of
   thing that ships by accident, so the build refuses to stay
   quiet about them.
   --------------------------------------------------------- */

const PLACEHOLDERS = [
  [
    "Google Business Profile",
    "#words reviews card and the schema have no profile URL yet — add it, then quote real reviews with attribution",
  ],
  [
    "Business identity",
    "terms.html still needs the legal entity name and structure, and the Virginia cosmetology/braiding licence — the two things a lender checks first",
  ],
  [
    "Data retention",
    "privacy.html does not say how long booking records are kept before deletion",
  ],
  ['"Sisterlocks" term', 'built as "microlocs" pending certification check'],
];

function warnPlaceholders() {
  if (!import.meta.env.DEV) return;

  console.groupCollapsed(
    "%c⚠ Mirabelle.B — %c" +
      PLACEHOLDERS.length +
      " placeholders still in the page",
    "color:#D2A24C;font-weight:700",
    "color:#D6C4B2;font-weight:400"
  );
  PLACEHOLDERS.forEach(([what, detail]) =>
    console.log(`%c${what}%c — ${detail}`, "color:#E8C888", "color:#9A8778")
  );
  console.log("See website/README.md → “Placeholder content”.");
  console.groupEnd();
}

/* ---------------------------------------------------------
   Boot
   --------------------------------------------------------- */

function init() {
  /* A browser restoring a previous scroll position on back/forward lands us
     in the same desynced state as a hash jump. We place the scroll ourselves. */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  setupLenis();
  setupInitialHash();
  setupAnchors();
  setupVideoScrub();
  setupHeroExpand();
  setupScrim();
  setupPatterns();
  setupWorkShowcase();
  setupBooking();
  setupReviews();
  setupMenu();
  setupNav();
  setupReveals();
  setupParallax();
  setupYear();
  warnPlaceholders();

  // Layout settles after fonts land — pins depend on final metrics.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  window.addEventListener("load", () => ScrollTrigger.refresh());

  if (import.meta.env.DEV) {
    window.__lenis = lenis;
    window.__ST = ScrollTrigger;
    window.__bgv = bgVideo;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

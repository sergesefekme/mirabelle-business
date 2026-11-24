/* ---------------------------------------------------------
   Cookie consent, and the Meta Pixel and Google Analytics it gates
   ---------------------------------------------------------
   ONE FILE, ONE PLACE TO PASTE EACH ID — see PIXEL_ID and GA4_ID below. Every
   page loads this same file, so neither ID is ever duplicated and neither can
   drift between the home page and the generated service pages.

   NOTHING LOADS UNTIL SOMEONE ACCEPTS — not the Pixel, not Google Analytics.
   That is the whole point of this file. Meta's own snippet fires on injection, so it cannot simply be
   pasted into <head> behind an if-statement added later — it has to be
   injected only after a choice is recorded. Until then no Meta script is
   fetched, no cookie is set, and no request reaches facebook.net.

   Declining is a real answer and is remembered. The banner does not reappear
   on every page, and there is no dark pattern: Decline is a button of the
   same size and prominence as Accept.

   Self-contained by design: it injects its own styles rather than depending
   on style.css or landing.css, because it has to work identically on the
   home page, the service pages and the policy pages, which use different
   stylesheets.

   NOT loaded on /admin.html. That is a staff tool behind a login; tracking
   Mirabelle's own use of her dashboard would pollute the very data this is
   installed to collect.
   --------------------------------------------------------- */

/* ===========================================================
   The Meta Pixel ID. This is the only place it appears.
   ===========================================================

   THE <noscript> HALF OF META'S SNIPPET IS DELIBERATELY ABSENT.
   Meta's paste-in code ends with a <noscript><img src=".../tr?id=..."> that
   fires the moment the HTML is parsed. It cannot be gated — a browser with
   JavaScript disabled runs no consent logic — so including it would track
   those visitors without asking, which is exactly what this file exists to
   prevent. The cost is losing a sliver of no-JS traffic from the reporting.
   That is the right side of the trade. */
const PIXEL_ID = "1614226446907840";

/* ===========================================================
   The Google Analytics 4 Measurement ID ("G-XXXXXXXXXX").
   ===========================================================
   EMPTY MEANS OFF. While this is "", no Google script is ever requested and
   the banner asks about Meta alone, exactly as before.

   SHIP THE ID AND THE PRIVACY POLICY TOGETHER. privacy.html describes Google
   Analytics as running on Accept; the ID is what makes that true.

   Pasting an ID also raises the consent version below, so everyone who
   accepted when the banner named Meta alone is asked again. Their earlier
   "yes" never covered Google, and it is not ours to assume. */
const GA4_ID = "";

const KEY = "mb_consent";
// Bump to re-ask everyone after a material policy change. Turning on GA4 is
// one, so it moves the version by itself.
const VERSION = GA4_ID ? 2 : 1;

function stored() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && v.version === VERSION ? v : null;
  } catch {
    return null;
  }
}

function remember(choice) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ choice, version: VERSION, at: new Date().toISOString() })
    );
  } catch {
    /* private mode: the choice holds for this page view only, which errs
       toward not tracking. */
  }
}

/* ---------------- the Pixel ---------------- */

let pixelLoaded = false;

function loadPixel() {
  if (pixelLoaded || !PIXEL_ID) return;
  pixelLoaded = true;

  /* Meta's standard snippet. Injected here rather than in <head> so that no
     request to facebook.net happens before consent. */
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq("init", PIXEL_ID);
  window.fbq("track", "PageView");
}

/* ---------------- Google Analytics 4 ---------------- */

/* gtag.js gets a dataLayer of its OWN (the &l= parameter). The shared
   window.dataLayer carries our event objects, and gtag.js reads any dataLayer
   it is attached to; sharing one would let it pick those objects up as well as
   the explicit gtag("event") calls in forward(), and every click would risk
   being counted twice. Separate queues make double counting impossible. */
const GA_LAYER = "mbGtagLayer";
let gaLoaded = false;

function gtag() {
  window[GA_LAYER].push(arguments);
}

/* Query parameters GA may see. Anything else in the URL is dropped before GA
   is told where the visitor is, as is any #fragment. */
const GA_KEEP = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "service",
]);

function safeLocation() {
  const out = new URLSearchParams();
  new URLSearchParams(location.search).forEach((v, k) => {
    if (GA_KEEP.has(k)) out.append(k, v.slice(0, 100));
  });
  const q = out.toString();
  return location.origin + location.pathname + (q ? "?" + q : "");
}

/* The referring site's address only — which site sent them is the useful
   part; the path and query of someone else's page are not ours to pass on. */
function safeReferrer() {
  try {
    return document.referrer ? new URL(document.referrer).origin + "/" : "";
  } catch {
    return "";
  }
}

function loadGA() {
  if (gaLoaded || !GA4_ID) return;
  gaLoaded = true;

  window[GA_LAYER] = window[GA_LAYER] || [];

  // Only ever reached after Accept. Analytics is granted; advertising storage
  // stays denied — the site runs no Google Ads, and Accept was never asked to
  // cover them.
  gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  gtag("js", new Date());
  gtag("config", GA4_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    // By default GA records the full address bar and the full referrer. A
    // link from an email tool or another site can carry ?email=, a name or a
    // token in its query string, and Google's terms forbid receiving it. GA
    // gets the path, the campaign tags and the service slug — nothing else.
    page_location: safeLocation(),
    page_referrer: safeReferrer(),
  });

  const s = document.createElement("script");
  s.async = true;
  s.src =
    "https://www.googletagmanager.com/gtag/js?id=" +
    encodeURIComponent(GA4_ID) +
    "&l=" +
    GA_LAYER;
  document.head.appendChild(s);
}

/* Called on Accept, and on every later page view by someone who accepted. */
function loadTrackers() {
  loadPixel();
  loadGA();
  // Replay anything that happened before consent was given, and forward
  // everything after it.
  drainDataLayer();
}

/* GA4 receives our events under their own names, so the GA reports, the Meta
   mapping below and the dataLayer all speak the same vocabulary. Mark
   booking_submitted as the Key Event in GA4 (Admin → Events). Only
   non-personal fields are passed: never a name, phone, email or note. */
const GA_EVENTS = new Set([
  "service_page_viewed",
  "book_now_clicked",
  "booking_started",
  "booking_submitted",
  "phone_clicked",
  "email_clicked",
]);

function forwardGA(entry) {
  if (!gaLoaded || !GA_EVENTS.has(entry.event)) return;
  const params = {};
  for (const k of ["service", "source", "campaign", "placement"]) {
    if (entry[k]) params[k] = String(entry[k]).slice(0, 100);
  }
  gtag("event", entry.event, params);
}

/* Maps our own events onto Meta's standard ones. Kept in one place so the
   mapping is auditable: the only thing that counts as a conversion is
   booking_submitted, which booking.js fires solely after the row is stored. */
function forward(entry) {
  if (!entry || !entry.event) return;
  forwardGA(entry);
  if (!window.fbq) return;
  switch (entry.event) {
    case "service_page_viewed":
      window.fbq("track", "ViewContent", {
        content_name: entry.service || undefined,
        content_category: "Service",
      });
      break;
    case "book_now_clicked":
      // InitiateCheckout, deliberately NOT Lead. A tap is intent, not a lead.
      window.fbq("track", "InitiateCheckout", {
        content_name: entry.service || undefined,
      });
      break;
    case "booking_started":
      window.fbq("trackCustom", "BookingStarted", {
        content_name: entry.service || undefined,
      });
      break;
    case "booking_submitted":
      // THE CONVERSION. Fires only after the booking is stored.
      window.fbq("track", "Lead", {
        content_name: entry.service || undefined,
        content_category: "Appointment request",
      });
      window.fbq("track", "Schedule", {
        content_name: entry.service || undefined,
      });
      break;
    case "phone_clicked":
    case "email_clicked":
      window.fbq("track", "Contact");
      break;
  }
}

let drained = 0;
function drainDataLayer() {
  const dl = (window.dataLayer = window.dataLayer || []);
  while (drained < dl.length) forward(dl[drained++]);

  // Take over push so later events forward immediately.
  if (!dl.__mbPatched) {
    const original = dl.push.bind(dl);
    dl.push = function (...args) {
      const r = original(...args);
      if (pixelLoaded || gaLoaded) args.forEach(forward);
      drained = dl.length;
      return r;
    };
    dl.__mbPatched = true;
  }
}

/* ---------------- the banner ---------------- */

function styles() {
  const css = `
    .mbc {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 60;
      display: flex; flex-wrap: wrap; align-items: center; gap: .9rem 1.25rem;
      padding: 1rem 1.25rem calc(1rem + env(safe-area-inset-bottom, 0px));
      background: #1a1310; border-top: 1px solid #3b241d;
      color: #d6c4b2; font-family: "Manrope", system-ui, -apple-system, sans-serif;
      font-size: .88rem; line-height: 1.55;
      box-shadow: 0 -8px 28px rgba(0,0,0,.45);
    }
    .mbc__text { flex: 1 1 22rem; min-width: 0; margin: 0; }
    .mbc__text a { color: #d2a24c; }
    .mbc__acts { display: flex; gap: .6rem; flex: 0 0 auto; }
    .mbc__btn {
      appearance: none; cursor: pointer; font: inherit; font-weight: 700;
      letter-spacing: .08em; text-transform: uppercase; font-size: .75rem;
      min-height: 44px; padding: .6rem 1.15rem; border-radius: 3px;
      border: 1px solid #a87c33; background: transparent; color: #e8c888;
    }
    .mbc__btn--accept { background: #d2a24c; border-color: #d2a24c; color: #100b09; }
    .mbc__btn:focus-visible { outline: 2px solid #f6efe7; outline-offset: 2px; }
    /* The sticky booking bar on service pages sits at the same edge. Lift it
       while the banner is up so neither covers the other. */
    body.mbc-open .stickybook { bottom: 6.5rem; }
    @media (max-width: 560px) {
      .mbc { font-size: .82rem; }
      .mbc__acts { width: 100%; }
      .mbc__btn { flex: 1 1 0; }
      body.mbc-open .stickybook { bottom: 8.5rem; }
    }
  `;
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
}

/* Reserve exactly the banner's height at the foot of the page.
   Measured rather than hardcoded: the banner wraps to two and three rows at
   narrower widths, so any fixed value would be wrong somewhere. Without this
   the banner overlays the bottom of the page and swallows clicks on whatever
   is under it — which is how it ate the booking form's submit button. */
function reserveSpace(bar) {
  const apply = () => {
    if (!bar.isConnected) return;
    document.body.style.paddingBottom = bar.offsetHeight + "px";
  };
  apply();
  // Re-measure on rotate/resize, where the row count changes.
  const ro =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
  if (ro) ro.observe(bar);
  window.addEventListener("resize", apply);
  return () => {
    if (ro) ro.disconnect();
    window.removeEventListener("resize", apply);
    document.body.style.paddingBottom = "";
  };
}

function banner() {
  styles();
  document.body.classList.add("mbc-open");

  const bar = document.createElement("div");
  bar.className = "mbc";
  bar.setAttribute("role", "dialog");
  bar.setAttribute("aria-label", "Cookies");
  // The banner names exactly what Accept turns on — Google only once GA4_ID is set.
  const ask = GA4_ID
    ? "We would like to use Meta (Facebook) and Google Analytics cookies to see which " +
      "of our adverts bring people to us and how the site is used. "
    : "We would like to use Meta (Facebook) cookies to see which of our " +
      "adverts bring people to us. ";
  bar.innerHTML =
    '<p class="mbc__text">' + ask +
    'Nothing is shared about your hair, your appointment ' +
    'or your messages. You can say no and the site works exactly the same. ' +
    '<a href="/privacy.html#cookies">Read our privacy policy</a>.</p>' +
    '<div class="mbc__acts">' +
    '<button type="button" class="mbc__btn mbc__btn--decline">No thanks</button>' +
    '<button type="button" class="mbc__btn mbc__btn--accept">Accept</button>' +
    "</div>";

  document.body.appendChild(bar);
  const release = reserveSpace(bar);

  const close = () => {
    release();
    bar.remove();
    document.body.classList.remove("mbc-open");
  };

  bar.querySelector(".mbc__btn--accept").addEventListener("click", () => {
    remember("granted");
    close();
    loadTrackers();
  });
  bar.querySelector(".mbc__btn--decline").addEventListener("click", () => {
    remember("denied");
    close();
  });

}

/* ---------------- boot ---------------- */

(function start() {
  // Never on the staff dashboard.
  if (location.pathname.startsWith("/admin")) return;

  const s = stored();
  if (s && s.choice === "granted") {
    loadTrackers();
    return;
  }
  if (s && s.choice === "denied") return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", banner, { once: true });
  } else {
    banner();
  }
})();

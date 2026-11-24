/* ---------------------------------------------------------
   Where the booking came from
   ---------------------------------------------------------
   Answers "which ad produced this appointment?" without a cookie, a pixel,
   or a third party. Everything here is read from the URL the visitor arrived
   on and the referrer the browser volunteers, held for the length of the tab,
   and submitted with the booking.

   WHY THIS AS WELL AS THE PIXEL AND GA4. Those two load only for visitors
   who accept cookies (consent.js), so on their own they miss everyone who
   declines. This runs for every visitor, needs no cookie and no third party,
   and ties the booking itself - not a guess about it - to the campaign that
   produced it. It is the one source of attribution that covers every
   booking.

   FIRST TOUCH WINS. The attribution is written once per tab and never
   overwritten. A visitor who arrives from a Facebook ad, wanders the site,
   and books twenty minutes later is still a Facebook booking - if the last
   navigation won instead, most bookings would credit themselves to "direct".

   sessionStorage, not localStorage: it is gone when the tab closes, which is
   the least the job can get away with. It is not a cookie and is not readable
   by any other site.
   --------------------------------------------------------- */

const KEY = "mb_attrib";

const UTM_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

/* Column limits in booking_requests. Trimming here keeps a long URL from
   bouncing the whole insert on a CHECK constraint - losing the booking to
   save the analytics would be exactly the wrong trade. */
const LIMITS = {
  source: 40,
  utm_source: 120,
  utm_medium: 120,
  utm_campaign: 200,
  utm_content: 200,
  utm_term: 200,
  landing_page: 500,
  referrer: 500,
};

const clip = (v, n) => (v == null ? null : String(v).slice(0, n) || null);

/* ---------------------------------------------------------
   What may be stored about the URL they arrived on
   ---------------------------------------------------------
   The landing page used to be stored as pathname + the WHOLE query string.
   A link from an email tool, a CRM or another site can carry ?email=, a name,
   a phone number or a login token, and every one of those would have landed
   in booking_requests. Now only these survive:

     - the path
     - the five utm_* tags, each checked by looksPersonal()
     - ?service=, only when it is one of the salon's own slugs

   Everything else is dropped, including ad click IDs (fbclid, gclid). Their
   presence still decides `source` in deriveSource(), so a Meta or Google ad
   click is still credited correctly; only the identifier value is not kept.
   Fragments never reach here: location.search excludes them.

   THE SAME RULES ARE COPIED into the service-page bridge
   (scripts/build-service-pages.py, and the two updo pages) and into
   consent.js for Google Analytics, because those run without this bundle.
   Change one, change all three; the privacy regression tests cover all. */

/* Keep in step with SERVICE_SLUGS in booking.js. */
const SERVICE_IDS = new Set([
  "knotless-braids",
  "box-braids",
  "cornrows",
  "cornrows-stitch-braids",
  "fulani-braids",
  "feed-in-braids",
  "kids-braids",
  "braided-updo",
  "half-up-half-down",
  "goddess-braids",
]);

/**
 * True if a value looks like it carries an email address or a phone number.
 *
 * Email: anything containing "@" - no campaign tag legitimately needs one.
 * Phone: any run of digits (allowing spaces, dots, dashes and brackets
 * between them) that holds exactly 10 or 11 digits - a North American
 * number. Dates such as 2026-11-24 (8 digits) and Meta ad IDs (15+ digits)
 * pass through untouched.
 *
 * It cannot recognise a bare name. Names are kept out of URLs by the salon's
 * own tagging convention, not by this check - see the implementation report.
 */
export function looksPersonal(value) {
  const s = String(value);
  if (s.includes("@")) return true;
  const runs = s.match(/\d[\d\s().-]*\d/g) || [];
  return runs.some((r) => {
    const n = r.replace(/\D/g, "").length;
    return n === 10 || n === 11;
  });
}

/**
 * The referring site's address only: scheme, host and port, e.g.
 * "https://www.facebook.com". The site is what the report needs; the path,
 * query, fragment and any user:password@ in front of the host never are,
 * and URL.origin drops all of them. Anything that is not an http(s) URL is
 * stored as null.
 */
export function safeOrigin(ref) {
  try {
    const u = new URL(String(ref));
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return clip(u.origin, LIMITS.referrer);
  } catch {
    return null;
  }
}

/** A utm_* value fit to store, or null. */
function cleanUtm(value, limit) {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v || looksPersonal(v)) return null;
  return clip(v, limit);
}

/** The service slug if it is one of ours, else null. */
function cleanService(value) {
  const v = String(value || "").trim().toLowerCase();
  return SERVICE_IDS.has(v) ? v : null;
}

/** Path plus only the approved, checked parameters. */
export function safeLandingPage(loc = location) {
  let path = loc.pathname || "/";
  try {
    if (looksPersonal(decodeURIComponent(path))) path = "/";
  } catch {
    path = "/";
  }

  const params = new URLSearchParams(loc.search);
  const out = new URLSearchParams();
  for (const f of UTM_FIELDS) {
    const v = cleanUtm(params.get(f), LIMITS[f]);
    if (v) out.set(f, v);
  }
  const svc = cleanService(params.get("service"));
  if (svc) out.set("service", svc);

  const q = out.toString();
  return clip(path + (q ? "?" + q : ""), LIMITS.landing_page);
}

/** Host of a URL string, lowercased, or "" if it will not parse. */
function host(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * One of: facebook · instagram · google · gbp · referral · organic · direct.
 *
 * utm_source wins when present, because that is the salon's own tagging and
 * it is deliberate. Click IDs come next: fbclid means Meta sent them even
 * when the ad was built without UTMs, which is the common case for a boosted
 * post. The referrer is the last resort.
 *
 * "google" means PAID Google traffic. The Google Business Profile is free
 * and gets its own bucket, "gbp": tag the profile's website link with
 * ?utm_source=gbp&utm_medium=organic&utm_campaign=profile. Tested before the
 * google rule, because "google_business" would otherwise match /google/ and
 * be reported as ad spend that was never spent.
 */
function deriveSource(params, referrer) {
  // A personal-looking utm_source is discarded, so it is classified exactly
  // as if it had never been there.
  const utm = (cleanUtm(params.get("utm_source"), LIMITS.utm_source) || "").toLowerCase();

  if (utm) {
    if (/^(gbp|gmb|google_?business(_?profile)?)$/.test(utm)) return "gbp";
    if (/facebook|^fb$|meta/.test(utm)) return "facebook";
    if (/instagram|^ig$/.test(utm)) return "instagram";
    if (/google|adwords|gads/.test(utm)) return "google";
    if (/^(direct|none)$/.test(utm)) return "direct";
    return "referral";
  }

  // Untagged paid traffic still identifies itself through the click ID.
  if (params.has("fbclid")) return "facebook";
  if (params.has("gclid") || params.has("gbraid") || params.has("wbraid")) {
    return "google";
  }

  const h = host(referrer);
  if (!h) return "direct";
  if (/(^|\.)facebook\.com$|(^|\.)fb\.(com|me)$/.test(h)) return "facebook";
  if (/(^|\.)instagram\.com$/.test(h)) return "instagram";
  // A Google referrer with no click ID is someone who found us, not someone
  // we paid for. That distinction is the whole point of the report.
  if (/(^|\.)google\./.test(h)) return "organic";
  if (/(^|\.)bing\.com$|(^|\.)duckduckgo\.com$|(^|\.)search\.yahoo\./.test(h)) {
    return "organic";
  }
  if (h === location.hostname) return "direct";
  return "referral";
}

function read() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Private mode, or storage disabled. Attribution is a nice-to-have; the
    // booking is not. Never let this throw into the submit path.
    return null;
  }
}

function write(data) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore - see read() */
  }
}

/**
 * Capture on first page of the visit. Safe to call on every load: it returns
 * the stored value untouched once something is recorded.
 */
export function captureAttribution() {
  const existing = read();
  if (existing) return existing;

  const params = new URLSearchParams(location.search);
  const referrer = document.referrer || "";

  const data = { source: clip(deriveSource(params, referrer), LIMITS.source) };

  for (const f of UTM_FIELDS) {
    data[f] = cleanUtm(params.get(f), LIMITS[f]);
  }

  data.landing_page = safeLandingPage();
  // Same-origin referrers say nothing about acquisition and would just be
  // noise in the report.
  data.referrer =
    referrer && host(referrer) !== location.hostname ? safeOrigin(referrer) : null;

  write(data);
  return data;
}

/** The fields to merge into a booking insert. Never throws. */
export function attributionPayload() {
  const d = read() || captureAttribution() || {};

  /* Re-checked on the way out, not only on the way in. The stored value may
     have been written by a service page's bridge - including a copy of that
     page cached from before these rules existed - so it is never trusted
     as-is. Same rules, applied a second time; cheap, and it cannot fail. */
  let landing = null;
  if (d.landing_page) {
    try {
      landing = safeLandingPage(new URL(d.landing_page, location.origin));
    } catch {
      landing = null;
    }
  }

  return {
    source: d.source ?? "direct",
    utm_source: cleanUtm(d.utm_source, LIMITS.utm_source),
    utm_medium: cleanUtm(d.utm_medium, LIMITS.utm_medium),
    utm_campaign: cleanUtm(d.utm_campaign, LIMITS.utm_campaign),
    utm_content: cleanUtm(d.utm_content, LIMITS.utm_content),
    utm_term: cleanUtm(d.utm_term, LIMITS.utm_term),
    landing_page: landing,
    referrer: d.referrer ? safeOrigin(d.referrer) : null,
  };
}

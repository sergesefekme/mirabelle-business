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
  const utm = (params.get("utm_source") || "").toLowerCase();

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
    data[f] = clip(params.get(f), LIMITS[f]);
  }

  data.landing_page = clip(location.pathname + location.search, LIMITS.landing_page);
  // Same-origin referrers say nothing about acquisition and would just be
  // noise in the report.
  data.referrer =
    referrer && host(referrer) !== location.hostname
      ? clip(referrer, LIMITS.referrer)
      : null;

  write(data);
  return data;
}

/** The fields to merge into a booking insert. Never throws. */
export function attributionPayload() {
  const d = read() || captureAttribution() || {};
  return {
    source: d.source ?? "direct",
    utm_source: d.utm_source ?? null,
    utm_medium: d.utm_medium ?? null,
    utm_campaign: d.utm_campaign ?? null,
    utm_content: d.utm_content ?? null,
    utm_term: d.utm_term ?? null,
    landing_page: d.landing_page ?? null,
    referrer: d.referrer ?? null,
  };
}

/* ---------------------------------------------------------
   Booking request form
   ---------------------------------------------------------
   The site is a static build, so there is no server of our own
   to post to. Requests go straight to Supabase's REST endpoint
   with the publishable (anon) key. That key is public by
   design — it is safe in the bundle only because the table's
   RLS policy grants anon INSERT and nothing else, so a reader
   of the bundle can file a request and cannot read anyone
   else's. If that policy is ever loosened, this becomes a
   data leak: see supabase/booking_requests.sql.

   Validation is done here rather than left to the browser
   because native bubbles cannot be styled and read as broken
   next to the rest of the page.
   --------------------------------------------------------- */

import { attributionPayload, captureAttribution } from "./attribution.js";

const URL_BASE = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TABLE = "booking_requests";
const SALON_TEL = "+15714260602";
const SALON_TEL_HUMAN = "571-426-0602";

const PHONE_DIGITS = /\d/g;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Today as yyyy-mm-dd in the visitor's own timezone (not UTC — a booking
 *  made at 9pm Baltimore time must not offer "yesterday" as valid). */
function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-09-10" -> "Saturday, September 10". Built from the field's own
 *  yyyy-mm-dd string and rendered at UTC noon, so the weekday cannot slip a
 *  day either side of midnight. Falls back to the raw value rather than
 *  showing a visitor "Invalid Date". */
function prettyDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  if (Number.isNaN(d.getTime())) return String(iso || "");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** First name only, for the greeting. "Sarah Johnson" -> "Sarah". */
function firstName(full) {
  const s = String(full || "").trim();
  return s ? s.split(/\s+/)[0] : "";
}

function setError(field, message) {
  const wrap = field.closest(".field");
  const slot = wrap?.querySelector(".field__err");
  wrap?.classList.toggle("is-bad", Boolean(message));
  field.setAttribute("aria-invalid", message ? "true" : "false");
  if (slot) slot.textContent = message || "";
}

function validate(form) {
  const f = (name) => form.elements[name];
  const problems = [];

  const check = (el, message) => {
    setError(el, message);
    if (message) problems.push(el);
  };

  const name = f("name");
  check(name, name.value.trim().length < 2 ? "Please tell us your name." : "");

  const phone = f("phone");
  const digits = (phone.value.match(PHONE_DIGITS) || []).length;
  check(
    phone,
    digits < 10 ? "We need a full mobile number to confirm your slot." : ""
  );

  const email = f("email");
  check(
    email,
    email.value.trim() && !EMAIL.test(email.value.trim())
      ? "That email does not look right."
      : ""
  );

  const style = f("style");
  check(style, style.value ? "" : "Pick a style, or choose “Not sure yet”.");

  const date = f("preferred_date");
  check(
    date,
    !date.value
      ? "Choose a date you would like."
      : date.value < todayLocal()
        ? "That date has passed. Pick a later one."
        : ""
  );

  return problems;
}

/** Composes the request as a text message to the salon. This is the path when
 *  no backend is configured — it keeps the form genuinely useful rather than
 *  collecting details and dropping them. On a phone the messaging app opens
 *  pre-filled; on a desktop nothing may happen, which is why the status line
 *  also prints the number and the message. */
function textFallback(p) {
  const lines = [
    "Booking request",
    `Name: ${p.name}`,
    `Phone: ${p.phone}`,
    p.email ? `Email: ${p.email}` : null,
    `Style: ${p.style}`,
    `Preferred: ${p.preferred_date} (${p.preferred_time || "any time"})`,
    p.notes ? `Notes: ${p.notes}` : null,
  ].filter(Boolean);

  const body = lines.join("\n");
  window.location.href = `sms:${SALON_TEL}?body=${encodeURIComponent(body)}`;
  return body;
}

async function send(payload) {
  if (!URL_BASE || !ANON_KEY) {
    return { mode: "text", body: textFallback(payload) };
  }

  const res = await fetch(`${URL_BASE}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Supabase responded ${res.status}: ${await res.text()}`);
  }

  return { mode: "stored" };
}

/* Landing pages link to /?service=<slug>#book. Mapped explicitly rather than
   slugifying the option text: the cornrows page is /cornrows but its option
   reads "Cornrows / Stitch Braids", so a naive slugify would miss it and the
   visitor would land on an unset dropdown having already told us what they
   wanted. */
const SERVICE_SLUGS = {
  "knotless-braids": "Knotless Braids",
  "box-braids": "Box Braids",
  "cornrows": "Cornrows / Stitch Braids",
  "cornrows-stitch-braids": "Cornrows / Stitch Braids",
  "fulani-braids": "Fulani Braids",
  "feed-in-braids": "Feed-In Braids",
  "kids-braids": "Kids’ Braids",
  "braided-updo": "Braided Updo",
  "half-up-half-down": "Half Up Half Down",
  "goddess-braids": "Goddess Braids",
};

/** Preselects the style when the visitor arrived from a service page. */
function preselectService(form) {
  const slug = new URLSearchParams(location.search).get("service");
  if (!slug) return;

  const wanted = SERVICE_SLUGS[slug.toLowerCase()];
  if (!wanted) return;

  const select = form.elements["style"];
  if (!select) return;

  const match = [...select.options].find((o) => o.text === wanted);
  if (match) select.value = match.value || match.text;
}

/* Event layer. These push onto the standard dataLayer and nothing else.
   consent.js forwards them to the Meta Pixel and GA4, and only for visitors
   who accepted cookies; for everyone else they go nowhere. Nothing personal
   is ever pushed — no name, phone, email or note. */
function track(event, extra) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event }, extra || {}));
  } catch {
    /* never let analytics break a booking */
  }
}

export function setupBooking() {
  // Runs even when the form is absent, so a service landing page still records
  // where the visitor came from before they navigate to book.
  captureAttribution();

  const form = document.querySelector("#booking-form");
  if (!form) return;

  const status = form.querySelector(".booking__status");
  const button = form.querySelector('button[type="submit"]');
  const date = form.elements["preferred_date"];

  // Guards against a double tap on a slow connection filing two identical
  // requests. Set for the whole in-flight window and never cleared on
  // success, so the form cannot be submitted twice from one page view.
  let sending = false;

  // Stops the picker offering dates that validate() would only reject.
  if (date) date.min = todayLocal();

  preselectService(form);

  // Fired once, on the first real interaction — not on page view. Someone
  // scrolling past the form has not started a booking.
  let started = false;
  form.addEventListener(
    "input",
    () => {
      if (started) return;
      started = true;
      track("booking_started", { service: form.elements["style"]?.value || null });
    },
    { once: false }
  );

  /* Book Now on a service card jumps to the form. Without this it arrived
     with an empty dropdown, so a visitor who had just chosen a style had to
     choose it again — the commonest way a booking form loses people. */
  document.querySelectorAll(".work-card__cta[data-service]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wanted = SERVICE_SLUGS[btn.dataset.service];
      if (!wanted) return;
      const select = form.elements["style"];
      const match = [...select.options].find((o) => o.text === wanted);
      if (match) select.value = match.value || match.text;
    });
  });

  // Clear a field's error as soon as the visitor starts fixing it.
  form.addEventListener("input", (e) => {
    if (e.target.closest(".field.is-bad")) setError(e.target, "");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;

    const problems = validate(form);
    if (problems.length) {
      status.dataset.state = "err";
      status.textContent =
        problems.length === 1
          ? "Just one thing to check above."
          : `A few details need your attention above — ${problems.length} of them.`;
      problems[0].focus();
      return;
    }

    /* Honeypot. A real visitor never sees this field, so anything in it is a
       bot; we answer as if it succeeded rather than telling them they were
       caught.

       The field is named "fax" precisely so no browser autofills it. It was
       "company" until 2026-08-27, which browsers DO autofill — and because a
       filled honeypot is silently discarded, that could have thrown away a
       real booking behind a success message. Trimmed, so an autofilled space
       cannot trigger it either. */
    if (form.elements["fax"]?.value.trim()) {
      form.classList.add("is-sent");
      status.dataset.state = "ok";
      status.textContent = "Thank you — your request is in.";
      return;
    }

    sending = true;
    button.setAttribute("aria-busy", "true");
    button.disabled = true;
    button.textContent = button.dataset.busy;
    status.dataset.state = "";
    status.textContent = "";

    const get = (n) => form.elements[n]?.value.trim() || null;

    try {
      const result = await send({
        name: get("name"),
        phone: get("phone"),
        email: get("email"),
        style: get("style"),
        preferred_date: get("preferred_date"),
        preferred_time: get("preferred_time"),
        notes: get("notes"),
        // Which ad, post or search produced this booking. Read on landing,
        // held for the tab. See attribution.js.
        ...attributionPayload(),
      });

      form.classList.add("is-sent");
      status.dataset.state = "ok";

      /* THE CONVERSION. Deliberately here and nowhere else: inside the success
         branch, after send() resolved, and gated on mode === "stored" so the
         SMS fallback — which we cannot confirm was ever sent — is not counted
         as a booking. A conversion that fires on a click, or on an unconfirmed
         fallback, quietly inflates every campaign report it touches. */
      if (result.mode === "stored") {
        const a = attributionPayload();
        track("booking_submitted", {
          service: get("style"),
          preferred_date: get("preferred_date"),
          source: a.source,
          campaign: a.utm_campaign,
        });
      }

      const who = firstName(get("name"));
      const what = get("style");
      const when = prettyDate(get("preferred_date"));

      if (result.mode === "stored") {
        const hello = who ? `Thank you, ${who}! ` : "Thank you! ";
        const asked =
          what && when
            ? `We received your request for ${what} on ${when}. `
            : "We received your request. ";
        status.textContent =
          hello +
          asked +
          "Mirabelle.B will contact you shortly to confirm your appointment." +
          (get("email") ? " A confirmation email is on its way." : "");
      } else {
        status.textContent = `Your message app should be opening with the details ready to send to ${SALON_TEL_HUMAN}. If nothing opened, call or text that number.`;
      }

      // Stays disabled: the request is filed and re-sending it would only
      // create a duplicate for the salon to untangle.
      button.textContent = "Request sent";
    } catch (err) {
      console.error("[booking]", err);
      status.dataset.state = "err";
      status.textContent =
        "Sorry — that did not send. Please call or text 571-426-0602 and we will book you in.";
      sending = false;
      button.removeAttribute("aria-busy");
      button.disabled = false;
      button.textContent = button.dataset.idle;
    }
  });
}

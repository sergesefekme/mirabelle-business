"""Build the SEO service landing pages under website/public/<slug>/index.html.

CLEAN URLS WITHOUT SERVER CONFIG. Pages are written as <slug>/index.html so
static hosting serves them at /<slug>/ with no extension and no Amplify
rewrite rule — which matters because the rewrite console is not reachable
from here.

WHAT IS AND IS NOT INVENTED
Prices, durations, preparation, deposit facts, the 48-hour notice, tension
and parting standards, hours and address all come from the live site or the
services table. Descriptions of what a hairstyle *is* are general hairdressing
fact and are safe to write.

NOT WRITTEN, because the salon has not published them (reported to the owner
instead of guessed):
  - deposit AMOUNT           (that a deposit exists is published; how much is not)
  - hair included yes/no     (never stated anywhere)
  - size options S/M/L       (only "many sizes and lengths", on box braids)
  - length options
  - how many weeks each style lasts
  - prices/durations for Fulani, Kids' and Goddess braids

Where a fact is missing the section is OMITTED rather than shown with a
placeholder. Visible "[TO BE CONFIRMED]" on a live commercial page is the
thing we spent this project removing.

GALLERIES are assembled from images whose existing alt text identifies the
service. There is only one purpose-shot per service, so counts vary from 1 to
5; the spec asked for 3-6 and several services cannot reach it without
passing off a photo of one style as another.

Run:  python scripts/build-service-pages.py
"""

import io
import json
import os

OUT = os.path.join("website", "public")
SITE = "https://mimi-african-braiding-styling.com"

# Images whose published alt text identifies the service they show.
G = {
    "knotless": [
        ("/img/work/knotless-braids.webp", "Knotless braids by Mirabelle.B in Ashburn, Virginia"),
        ("/img/styles/curly/05.webp", "Knotless braids finished with curled ends"),
        ("/img/styles/protective/01.webp", "Knotless braids gathered into a high bun"),
        ("/img/styles/wavy/01.webp", "Knotless braids with soft wavy ends"),
    ],
    "box": [
        ("/img/work/box-braids.webp", "Box braids by Mirabelle.B in Ashburn, Virginia"),
    ],
    "cornrows": [
        ("/img/work/cornrows-stitch-braids.webp", "Cornrows by Mirabelle.B in Ashburn, Virginia"),
        ("/img/styles/protective/03.webp", "Straight-back cornrows running into long braids"),
        ("/img/styles/curly/03.webp", "Straight-back cornrows with deep-wave ends"),
        ("/img/styles/wavy/07.webp", "Cornrows into long wavy lengths"),
        ("/img/styles/coily/04.webp", "Cornrowed front gathered into a coily puff"),
    ],
    "stitch": [
        ("/img/work/cornrows-stitch-braids.webp", "Stitch braids by Mirabelle.B in Ashburn, Virginia"),
        ("/img/styles/curly/03.webp", "Straight-back stitch braids with deep-wave ends"),
    ],
    "fulani": [
        ("/img/work/fulani-braids.webp", "Fulani braids by Mirabelle.B in Ashburn, Virginia"),
        ("/img/styles/curly/06.webp", "Fulani-style braids with beads and curled lengths"),
    ],
    "feedin": [
        ("/img/work/feed-in-braids.webp", "Feed-in braids by Mirabelle.B in Ashburn, Virginia"),
        ("/img/styles/curly/02.webp", "Cornrows feeding into loose curled lengths"),
    ],
    "kids": [
        ("/img/work/kids-braids.webp", "Children's braids by Mirabelle.B in Ashburn, Virginia"),
    ],
    "goddess": [
        ("/img/work/goddess-braids.webp", "Goddess braids by Mirabelle.B in Ashburn, Virginia"),
        ("/img/styles/wavy/02b.webp", "Braids finished in loose waves"),
    ],
}

SERVICES = [
    dict(
        slug="knotless-braids-ashburn-va", gallery="knotless",
        name="Knotless Braids", h1="Knotless Braids in Ashburn, VA",
        form_value="Knotless Braids",
        lede="Professional, lightweight and beautiful knotless braids by Mirabelle.B African Hair Braiding.",
        price="250", duration="5–8 hours",
        what="Knotless braids start with your own hair and add extensions gradually as the braid grows, so there is no knot at the root. That single difference is why they sit flatter, move more naturally and feel lighter than a traditional knotted install from the first day.",
        good_for="Anyone who wants a protective style without the pulling that a knotted base can cause at the hairline — and anyone whose scalp has been sore after braids before.",
        benefits=[
            "No knot at the root, so there is less tension where hair is weakest.",
            "Lighter to wear — the difference is usually noticed within the first hour.",
            "Your own hair is tucked away and protected while it grows.",
            "Parted on a measured grid, which is what keeps the install looking clean as it grows out.",
        ],
    ),
    dict(
        slug="box-braids-ashburn-va", gallery="box",
        name="Box Braids", h1="Box Braids in Ashburn, VA",
        form_value="Box Braids",
        lede="Classic, versatile box braids by Mirabelle.B African Hair Braiding.",
        price="250", duration="5–8 hours",
        what="Box braids are individual three-strand braids parted into clean square sections — the 'box' is the parting. They are one of the oldest and most versatile protective styles, and the size and length are chosen to suit your hair rather than a trend.",
        good_for="Anyone wanting a long-wearing protective style with room to change how it is worn day to day.",
        benefits=[
            "A protective style that holds its shape through weeks of ordinary life.",
            "Can be worn down, tied up, or gathered — one install, many looks.",
            "Square, consistent parting: the structure everything else sits on.",
            "Finished with your scalp oiled and your hairline left alone.",
        ],
    ),
    dict(
        slug="cornrows-ashburn-va", gallery="cornrows",
        name="Cornrows", h1="Cornrows in Ashburn, VA",
        form_value="Cornrows / Stitch Braids",
        lede="Neat, long-lasting cornrows by Mirabelle.B African Hair Braiding.",
        price="120", duration="2–4 hours",
        what="Cornrows are braided flat to the scalp in continuous rows, following whatever pattern you choose — straight back, to one side, or something more designed. Because the braid lies against the head, it stays neat under wraps, helmets and wigs.",
        good_for="A first appointment if you have not sat with us before, anyone who wants a shorter appointment, and anyone who needs a style that stays flat under something else.",
        benefits=[
            "The shortest full-head appointment we offer — in and out in an afternoon.",
            "Clean, even rows that stay sharp as they grow out.",
            "Straight-back, side-parted, or a pattern of your choosing.",
            "Flat to the scalp, so they sit comfortably under a wig, wrap or helmet.",
        ],
        # The one internal link into the stitch braids page. It was an orphan:
        # live, in the sitemap, and reachable from nowhere. Cornrows is the
        # honest place to link from, because stitch braids ARE cornrows with a
        # different parting, so the sentence is useful rather than SEO filler.
        related=(
            'Looking for a sharper, more defined version of this style? '
            'See <a href="/stitch-braids-ashburn-va/">Stitch Braids in Ashburn, VA</a>.'
        ),
    ),
    dict(
        slug="stitch-braids-ashburn-va", gallery="stitch",
        name="Stitch Braids", h1="Stitch Braids in Ashburn, VA",
        form_value="Cornrows / Stitch Braids",
        lede="Crisp, defined stitch braids by Mirabelle.B African Hair Braiding.",
        price="120", duration="2–4 hours",
        what="Stitch braids are cornrows braided with a deliberate stitched appearance — each section is divided so the rows read as a series of clean, even segments rather than one smooth line. The technique takes more parting work, and the parting is what the style is judged on.",
        good_for="Anyone who likes the neatness of cornrows with a sharper, more graphic finish.",
        benefits=[
            "A crisper, more defined look than a standard cornrow.",
            "Flat to the scalp and comfortable to sleep in.",
            "The parting grid is measured, which is what makes the stitching read evenly.",
            "Priced and timed the same as our cornrows.",
        ],
    ),
    dict(
        slug="fulani-braids-ashburn-va", gallery="fulani",
        name="Fulani Braids", h1="Fulani Braids in Ashburn, VA",
        form_value="Fulani Braids",
        lede="Fulani braids with beads and detail, by Mirabelle.B African Hair Braiding.",
        price=None, duration=None,
        what="Fulani braids draw on a West African braiding tradition, typically combining cornrowed sections with hanging braids and finished with beads or cuffs. The pattern is part of the style, so it is set to your face and your hairline rather than copied exactly from a photograph.",
        good_for="Anyone who wants a protective style with visible detail and decoration.",
        benefits=[
            "Braided in the Fulani tradition, finished with beads or accessories.",
            "The pattern is set to your face and hairline, not copied from a picture.",
            "Tension is set so the decorative work does not cost you your edges.",
            "Bring a reference and we will tell you honestly what your hair will hold.",
        ],
    ),
    dict(
        slug="feed-in-braids-ashburn-va", gallery="feedin",
        name="Feed-In Braids", h1="Feed-In Braids in Ashburn, VA",
        form_value="Feed-In Braids",
        lede="Smooth, natural-looking feed-in braids by Mirabelle.B African Hair Braiding.",
        price="120", duration="2–4 hours",
        what="Feed-in braids add hair gradually along the row rather than all at once at the root. The braid starts with your own hair and thickens as it goes, which is what gives the flat, tapered look at the hairline and avoids a heavy knot at the start.",
        good_for="Anyone who wants cornrow-style braids with a lighter start and a more natural-looking hairline.",
        benefits=[
            "Hair fed in gradually, so the braid thickens without a knot at the root.",
            "Flat to the scalp and smooth from the first row to the last.",
            "Less weight at the hairline, which is where tension does its damage.",
            "A shorter appointment than a full-head individual install.",
        ],
    ),
    dict(
        slug="kids-braids-ashburn-va", gallery="kids",
        name="Kids' Braids", h1="Kids' Braids in Ashburn, VA",
        form_value="Kids’ Braids",
        lede="Gentle, patient braiding for children, by Mirabelle.B African Hair Braiding.",
        price=None, duration=None,
        what="Braiding for children, done at a child's pace. Styles are chosen for comfort and for how they will hold up at school and at play, and nothing is installed tighter than a young scalp should carry.",
        good_for="Children of any age whose parent wants a protective style done carefully rather than quickly.",
        benefits=[
            "Every section is shown to the child before it is touched.",
            "We check in throughout, and we stop when they need us to.",
            "Softer tension — nothing installed tighter than a young scalp should carry.",
            "A parent or guardian stays on the premises for the whole appointment.",
        ],
    ),
    dict(
        slug="goddess-braids-ashburn-va", gallery="goddess",
        name="Goddess Braids", h1="Goddess Braids in Ashburn, VA",
        form_value="Goddess Braids",
        lede="Braids finished with soft curls and waves, by Mirabelle.B African Hair Braiding.",
        price=None, duration=None,
        what="Goddess braids combine a braided root with loose curled or wavy lengths left out through the body of the style. The braid does the protective work; the loose hair does the rest.",
        good_for="Anyone who wants the structure of braids with a softer, less uniform finish.",
        benefits=[
            "Braided structure at the root, soft curled or wavy lengths through the body.",
            "Sized and parted to your own density rather than to a photograph.",
            "A softer look than a fully braided install, with the same protective root.",
            "Tell us the finish you want and we will tell you what your hair will hold.",
        ],
    ),
]

WHY = [
    ("Experienced braider", "Mirabelle brings more than 7 years of experience in African hair braiding, and braids every head herself."),
    ("Tension-conscious", "Tension is set so your edges survive the style. If it hurts, we take it down and reset it — that is the job, not a favor."),
    ("Protective by design", "Braids, cornrows and twists are load-bearing, not decorative. Your own hair is tucked away while it grows."),
    ("Scalp and hair care", "Every service starts and ends with the health of what is underneath, and you leave with a printed care card."),
    ("Clean tools", "Tools are cleaned between clients and the station is reset for every appointment."),
    ("Personal attention", "One chair, one standard. You are not handed between people mid-appointment."),
    ("Clear pricing", "The price is agreed with you before the appointment begins — never after."),
    ("Honest timing", "We tell you the real finish time when you book, and we start when we said we would."),
    ("Ashburn, Virginia", "44048 Lords Valley Ter, serving Ashburn, Sterling, Leesburg, Herndon and the wider Northern Virginia area."),
]


def faqs(s):
    """Answers drawn only from what the salon has published."""
    out = []
    if s["price"]:
        out.append((f"How much do {s['name'].lower()} cost in Ashburn?",
                    f"{s['name']} start at ${s['price']}. The final price depends on the length and density of your hair and the size of the braids, and it is agreed with you before the appointment begins — never after."))
    else:
        out.append((f"How much do {s['name'].lower()} cost?",
                    "We do not publish a starting price for this style, because it varies too much with what you are asking for. Call 571-426-0602 and we will quote you honestly, and the price is agreed before you sit down."))

    if s["duration"]:
        out.append(("How long does the appointment take?",
                    f"Around {s['duration']}. We tell you which end of that to expect when you book, so you can plan the day."))
    else:
        out.append(("How long does the appointment take?",
                    "It depends on the length and density of your hair and the size of the braids. We give you an honest number when you book, and we start when we said we would."))

    out += [
        ("Should I wash my hair before I come?",
         "Yes. Come with your hair washed, fully dried and detangled unless we have agreed otherwise. Undone hair eats into your appointment and into the quality of the result."),
        ("Is a deposit required?",
         "Yes. A deposit secures your appointment slot. It is taken once your time is agreed, not when you submit the booking form, and nothing is charged through this website. Deposits can be paid by card, Zelle or Cash App."),
        ("Do I need to bring my own hair?",
         "If you would like to use your own, say so in the booking notes and we will tell you how much to bring for the style you want. Call 571-426-0602 if you would rather ask first."),
        ("How far ahead should I book?",
         "Please book at least 48 hours in advance. Walk-ins are welcome when a chair is free — call 571-426-0602 and we will tell you honestly whether the day can take it."),
        ("What if I need to cancel or reschedule?",
         "Please give at least 48 hours' notice. A braiding chair booked for six hours cannot be filled at short notice, which is the whole reason the policy exists."),
        ("How do I look after them?",
         "A printed care card goes home with every install, and we message you at the one-week mark to check your scalp has settled. If anything feels too tight, tell us and we will reset it."),
    ]
    return out


CAMPAIGN_SCRIPT = r"""    <script>
      /* CAMPAIGN BRIDGE.
         Ad traffic lands HERE, not on the home page, and this page loads no
         bundle by design. Without this the UTM parameters die at the first
         click: the booking link is /?service=...#book, the home page then sees
         no campaign, and every ad-driven booking records as "direct" — which
         silently destroys the ad reporting it was all built for.

         Two belts, because attribution that only works sometimes is worse than
         none. The values are written to the same sessionStorage key the
         booking form reads, AND appended to the booking links in case storage
         is unavailable (private mode, storage disabled). */
      (function () {
        var p = new URLSearchParams(location.search);
        var F = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
        var d = {};

        /* PRIVACY RULES - the same as src/attribution.js, which this page
           cannot import. Change one, change both (and consent.js); the
           privacy regression tests check all three against the same cases.
           Only utm_* values that do not look like an email or a phone number
           are kept, ?service= only when it is one of our slugs, and nothing
           else in the URL is stored or passed on. */
        var LIM = { utm_source: 120, utm_medium: 120, utm_campaign: 200,
                    utm_content: 200, utm_term: 200 };
        var SVC = ["knotless-braids", "box-braids", "cornrows",
                   "cornrows-stitch-braids", "fulani-braids", "feed-in-braids",
                   "kids-braids", "braided-updo", "half-up-half-down",
                   "goddess-braids"];
        function personal(v) {
          v = String(v);
          if (v.indexOf("@") !== -1) return true;
          var runs = v.match(/\d[\d\s().-]*\d/g) || [];
          for (var i = 0; i < runs.length; i++) {
            var n = runs[i].replace(/\D/g, "").length;
            if (n === 10 || n === 11) return true;
          }
          return false;
        }
        function clean(v, n) {
          if (v == null) return null;
          v = String(v).trim();
          return !v || personal(v) ? null : v.slice(0, n);
        }

        F.forEach(function (k) { d[k] = clean(p.get(k), LIM[k]); });

        var u = (d.utm_source || "").toLowerCase();
        var ref = document.referrer || "";
        var h = "";
        try { h = ref ? new URL(ref).hostname.toLowerCase() : ""; } catch (e) {}

        var src = "direct";
        if (u) {
          /* gbp is tested before google: the free Business Profile must not
             be reported as paid Google traffic. Matches src/attribution.js. */
          src = /^(gbp|gmb|google_?business(_?profile)?)$/.test(u) ? "gbp"
              : /facebook|^fb$|meta/.test(u) ? "facebook"
              : /instagram|^ig$/.test(u) ? "instagram"
              : /google|adwords|gads/.test(u) ? "google"
              : /^(direct|none)$/.test(u) ? "direct" : "referral";
        } else if (p.has("fbclid")) {
          src = "facebook";
        } else if (p.has("gclid") || p.has("gbraid") || p.has("wbraid")) {
          src = "google";
        } else if (h) {
          src = /(^|\.)facebook\.com$|(^|\.)fb\.(com|me)$/.test(h) ? "facebook"
              : /(^|\.)instagram\.com$/.test(h) ? "instagram"
              : /(^|\.)google\./.test(h) ? "organic"
              : /(^|\.)bing\.com$|(^|\.)duckduckgo\.com$/.test(h) ? "organic"
              : h === location.hostname ? "direct" : "referral";
        }

        d.source = src;
        var path = location.pathname || "/";
        try { if (personal(decodeURIComponent(path))) path = "/"; } catch (e) { path = "/"; }
        var keep = new URLSearchParams();
        F.forEach(function (k) { if (d[k]) keep.set(k, d[k]); });
        var sv = (p.get("service") || "").trim().toLowerCase();
        if (SVC.indexOf(sv) !== -1) keep.set("service", sv);
        var ks = keep.toString();
        d.landing_page = (path + (ks ? "?" + ks : "")).slice(0, 500);
        /* The referring site's address only - never its path, query,
           fragment or credentials. Same rule as safeOrigin() in
           src/attribution.js. */
        d.referrer = null;
        if (h && h !== location.hostname) {
          try {
            var ru = new URL(ref);
            if (ru.protocol === "https:" || ru.protocol === "http:") d.referrer = ru.origin.slice(0, 500);
          } catch (e) {}
        }

        /* First touch wins, matching src/attribution.js. Someone who browses
           three service pages before booking is still credited to the ad that
           brought them to the first one. */
        try {
          if (!sessionStorage.getItem("mb_attrib")) {
            sessionStorage.setItem("mb_attrib", JSON.stringify(d));
          }
        } catch (e) {}

        var q = F.filter(function (k) { return d[k]; })
                 .map(function (k) { return k + "=" + encodeURIComponent(d[k]); })
                 .join("&");
        if (q) {
          Array.prototype.forEach.call(
            document.querySelectorAll('a[href*="?service="]'),
            function (a) {
              a.href = a.getAttribute("href").replace("#book", "") + "&" + q + "#book";
            }
          );
        }

        /* EVENT LAYER. Events go onto the standard dataLayer and nowhere
           else. /consent.js forwards them to the Meta Pixel and GA4, and only
           for visitors who accepted cookies; for everyone else they go
           nowhere. Nothing personal is ever pushed.

           The conversion event is NOT here. book_now_clicked is a click, not
           a booking; firing a conversion on it would report every curious tap
           as a customer and make the ad reporting worse than useless. The
           conversion fires in booking.js, only after the row is stored. */
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: "service_page_viewed",
          service: document.title.split(" in Ashburn")[0],
          source: d.source,
          campaign: d.utm_campaign || null,
        });

        Array.prototype.forEach.call(
          document.querySelectorAll("[data-mb-event]"),
          function (el) {
            el.addEventListener("click", function () {
              window.dataLayer.push({
                event: el.getAttribute("data-mb-event"),
                service: el.getAttribute("data-mb-service") || null,
                source: d.source,
                campaign: d.utm_campaign || null,
              });
            });
          }
        );

        /* Calls and emails. Delegated, so every tel: and mailto: link on the
           page is covered — header, hero and any added later — without
           tagging each one. Capture phase so nothing can pre-empt it. */
        var svc = document.title.split(" in Ashburn")[0];
        document.addEventListener("click", function (e) {
          var a = e.target.closest && e.target.closest("a[href]");
          if (!a) return;
          var href = a.getAttribute("href") || "";
          var ev = href.indexOf("tel:") === 0 ? "phone_clicked"
                 : href.indexOf("mailto:") === 0 ? "email_clicked" : null;
          if (!ev) return;
          window.dataLayer.push({
            event: ev,
            service: svc,
            placement: a.closest("header") ? "header"
                     : a.closest(".stickybook") ? "stickybook"
                     : a.closest("footer") ? "footer" : "page",
            source: d.source,
            campaign: d.utm_campaign || null,
          });
        }, true);
      })();
    </script>"""

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{h1} | Mirabelle.B African Hair Braiding</title>
    <meta name="description" content="{meta}" />
    <meta name="theme-color" content="#100B09" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="icon" href="/img/brand/favicon-192.png" type="image/png" sizes="192x192" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="canonical" href="{site}/{slug}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Mirabelle.B" />
    <meta property="og:title" content="{h1} | Mirabelle.B" />
    <meta property="og:description" content="{meta}" />
    <meta property="og:url" content="{site}/{slug}/" />
    <meta property="og:image" content="{site}{hero_img}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/landing.css" />
    <script src="/consent.js" defer></script>
    <script type="application/ld+json">
{schema}
    </script>
  </head>

  <body>
    <a class="skip" href="#main">Skip to content</a>

    <header class="mast">
      <a class="mast__word" href="/">
        <img class="mast__mark" src="/img/brand/mark-96.webp"
             srcset="/img/brand/mark-96.webp 1x, /img/brand/mark-192.webp 2x"
             width="60" height="60" alt="" decoding="async" />
        <span>Mirabelle<span class="mast__dot">.</span>B</span>
      </a>
      <a class="mast__call" href="tel:+15714260602">571-426-0602</a>
    </header>

    <main id="main">
      <section class="hero">
        <img class="hero__img" src="{hero_img}" alt="{hero_alt}"
             width="900" height="900" fetchpriority="high" />
        <div class="hero__body">
          <p class="eyebrow">African Hair Braiding · Ashburn, Virginia</p>
          <h1>{h1}</h1>
          <p class="lede">{lede}</p>
          <p class="facts">{facts}</p>
          <a class="cta" href="/?service={form_slug}#book" data-mb-event="book_now_clicked" data-mb-service="{name}">Book this style</a>
          <p class="cta__sub">Or call <a href="tel:+15714260602">571-426-0602</a> · Open Monday to Saturday</p>
        </div>
      </section>

      <section class="block">
        <h2>About {name_lower}</h2>
        <p>{what}</p>
        <p><strong>Who it suits.</strong> {good_for}</p>
        <ul class="ticks">{benefits}</ul>{related}
        <p class="note">
          How long a style lasts depends on your hair and how it is cared for
          afterwards. We give you a realistic estimate for your hair at the
          appointment, and a printed care card to take home.
        </p>
      </section>

      <section class="block">
        <h2>Pricing and timing</h2>
        <div class="spec">{spec}</div>
        <p class="note">
          The price is agreed with you before the appointment begins. If your
          hair length, density or the size of the braids changes what the work
          takes, we tell you before we start — never after.
        </p>
      </section>
{gallery}
      <section class="block">
        <h2>Why choose Mirabelle.B</h2>
        <dl class="why">{why}</dl>
      </section>

      <section class="block">
        <h2>Before your appointment</h2>
        <ul class="ticks">
          <li>Come with your hair washed, fully dried and detangled, unless we have agreed otherwise.</li>
          <li>Undone hair eats into your appointment and into the quality of the result.</li>
          <li>Bringing your own hair? Say so in the booking notes and we will tell you how much to bring.</li>
          <li>Book at least 48 hours ahead where you can. Walk-ins are welcome when a chair is free.</li>
          <li>Tell us about any scalp condition, allergy or recent chemical treatment before we start.</li>
        </ul>
        <p class="note">
          Full detail is on our <a href="/policies.html">Booking &amp; Salon Policies</a> page.
        </p>
      </section>

      <section class="block">
        <h2>Questions</h2>
        <div class="faq">{faq}</div>
      </section>

      <section class="block block--cta">
        <h2>Ready for your new look?</h2>
        <p>
          Book your {name_lower} appointment with Mirabelle.B in Ashburn,
          Virginia. Send a request and we confirm your slot by text, usually the
          same day — nothing is charged on this website.
        </p>
        <a class="cta" href="/?service={form_slug}#book" data-mb-event="book_now_clicked" data-mb-service="{name}">Book your appointment</a>
        <p class="cta__sub">
          44048 Lords Valley Ter, Ashburn, VA 20147 ·
          <a href="https://www.google.com/maps/search/?api=1&amp;query=44048+Lords+Valley+Ter%2C+Ashburn%2C+VA+20147"
             target="_blank" rel="noopener">Get directions</a>
        </p>
      </section>
    </main>

    <!-- Thumb-reach booking, phones only. The hero CTA scrolls away within a
         screen or two and the next one is at the foot of a long page. -->
    <div class="stickybook">
      <span class="stickybook__meta">
        <span class="stickybook__name">{name}</span>
        <span class="stickybook__price">{sticky_price}</span>
      </span>
      <!-- No data-mb-event: the delegated tel: listener in the campaign
           bridge already sends phone_clicked (placement "stickybook");
           tagging it as well would count every call twice. -->
      <a class="stickybook__call" href="tel:+15714260602"
         aria-label="Call the salon, 571-426-0602">Call</a>
      <a class="stickybook__cta" href="/?service={form_slug}#book"
         data-mb-event="book_now_clicked" data-mb-service="{name}">Book now</a>
    </div>

    <footer class="foot">
      <img class="foot__badge"
           src="/img/brand/logo-full-360.webp"
           srcset="/img/brand/logo-full-360.webp 360w, /img/brand/logo-full-720.webp 720w"
           sizes="104px" width="104" height="104" loading="lazy" decoding="async"
           alt="Mirabelle.B &mdash; African Braiding &amp; Styling. Beauty. Culture. Confidence." />
      <p><a href="/">All services</a> · <a href="/policies.html">Booking policies</a> · <a href="/privacy.html">Privacy</a></p>
      <p>© <span id="y">2026</span> Mirabelle.B African Hair Braiding · Ashburn, Virginia</p>
    </footer>

    <script>
      document.getElementById("y").textContent = new Date().getFullYear();
    </script>

__CAMPAIGN_SCRIPT__
  </body>
</html>
"""


def esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


# Maps the page to the booking dropdown value, via the slug booking.js knows.
FORM_SLUG = {
    "Knotless Braids": "knotless-braids", "Box Braids": "box-braids",
    "Cornrows / Stitch Braids": "cornrows", "Fulani Braids": "fulani-braids",
    "Feed-In Braids": "feed-in-braids", "Kids’ Braids": "kids-braids",
    "Goddess Braids": "goddess-braids",
}


def build(s):
    imgs = G[s["gallery"]]
    hero_img, hero_alt = imgs[0]

    price_txt = f"From ${s['price']}" if s["price"] else "Price agreed when you book"
    facts = price_txt + (f" &middot; {s['duration']}" if s["duration"] else "")

    meta = (f"Book professional {s['name'].lower()} with Mirabelle.B in Ashburn, "
            f"Virginia. "
            + (f"From ${s['price']}. " if s["price"] else "")
            + (f"About {s['duration']}. " if s["duration"] else "")
            + "View pricing, appointment information and protective styling details.")

    benefits = "".join(f"\n          <li>{esc(b)}</li>" for b in s["benefits"])

    # Only rows we can actually fill. Deposit amount and hair-included are
    # omitted because the salon has not published them.
    rows = []
    rows.append(("Starting price", f"${s['price']}" if s["price"]
                 else "Agreed with you before your appointment"))
    rows.append(("Estimated time", s["duration"] if s["duration"]
                 else "Quoted when you book"))
    rows.append(("Deposit", "Required to hold your slot · card, Zelle or Cash App"))
    rows.append(("Booking notice", "48 hours where possible · walk-ins welcome"))
    spec = "".join(
        f'\n          <div class="spec__row"><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>'
        for k, v in rows)
    spec = f'<dl class="spec__list">{spec}\n        </dl>'

    gallery = ""
    if len(imgs) > 1:
        tiles = "".join(
            f'\n            <img src="{src}" alt="{esc(alt)}" loading="lazy" '
            f'decoding="async" width="600" height="600" />'
            for src, alt in imgs[1:])
        gallery = f"""
      <section class="block">
        <h2>{esc(s['name'])} at Mirabelle.B</h2>
        <div class="gallery">{tiles}
        </div>
      </section>
"""

    why = "".join(f"\n          <div class=\"why__row\"><dt>{esc(t)}</dt><dd>{esc(d)}</dd></div>"
                  for t, d in WHY)

    qa = faqs(s)
    faq_html = "".join(
        f'\n          <details>\n            <summary>{esc(q)}</summary>\n'
        f"            <p>{esc(a)}</p>\n          </details>" for q, a in qa)

    schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Service",
                "name": s["name"],
                "serviceType": s["name"],
                "provider": {
                    "@type": "HairSalon",
                    "name": "Mirabelle.B",
                    "telephone": "+1-571-426-0602",
                    "address": {
                        "@type": "PostalAddress",
                        "streetAddress": "44048 Lords Valley Ter",
                        "addressLocality": "Ashburn",
                        "addressRegion": "VA",
                        "postalCode": "20147",
                        "addressCountry": "US",
                    },
                },
                "areaServed": {"@type": "City", "name": "Ashburn"},
                "url": f"{SITE}/{s['slug']}/",
                **({"offers": {"@type": "Offer", "price": s["price"],
                               "priceCurrency": "USD",
                               "availability": "https://schema.org/InStock"}}
                   if s["price"] else {}),
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home",
                     "item": SITE + "/"},
                    {"@type": "ListItem", "position": 2, "name": s["name"],
                     "item": f"{SITE}/{s['slug']}/"},
                ],
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {"@type": "Question", "name": q,
                     "acceptedAnswer": {"@type": "Answer", "text": a}}
                    for q, a in qa
                ],
            },
        ],
    }

    return PAGE.format(
        h1=esc(s["h1"]), slug=s["slug"], site=SITE, name_lower=esc(s["name"].lower()),
        lede=esc(s["lede"]), meta=esc(meta), facts=facts,
        hero_img=hero_img, hero_alt=esc(hero_alt),
        what=esc(s["what"]), good_for=esc(s["good_for"]),
        benefits=benefits, spec=spec, gallery=gallery, why=why, faq=faq_html,
        # Raw HTML on purpose - it carries an anchor - and written here, not in
        # the service dict, so a service without a `related` key renders nothing
        # at all rather than an empty paragraph.
        related=(chr(10) + f'        <p>{s["related"]}</p>' if s.get("related") else ""),
        form_slug=FORM_SLUG[s["form_value"]],
        name=esc(s["name"]),
        sticky_price=(f"From ${s['price']}" + (f" · {s['duration']}" if s["duration"] else ""))
                     if s["price"] else "Price agreed when you book",
        schema=json.dumps(schema, indent=2),
    ).replace("__CAMPAIGN_SCRIPT__", CAMPAIGN_SCRIPT)


def main():
    for s in SERVICES:
        d = os.path.join(OUT, s["slug"])
        os.makedirs(d, exist_ok=True)
        io.open(os.path.join(d, "index.html"), "w", encoding="utf-8",
                newline="").write(build(s))
        n = len(G[s["gallery"]])
        print(f"  /{s['slug']}/{'':<{max(0,32-len(s['slug']))}} {n} image(s)")
    print(f"\n{len(SERVICES)} service pages generated.")


if __name__ == "__main__":
    main()

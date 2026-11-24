"""Generate the service landing pages in website/public/.

Ad traffic needs a page about the one style the ad showed, not the whole
site. These are those pages.

EVERY FACT HERE IS ALREADY PUBLISHED SOMEWHERE ON THE SITE:
  price, duration, description   -> the services table / the spec table
  preparation                    -> policies.html "Hair & Preparation"
  48 hours to book or cancel     -> policies.html, owner-confirmed 2026-08-26
  children, tension, aftercare   -> policies.html and #words

Nothing style-specific is invented. Where a style has no published price the
page says so plainly, exactly as the service cards do. If the owner later
supplies per-style prep notes or FAQs, add them to SERVICES below and re-run.

Run:  python scripts/build-landing-pages.py
"""

import io
import os

#
# DO NOT RUN THIS WITHOUT READING THIS FIRST.
#
# Seven of the nine slugs below (knotless-braids, box-braids, cornrows,
# fulani-braids, feed-in-braids, goddess-braids, kids-braids) are no longer
# full pages. They were replaced by /<slug>-ashburn-va/ from
# build-service-pages.py, and what sits at the old .html paths now is a
# hand-written noindex redirect stub pointing at the new URL. Running this
# script would overwrite those stubs with full pages again and put duplicate
# content back on the site.
#
# Only braided-updo and half-up-half-down are still real pages here; those two
# services never got an -ashburn-va page. If you need to regenerate, do it for
# those two slugs alone.
#
# AND EVEN THEN, NOT AS-IS. Both pages were hand-edited after generation to
# load /consent.js and carry the campaign bridge and click tracking copied from
# build-service-pages.py. This template has neither, so regenerating would
# silently strip their tracking. The right fix is to move both services into
# build-service-pages.py as -ashburn-va pages and redirect these two URLs.
#

OUT = os.path.join("website", "public")
SITE = "https://mimi-african-braiding-styling.com"

# slug -> page content. price/duration are None where the site publishes none.
SERVICES = [
    dict(
        slug="knotless-braids",
        name="Knotless Braids",
        image="/img/work/knotless-braids.webp",
        blurb="Natural look, lightweight and gentle on your scalp. Perfect for any occasion.",
        price="250",
        duration="5–8 hours",
        benefits=[
            "No knot at the root, so there is less tension where your hair is weakest.",
            "Lighter to wear than a knotted install, which is what most people notice first.",
            "A protective style: your own hair is tucked away while it grows.",
            "Parted on a measured grid — the part is the first thing a knowledgeable client checks.",
        ],
    ),
    dict(
        slug="box-braids",
        name="Box Braids",
        image="/img/work/box-braids.webp",
        blurb="Timeless and versatile. Many sizes and lengths to fit your style.",
        price="250",
        duration="5–8 hours",
        benefits=[
            "Many sizes and lengths, matched to what your hair will comfortably carry.",
            "A protective style that holds its shape through weeks of ordinary life.",
            "Square, consistent parting — the structure everything else sits on.",
            "Finished with your scalp oiled and your hairline left alone.",
        ],
    ),
    dict(
        slug="cornrows",
        name="Cornrows & Stitch Braids",
        image="/img/work/cornrows-stitch-braids.webp",
        blurb="Neat, stylish and long lasting. Perfect for a clean, elegant look.",
        price="120",
        duration="2–4 hours",
        benefits=[
            "The shortest appointment we offer for a full head — in and out in an afternoon.",
            "Clean, even rows that stay sharp as they grow out.",
            "Straight-back, stitch or a pattern of your choosing.",
            "A good first appointment if you have not sat with us before.",
        ],
    ),
    dict(
        slug="fulani-braids",
        name="Fulani Braids",
        image="/img/work/fulani-braids.webp",
        blurb="Trendy and stylish with beautiful beads or accessories.",
        price=None,
        duration=None,
        benefits=[
            "Braided in the Fulani tradition, finished with beads or accessories.",
            "The pattern is set to your face and your hairline, not copied from a photo.",
            "Tension set so the decorative work does not cost you your edges.",
            "Tell us what you have seen and we will tell you honestly what your hair will hold.",
        ],
    ),
    dict(
        slug="feed-in-braids",
        name="Feed-In Braids",
        image="/img/work/feed-in-braids.webp",
        blurb="Natural hair protection with a smooth, flawless finish.",
        price="120",
        duration="2–4 hours",
        benefits=[
            "Hair fed in gradually along the row, so the braid thickens without a knot at the root.",
            "Flat to the scalp and smooth from the first row to the last.",
            "Less weight at the hairline than a knotted start, which is where tension does its damage.",
            "A shorter appointment than a full-head install — in and out in an afternoon.",
        ],
    ),
    dict(
        slug="goddess-braids",
        name="Goddess Braids",
        image="/img/work/goddess-braids.webp",
        blurb="Braids finished with soft curled or wavy lengths.",
        price=None,
        duration=None,
        benefits=[
            "Braided structure at the root, soft curled or wavy lengths through the body.",
            "The braid does the protective work; the loose lengths do the rest.",
            "Sized and parted to your own density rather than to a photograph.",
            "Tell us the finish you want and we will tell you honestly what your hair will hold.",
        ],
    ),
    dict(
        slug="braided-updo",
        name="Braided Updo",
        image="/img/work/braided-updo.webp",
        blurb="Elegant updo styles for events, weddings and special occasions.",
        price=None,
        duration=None,
        benefits=[
            "Built for a specific day — a wedding, a party, a photograph.",
            "Set to hold its shape through the whole event, not just the first hour.",
            "Parted and pinned so nothing pulls at the hairline while you wear it.",
            "Bring the outfit or the reference and we will work to it.",
        ],
    ),
    dict(
        slug="half-up-half-down",
        name="Half Up Half Down",
        image="/img/work/half-up-half-down.webp",
        blurb="The best of both — braided structure with length left loose.",
        price=None,
        duration=None,
        benefits=[
            "Braided through the top, loose through the lengths.",
            "A lighter option when you are not ready for a full-head install.",
            "The braided section still carries the tension properly, measured and parted.",
            "Works as an everyday style or dressed up for one occasion.",
        ],
    ),
    dict(
        slug="kids-braids",
        name="Kids' Braids",
        image="/img/work/kids-braids.webp",
        blurb="Cute, comfortable and colorful styles kids will love.",
        price=None,
        duration=None,
        benefits=[
            "Every section is shown to the child before it is touched.",
            "We check in throughout, and we stop when they need us to.",
            "Nothing installed tighter than a young scalp should carry.",
            "A parent or guardian stays on the premises for the whole appointment.",
        ],
    ),
]

# Answers that hold for every style, each traceable to something published.
def faqs(s):
    items = []
    if s["duration"]:
        items.append((
            "How long does the appointment take?",
            f"Around {s['duration']}. We tell you which end of that to expect when "
            "you book, so you can plan the day.",
        ))
    else:
        items.append((
            "How long does the appointment take?",
            "It depends on the length and density of your hair and the size of the "
            "braids. We tell you the honest number when you book, and we start when "
            "we said we would.",
        ))

    if s["price"]:
        items.append((
            "How much does it cost?",
            f"From ${s['price']}. The final price depends on length, density and the "
            "size of the braids, and it is agreed with you before the appointment "
            "begins — never after.",
        ))
    else:
        items.append((
            "How much does it cost?",
            "We do not publish a starting price for this style, because it varies too "
            "much with what you are asking for. Call and we will quote you honestly, "
            "and the price is agreed before you sit down.",
        ))

    items += [
        ("How should I prepare?",
         "Come with your hair washed, fully dried and detangled, unless we have "
         "agreed otherwise. Undone hair eats into your appointment and into the "
         "quality of the result."),
        ("Do I need to bring my own hair?",
         "If you would like to, say so in the booking notes and we will tell you how "
         "much to bring for the style you want."),
        ("How far ahead should I book?",
         "Please book at least 48 hours in advance. Walk-ins are still welcome when a "
         "chair happens to be free — call 571-426-0602 and we will tell you honestly "
         "whether the day can take it."),
        ("What if I need to cancel or reschedule?",
         "Please give at least 48 hours' notice. A braiding chair booked for six hours "
         "cannot be filled at short notice, which is the whole reason the policy "
         "exists."),
        ("What if it feels too tight?",
         "Tell us. Tension is set so your edges survive the style, and if it hurts we "
         "take it down and reset it. That is the job, not a favor."),
    ]
    return items


PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{name} in Ashburn, VA — Mirabelle.B</title>
    <meta name="description" content="{meta_desc}" />
    <meta name="theme-color" content="#100B09" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="icon" href="/img/brand/favicon-192.png" type="image/png" sizes="192x192" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="canonical" href="{site}/{slug}.html" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Mirabelle.B" />
    <meta property="og:title" content="{name} in Ashburn, VA — Mirabelle.B" />
    <meta property="og:description" content="{meta_desc}" />
    <meta property="og:url" content="{site}/{slug}.html" />
    <meta property="og:image" content="{site}{image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/landing.css" />
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
        <img class="hero__img" src="{image}" alt="{name} braided by Mirabelle.B in Ashburn, Virginia"
             width="900" height="900" fetchpriority="high" />
        <div class="hero__body">
          <p class="eyebrow">African Hair Braiding · Ashburn, VA</p>
          <h1>{name}</h1>
          <p class="lede">{blurb}</p>
          <p class="facts">{facts}</p>
          <a class="cta" href="/?service={slug}#book">Book this style</a>
          <p class="cta__sub">Or call <a href="tel:+15714260602">571-426-0602</a> · Open Monday to Saturday</p>
        </div>
      </section>

      <section class="block">
        <h2>What you get</h2>
        <ul class="ticks">{benefits}</ul>
      </section>

      <section class="block">
        <h2>Before you come</h2>
        <p>
          Arrive with your hair washed, fully dried and detangled unless we have
          agreed otherwise. Undone hair eats into the appointment and into the
          quality of the result. If you are bringing your own hair, say so in the
          booking notes and we will tell you how much to bring.
        </p>
        <p>
          Most full-head styles run five to eight hours. We tell you which when
          you book, so you can plan the day around it.
        </p>
      </section>

      <section class="block">
        <h2>Questions</h2>
        <div class="faq">{faq}</div>
      </section>

      <section class="block block--cta">
        <h2>Ready to book?</h2>
        <p>
          Send a request and we confirm your slot by text, usually the same day.
          Nothing is charged on the website.
        </p>
        <a class="cta" href="/?service={slug}#book">Book {name}</a>
        <p class="cta__sub">
          44048 Lords Valley Ter, Ashburn, VA 20147 ·
          <a href="https://www.google.com/maps/search/?api=1&amp;query=44048+Lords+Valley+Ter%2C+Ashburn%2C+VA+20147"
             target="_blank" rel="noopener">Get directions</a>
        </p>
      </section>
    </main>

    <footer class="foot">
      <p><a href="/">All services</a> · <a href="/policies.html">Booking policies</a> · <a href="/privacy.html">Privacy</a></p>
      <p>© <span id="y">2026</span> Mirabelle.B African Hair Braiding</p>
    </footer>

    <script>
      document.getElementById("y").textContent = new Date().getFullYear();
    </script>
  </body>
</html>
"""


def esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def build(s):
    price_txt = f"From ${s['price']}" if s["price"] else "Price agreed when you book"
    facts = price_txt + (f" &middot; {s['duration']}" if s["duration"] else "")

    meta_desc = (
        f"{s['name']} by Mirabelle.B in Ashburn, Virginia. "
        + (f"From ${s['price']}. " if s["price"] else "")
        + (f"About {s['duration']}. " if s["duration"] else "")
        + "Book online or call 571-426-0602."
    )

    benefits = "".join(f"\n          <li>{esc(b)}</li>" for b in s["benefits"])

    qa = faqs(s)
    faq_html = "".join(
        f'\n          <details>\n            <summary>{esc(q)}</summary>\n'
        f"            <p>{esc(a)}</p>\n          </details>"
        for q, a in qa
    )

    # FAQPage markup only describes questions that are actually on the page.
    import json
    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q,
             "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in qa
        ],
    }

    return PAGE.format(
        name=esc(s["name"]), slug=s["slug"], image=s["image"], site=SITE,
        blurb=esc(s["blurb"]), meta_desc=esc(meta_desc), facts=facts,
        benefits=benefits, faq=faq_html,
        schema=json.dumps(schema, indent=2),
    )


def main():
    os.makedirs(OUT, exist_ok=True)
    for s in SERVICES:
        path = os.path.join(OUT, f"{s['slug']}.html")
        io.open(path, "w", encoding="utf-8", newline="").write(build(s))
        print(f"  wrote {path}")
    print(f"\n{len(SERVICES)} landing pages generated.")


if __name__ == "__main__":
    main()

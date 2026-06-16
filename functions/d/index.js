// Cloudflare Pages Function — route: /d (and /d/)
//
// Renders a PER-DISPUTE link-preview card. It serves the static landing page
// (`/d/index.html`) but rewrites the card's title/description from the
// display-only query params:
//
//     https://<host>/d/?n=<sender>&t=<topic>#<base64url(payload)>
//
// - `n` (sender name) + `t` (topic): read here, server-side, ONLY to fill the card.
// - the dispute payload (incl. the sealed claim) rides in the URL `#fragment`,
//   which browsers/HTTP never send to the server — so this function never sees it.
//
// Why a function (not just JS in the page): chat unfurlers (iMessage, WhatsApp,
// Slack…) read the <meta> tags from the server response and DO NOT run page JS.
// So the per-dispute text must be in the HTML we return here. HTMLRewriter also
// escapes attribute values for us, so `n`/`t` can't inject markup.

export const onRequest = async ({ request, next }) => {
  const url = new URL(request.url);

  const clean = (s, max) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const name = clean(url.searchParams.get("n"), 40);
  const topic = clean(url.searchParams.get("t"), 80);

  // Serve the static page (the generic fallback + our rewrite target).
  const response = await next();

  // Only transform HTML; if there's nothing to personalize, pass through untouched.
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") || (!name && !topic)) return response;

  const title = name
    ? `${name} wants the council to settle this`
    : "A dispute is waiting — Squabble Council";
  const description = topic
    ? `“${topic}” — tap to add your side. Free, on-device AI judges, in under a minute.`
    : "Someone wants the council to settle this. Tap to add your side — free, on-device AI judges.";
  const image = `${url.origin}/og/card.png`; // add this 1200×630 asset to the host

  const setContent = (value) => ({ element: (el) => el.setAttribute("content", value) });
  const setText = (value) => ({ element: (el) => el.setInnerContent(value) });

  const transformed = new HTMLRewriter()
    .on("title", setText(title))
    .on('meta[name="description"]', setContent(description))
    .on('meta[property="og:title"]', setContent(title))
    .on('meta[property="og:description"]', setContent(description))
    .on('meta[property="og:image"]', setContent(image))
    .on('meta[name="twitter:title"]', setContent(title))
    .on('meta[name="twitter:description"]', setContent(description))
    .on('meta[name="twitter:image"]', setContent(image))
    .transform(response);

  // The card varies per dispute (?n&t); don't let a CDN serve one dispute's card
  // for another. (Preview fetches are low-volume, so skipping the cache is fine.)
  const headers = new Headers(transformed.headers);
  headers.set("cache-control", "no-store");
  return new Response(transformed.body, { status: transformed.status, headers });
};

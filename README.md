# Squabble Council — web host

Host behind the app's Universal Links, the shared-dispute links (Mode 2), and the signed character manifest. **Not part of the iOS build.**

## What it serves
- `/.well-known/apple-app-site-association` — AASA for `applinks:` (Universal Links). Must be at the domain root, **no redirect**.
- `/d/…` — the **shared dispute link** endpoint (Mode 2). See below.
- `/characters/manifest.json` (+ `.sig`) — the signed dynamic-character manifest (see `characters/README.md`).
- `/og/card.png` — branded Open Graph preview image (one asset, reused for every dispute).

## `/d/` — shared dispute links (Mode 2)

The client (`DisputeLinkCodec.url(for:)`) builds:

```
https://<host>/d/?n=<urlenc(senderName)>&t=<urlenc(topic)>#<base64url(payload)>
```

- **Query `n` + `t`** (sender name, topic) — display-only, **server-readable**. Used *only* to render a per-dispute link-preview card. Safe to expose (the recipient sees both anyway).
- **Fragment `#…`** (the full dispute, **including the sealed claim**) — **never sent to the server**. The app decodes this; the host never sees it.

### The `/d/` route must be DYNAMIC

To show a per-dispute card ("*Daniel* wants the council to settle this") the route must emit **per-request** Open Graph meta from `n`/`t`. **Plain static GitHub Pages cannot do this** — host `/d/` on a dynamic platform (**Cloudflare Pages Functions / Workers**, or Vercel/Netlify). The AASA + the whole domain move with it (revisits the host choice, D-15).

The handler does two things:

1. **For the preview crawler (which does NOT run JS):** read `n`/`t` from the query, HTML-escape + length-cap them, and emit:
   - `og:title` = `"{n} wants the council to settle this"`
   - `og:description` = `"“{t}” — tap to add your side. Free, on-device AI judges."`
   - `og:image` = `https://<host>/og/card.png`
   - mirror as `twitter:title` / `twitter:description` / `twitter:image` with `twitter:card = summary_large_image`
   - If `n`/`t` are absent (a generic link), emit the branded **generic** card.
2. **For a human who taps without the app installed:** the existing behavior — read `location.hash` in JS, show the Smart App Banner + App Store redirect. (When the app *is* installed, the Universal Link opens it directly and this page isn't shown.)

The handler reads **only `n`/`t`**; it cannot see the claim (it's in the fragment) and stores nothing.

### Cloudflare Pages Function sketch — `functions/d/index.js`

```js
export function onRequest({ request }) {
  const u = new URL(request.url);
  const esc = (s) => (s ?? "").slice(0, 80).replace(/[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const n = esc(u.searchParams.get("n")) || "Someone";
  const t = esc(u.searchParams.get("t"));
  const title = `${n} wants the council to settle this`;
  const desc  = t ? `“${t}” — tap to add your side.`
                  : "Tap to add your side — free, on-device AI judges.";
  const img = `${u.origin}/og/card.png`;
  return new Response(
`<!doctype html><html><head><meta charset="utf-8">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${img}">
<meta name="apple-itunes-app" content="app-id=6778672000">
<!-- existing install-redirect script: reads location.hash, sends non-users to the App Store -->
</head><body></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } });
}
```

## Privacy
`n` (name) + `t` (topic) appear in request logs (display-only — the recipient sees both anyway). The **claim never leaves the URL fragment**, so it is never logged or sent to the host. Keep anything sensitive out of the query.

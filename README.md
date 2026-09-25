# Georgian Transliterator

Offline web app: type Georgian in Latin or Cyrillic letters and get Georgian script
(ქართული) plus English and Russian translations. Everything (dictionary, grammar
rules, UI) lives in a single `index.html`; no network access is needed at runtime.

- Input styles: chat Latin (`rogor xar`, `tsqali`, `4emi`), national 2002 (`k'`, `t'`,
  `ts'`), Georgian keyboard layout (`T S C W R J Z`), Cyrillic (`гамарджоба`) and Georgian script.
- Ambiguous letters (t → თ/ტ, k → კ/ქ/ყ, ts → ც/წ …) are resolved with the built-in
  dictionary (~1000 words, ~120 phrases) including case endings and postpositions.
- Covers everyday speech plus bank and government SMS vocabulary (payments, cards,
  one-time codes, loans, taxes, fines, documents, Public Service Hall …); amounts,
  dates, codes, links and abbreviations such as GEL or PIN are kept unchanged.
- Installable PWA, works offline, supports the system share sheet (share text → app).

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | The whole app: markup, styles, dictionary, engine, UI. Also works opened directly from disk. |
| `manifest.webmanifest` | PWA metadata: name, icons, colours, shortcuts, share target. |
| `sw.js` | Service worker: precaches all files and serves them cache-first, forever. |
| `icons/` | App icons (SVG source + PNG sizes, maskable variant, Apple touch icon). |
| `scripts/build.mjs` | Builds `dist/`: content-hashed file names, stamps version into `sw.js`. |
| `_headers` | Long-lived `Cache-Control` rules for Netlify / Cloudflare Pages. |
| `.github/workflows/deploy.yml` | Builds and deploys to GitHub Pages on every push to `main`. |

## Run locally

```sh
node scripts/build.mjs
npx serve dist        # or: python3 -m http.server -d dist
```

Opening `index.html` directly also works (the service worker is simply skipped on `file://`).

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (branch `main`).
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` (or a manual run of the workflow) publishes the site at
   `https://<user>.github.io/<repo>/`. All paths are relative, so any repo name works.

## Caching

The goal is that a visitor downloads the app once and never again until it changes.

- **Service worker (works everywhere, including GitHub Pages).** On install it stores
  every file in a cache named after the site's content hash and afterwards serves
  everything from that cache without touching the network. The page registers it with
  `updateViaCache: 'none'`, so only the small `sw.js` is checked on the network. When
  a deploy changes any file, the hash (and therefore `sw.js`) changes, the new version
  is downloaded in the background and the page shows a “new version — Reload” bar.
- **Content-hashed file names.** Icons and the manifest are published as
  `name.<hash>.ext`, so they can safely be cached as `immutable` for a year.
- **HTTP headers.** GitHub Pages does not allow custom headers (it always sends
  `max-age=600`), which is why the service worker does the long-term caching there.
  On Netlify or Cloudflare Pages the `_headers` file additionally sets
  `max-age=31536000, immutable` on hashed files and `no-cache` on `index.html` / `sw.js`
  (entry points must stay revalidated, otherwise updates could never arrive).

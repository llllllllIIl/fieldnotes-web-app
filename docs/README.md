# Fieldnotes — static portfolio copy (English)

Self-contained static site for GitHub Pages. No backend, no Supabase, no build
step: open `index.html` or serve this folder.

- `index.html` — portfolio landing (project overview, stack, architecture)
- `demo.html` + `demo-data.js` + `demo.js` — interactive blog demo with sample
  data (article list, detail, comments, like toggles, same hot-score ranking
  as the API, all in-memory)
- `styles.css`, `background.js` — theme + animated canvas background
- `404.html`, `.nojekyll` — GitHub Pages helpers

## Publish to GitHub Pages

Option A — serve from this repo:

1. Create a repo (e.g. `blog-portfolio`) and push this project.
2. On GitHub: Settings → Pages → Source: `Deploy from a branch`,
   Branch: `main`, Folder: `/docs`.
3. Your site is live at `https://YOUR_USERNAME.github.io/blog-portfolio/`.

Option B — standalone portfolio repo:

1. Copy the contents of `docs/` into a new repo (e.g. `portfolio`).
2. On GitHub: Settings → Pages → Source: `Deploy from a branch`,
   Branch: `main`, Folder: `/ (root)`.
3. Live at `https://YOUR_USERNAME.github.io/portfolio/`.

## Notes

- The site contains no personal info: no names, emails or credentials.
  `YOUR_USERNAME` in the URLs above is just the deploy-URL placeholder.
- `demo-data.js`: optionally rewrite the sample articles in your own words.

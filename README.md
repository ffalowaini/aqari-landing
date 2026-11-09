# عقاري ذكي — Frontend

Static site (HTML, CSS, vanilla JavaScript ES modules), no build step.
Served by GitHub Pages: https://ffalowaini.github.io/aqari-landing/

The backend (Spring Boot REST API) lives in the separate `aqari-backend` repo.

## Run locally

```bash
python3 dev-server.py        # http://localhost:8080
```

Use `dev-server.py` rather than `python3 -m http.server`: it serves clean URLs
(`/login` → `login.html`) the same way GitHub Pages does. When opened from
localhost (or a LAN IP), the site talks to the local backend on port 8081;
anywhere else it talks to the deployed Render backend (see `assets/js/config.js`).

## Structure

```
index.html  login.html  signup.html  dashboard.html   pages (kept at the root for clean URLs)
dev-server.py                                          local static server
assets/
  css/
    base.css          design tokens, reset, logo, buttons (every page)
    landing.css       landing page
    auth.css          login / signup
    dashboard.css     dashboard app
  js/
    landing.js  login.js  signup.js  dashboard.js     one entry point per page
    config.js                                          which backend to call
    router.js                                          #units, #overview, #admin, #property/:id, #unit/:id
    core/
      api.js          HTTP client for every backend endpoint
      session.js      JWT + signed-in user in localStorage
      auth-guard.js   requireAuth / redirectIfLoggedIn / logout
      app-clock.js    client-side "today" (follows the test date in local dev)
    pages/            one module per dashboard page (render function)
      units.js  property-details.js  unit-details.js  overview.js  admin.js
    modals/           dialogs, grouped by what they act on
      property-modals.js  unit-modals.js  contract-modals.js
    components/       reusable UI pieces
      dom.js  modal.js  table-filter.js  contract-ui.js
    features/
      test-clock.js   test-date button (local dev only)
    utils/            pure helpers
      format.js  hijri.js  dates.js  text.js  form.js
```

Dependency direction: `pages` → `modals` → `components` → `utils` / `core`.
Dialogs never call page functions directly; the caller passes an `onSaved`
callback that re-renders the page it was opened from.

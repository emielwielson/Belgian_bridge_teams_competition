# Manual screenshots

Screenshots are resolved as `/manuals/{locale}/{filename}` based on the
active UI language (`en`, `nl`, `fr`).

If a locale-specific file is missing, the manuals UI falls back to the
legacy unscoped path `/manuals/{filename}` (used by older player/captain
shots).

## Honor lineup

Fixtures: `/dev/honor-manual-shots?locale=nl|en|fr` (dev only).

```bash
# with npm run dev already running:
npx playwright install chromium
npm install -D playwright   # temporary
node scripts/capture-honor-manual-shots.mjs
npm uninstall playwright
```

Outputs:

- `public/manuals/nl/honor-lineup-*.png`
- `public/manuals/en/honor-lineup-*.png`
- `public/manuals/fr/honor-lineup-*.png`

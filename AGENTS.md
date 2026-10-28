# Stanley Memory: agent notes

- Stack: Next.js 16 (App Router, Turbopack), TypeScript, plain CSS tokens in `src/app/globals.css`. ESM (`"type": "module"`).
- Verify: `npm run typecheck`, `npm run test:unit` (offline), `npm run build`. With a key in `.env.local`: `npm run eval`.
- Design: accent-ladder app style (raspberry hue on small marks, pale tints on areas, DM Sans, no shadows). Check UI with the design-taste-frontend skill: `lint.mjs` and `inspect.mjs --app`.
- State lives in `.data/state.json` (gitignored). `POST /api/reset` clears it.
- Embedding thresholds were calibrated on MiniLM; re-run `npm run test:unit` after changing `DUPLICATE_THRESHOLD` or `AVOID_THRESHOLD`.
- Dependency versions are pinned to releases at least 7 days old.

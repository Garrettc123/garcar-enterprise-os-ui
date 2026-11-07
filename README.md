# Garcar Enterprise — Statewide Texas Follow-Up Review

Production branch: `main`. Railway service: `garcar-commerce-preview` in project `determined-dream`.
Live domain: https://garcar-enterprise.up.railway.app

## Service territory
- Texas-wide online service for real estate teams in **all Texas counties**, including DFW, Houston, Austin, San Antonio, Waco, West Texas, the Gulf Coast, and the Rio Grande Valley.
- The $497 Follow-Up Review is a remote review of one authorized, usable CRM lead export. Delivery is targeted within 48 hours of receiving approved usable data.
- One optional $2,500 scoped installation, crediting the $497 review payment subject to verification ($2,003 remaining).
- Statewide availability does **not** imply physical offices or on-site service. Installation remains subject to compatibility, permissions, and separate agreement.

## Production constraints
- Stripe-hosted checkout: https://buy.stripe.com/8x2eVddjf0hQ86Tf0f43S2h
- The homepage retains exactly one direct checkout link and one consent-required inquiry form.
- The first-party intake POST is relayed securely from the site's server to the dispatcher-backed acquisition ledger; the site does not keep local customer records.
- Inquiry events go to the configured PostHog project *only after backend acceptance*. Do not send raw lead lists through the public form.
- The seven additional divisions and 50 archived product listings remain on `/more` and are **not** advertised as instantly purchasable.
- Credentials are environment-only; never commit secrets. No automated outbound messages or payment claims.
- Local: `npm start`; tests: `npm test`; availability: `/health`.

## Historical backup
The prior Bun site was archived to `archive/pre-dfw-site-20261104`, file `archive/railway-site-before-dfw-rewrite-2026-11-04.js` (commit `be3b1c19c5da25bfeae62dd9b91be62021143e25`). Legacy deployment identifiers do not define the current statewide service boundary.

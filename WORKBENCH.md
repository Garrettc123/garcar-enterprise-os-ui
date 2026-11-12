# Garcar Enterprise — Revenue Workflow extension

This is a **single-offer internal workflow** attached to the existing Garcar website. It does not replace the public $497 checkout, create a separate command center, use a new payment processor, or send any outbound messages.

## Routes

- `/` — existing public statewide real-estate offer (unchanged)
- `/workbench` — internal workflow UI (noindex; browser-local only)
- `/workbench.js`, `/workbench.css` — same-origin assets

## Operating constraints

- Browser-local list persistence is **not encrypted**. Use only on a trusted browser/device with buyer authorization and express local-storage consent. No file or buyer row is transmitted to the server.
- Buyer-owned CSV rows only; no sample customers or fabricated numbers. Imports require a real lead ID, tolerate missing timestamps (classified `unknown`), and reject duplicate IDs or malformed CSV. Maximum 2 MB / 3,000 rows per list.
- The browser classification and explainable score follow the published deterministic rules of `Garrettc123/callback-clock`; this UI does not claim to invoke the Python engine or reconcile its hash-chained ledger.
- All draft content requires an exact-text, revocable, explicit confirmation before the **copy** action. There is no send endpoint.
- Manual payments are marked operator-confirmed only when there is evidence/reference, date, amount >= quoted price, and explicit checkbox. No Stripe API calls or booked revenue figures are implied.
- Contractor variant pricing starts unset because its terms are buyer-dependent. Editing prices here does not modify public Stripe checkout.
- Import/export CSV is spreadsheet-formula escaped. Optional backup export contains unencrypted PII; store only in a secure approved location.
- This route is excluded from the sitemap. It should remain unlinked from the public sales funnel. For multi-user production or hosted PII, add authentication, server-side encryption, access controls, and an audited backend before changing the browser-local boundary.

## Tests

```bash
node workbench.test.mjs
npm test
```

Suggested review procedure: test zero-data screens, import a buyer-approved *real* CSV using an authorized device, inspect unknown classifications, verify approval invalidation after every draft edit, verify delivery evidence and payment guard, then deploy only after the owner accepts the privacy boundary.

## Integration references (not live integrations)

- Existing public site: `Garrettc123/garcar-enterprise-os-ui` (this repository)
- Callback priority rules: `Garrettc123/callback-clock`
- Existing Revenue Control context: `Garrettc123/garcar-revenue-os`
- Public checkout and acquisition relay: retained, unchanged by this feature

# Revenue funnel attribution audit — November 17, 2026

## Observed live Stripe data (read-only)

Source: Stripe account `acct_1SS3dpFKGbk21LK5`, 2026-11-17 UTC. The connected Stripe API returned four complete Checkout Session pages, **394 sessions**, all with `payment_status=unpaid`; 13 PaymentIntents (none `succeeded`) and 10 invoices (none paid). These are Stripe objects, not website visitor analytics or a customer census.

Of those sessions, **42** came from the canonical, active `$497` one-time Payment Link `plink_1UEcv4FKGbk21LK57hRic0dR`:
- 41 expired, 1 open, 0 paid.
- **0/42** contain `client_reference_id`.
- **0/42** include a linked Stripe Customer or PaymentIntent; metadata includes the static offer descriptors.
- Sessions span 2026-09-13 through 2026-11-16, with repeat sessions on several days. A session is **not** evidence of a unique buyer, qualified lead, willingness to pay, or an attempted card charge.

The original website hero linked directly to `https://buy.stripe.com/8x2eVddjf0hQ86Tf0f43S2h`; this path does not pass the first-party `lead_...` identifier. Its separate inquiry form uses a token-authenticated backend and generates the same Payment Link with `?client_reference_id=lead_<id>`, and the server validates the exact URL and linked ID. The absence of IDs in existing sessions is **consistent with unlinked direct checkout**, but is not proof that every session originated from the homepage.

## Review-only change

- The hero's primary button now scrolls to the established `#request-review` form. A successful real inquiry returns the existing strictly validated checkout URL linked to the persisted lead ID.
- An explicit secondary link continues to provide **direct $497 one-time Stripe checkout** for buyers who do not want to fill out the request form first. It prominently discloses that these direct payments require manual receipt verification/intake.
- The checkout endpoint, Stripe link, amount, terms, existing opt-in requirements, and backend persistence are unchanged. No new buyer record, analytics event, charge, secret, or outbound message was created.
- Regression tests enforce the primary tracked inquiry path, preserve one direct Stripe link, distinguish attributed/unattributed checkouts, and forbid claiming that filling out the form charges money.

## Remaining verification

1. After account owner has confirmed Google recovery and 2FA safety, check the first-party acquisition metrics under **operator-only authentication**; do not simulate a customer lead in production.
2. For a real inquiry, verify the backend issues a `lead_...` ID and its Stripe link includes the exact `client_reference_id`. A customer must voluntarily complete the purchase. Signed Stripe webhook receipts should then bind the paid Checkout Session to the persisted first-party lead.
3. For a real direct payment, manually reconcile the Stripe receipt and the buyer request without inventing a lead ID. Do not assume the Checkout Session ID identifies an authorized CRM export.
4. Verify signed webhooks, payment security PRs and the actual persistent intake queue before automating fulfillment. No email or raw customer lead export should be transferred until explicitly authorized.
5. Measure *real* form visits, consented inquiries, actual checkout completions, receipts and independently reconciled collections. Do **not** report 42 checkout sessions as 42 buyers or imply a conversion rate from sessions alone.

**Release state:** draft PR only. There is no production deployment, Stripe write, new account secret, customer contact, or payment collection associated with this change.

# DFW Follow-Up Review — Commercial Launch Runbook
**Garcar Enterprise LLC | 2026-11-04 | Prelaunch / manual-control mode**

## Offer and scope
- Primary offer: **$497 one-time Follow-Up Review**, one DFW real estate team and one authorized, recent CRM lead export.
- Deliverable: a findings summary and prioritized callback sheet identifying observed response gaps and records with no evidenced next action.
- Target delivery: **within 48 hours after receipt of a usable, authorized export**. Do not start the clock from purchase time.
- Optional separate install: **$2,500 one-time** follow-up timer, ownership alerts and designated backup caller in a compatible CRM. Credit a verified $497 review purchase toward that installation; quote the remaining **$2,003** after compatibility and scope review.
- No guaranteed revenue lift, client contacts, automated calling, or CRM modification as part of the review.

## Approved first-customer path (manual control)
1. Buyer reviews /terms, /privacy, and /support, then pays through the single homepage Stripe link (one-time $497).
2. An operator verifies the payment's **succeeded/paid** state in the connected live Stripe account, cross-checking receipt/session identity. Do not infer success from a redirect, page visit, or email.
3. Buyer contacts **gwc2780@gmail.com** with Stripe receipt ID and CRM name only. **Never request or accept raw CRM exports, lead phone numbers, passwords, or personal records over email.**
4. Operator checks authority to access the data, agreed purpose, data minimization and retention/deletion procedure. Arrange an approved secure transfer or restricted read-only CRM access before any customer data is exchanged.
5. Record the time a complete authorized export becomes available. Analyze lead-creation/assignment/first-response timestamps with explicit timezone and agreed thresholds. Missing fields are **unknown**, not automatically missed callbacks.
6. Deliver a findings summary + prioritized callback sheet via an agreed secure channel before 48 hours elapse. Log delivery timestamp and handle corrections. Customer remains responsible for follow-up/contact consent.
7. Offer optional $2,500 installation only after the review and compatibility assessment; verify the $497 credit before invoicing. Obtain approval for any modification or outbound communication.

## Minimum accepted data schema
Use the least sensitive possible export: internal lead ID (or pseudonymous identifier), created_at, assigned_owner, last_activity_at, first_response_at (if known), lifecycle stage, source channel (optional), status, and timezone. Contact details are not necessary to diagnose response delay and should be excluded unless a justified authorized case requires them.

## Customer deliverables / quality checklist
- Report header: scope, source, export date/time, timezone, analysis rule version, number of rows imported, unusable rows, and limitations.
- Summary: number reviewed, number with observable response gaps, number with unknown data, and severe backlog counts.
- Callback queue: pseudonymous lead ID, evidence timestamps, assigned owner, reason for flag, and recommended next action. Do not assert an actual failure where the export lacks relevant fields.
- File security: no public URLs, no secrets, and controlled sharing with the authorized client.
- Handoff: note delivery time; if the customer elects the install, document credit and distinct scope.

## Launch blockers / decision gates
- [ ] **Stripe confirmation corrected:** The currently configured confirmation asks customers to email their CRM export; replace with receipt ID + CRM name only, and secure intake instructions. Verify the changed live link from Stripe read API.
- [ ] **Web checkout journey verified:** GET /, /start, /support, /privacy, /terms, /health all return expected status on the production hostname from a working external network; check mobile, navigation, and accessibility.
- [ ] **Checkout exact charge verified:** one-time $497 (49700 USD cents), active live Payment Link, no surprise subscription; receipt and buyer confirmation verified without an unauthorized live test charge.
- [ ] **Webhooks and ledger verified:** verify active Stripe destination, signing-secret validation, delivery 2xx, deduplication, and a test-mode checkout flow. Prove payment event > internal order > receipt > ledger record > fulfillment notification. Never mark fulfillment paid on an unsigned event.
- [ ] **Service configuration:** target payment receiver reports READY, not merely /health 200. Confirm required secret variables through approved secrets management; do not paste secrets in documents or chat.
- [ ] **Operator controls:** retain the execution kill switch while owner step-up and read-only canary are pending. No automatic outreach or CRM updates without authorized action.
- [ ] **Data policy:** final privacy/retention/deletion approach, access permissions, secure transfer method, customer support and refund/dispute SOP approved before first customer data is transferred.
- [ ] **Customer handling:** an operator can identify a paid order, respond to buyer within business hours, accept data securely, deliver in 48 hours, and handle refund/dispute questions.
- [ ] **Documentation/evidence:** snapshot of passing local preflight, external HTTP check, webhook delivery (test), reconciled payment (test), and operator sign-off.

## Launch states
- **Engineering deployment healthy** does not mean **commercially launch-ready**.
- **Prelaunch** until every material gate above is evidenced.
- **Controlled first-sale launch** after safe post-checkout instructions, secure intake, payment verification and manual fulfillment are proven; keep automation paused.
- **Automated launch** only after signed webhooks, idempotent order/ledger writes, safe rollback and owner approval have been tested separately.

## Initial manual acquisition motion
Prioritize DFW residential real-estate team principals and operations leads with active CRM usage and evidence of high inquiry volume; use verifiable business information and lawful, permission-aware contact channels. Prepare no more than 10 tailored first-touch drafts for review. No bulk sending, scraping of private contact information, paid ads, or use of unapproved customer data. A successful first transaction is a Stripe-confirmed $497 payment and an on-time, quality-controlled review, not a claimed conversion or an optimistic forecast.

## Incident handling
- Payment succeeded, ledger missing: stop automated fulfillment, reconcile receipt manually, verify webhook delivery/signature/idempotency, document discrepancy.
- Customer sends raw lead data by email: do not forward; request approved secure channel and follow retention/deletion policy.
- Site or checkout inaccessible: do not run outreach; confirm current deployment, health check and domain status before retry.
- Data missing/ambiguous: request only needed fields via secure process; document clock start accurately.
- Dispute/refund: retain minimal Stripe transaction, customer agreement, intake/delivery evidence in approved systems; respond promptly and follow published terms.

*This runbook is an operational checklist, not proof that all production gates have passed. No new paid services, outreach campaigns, or security overrides are authorized by this document.*

# Garcar Enterprise — Revenue Recovery Release Gate (November 16–17, 2026)

**Status: BLOCKED pending account-owner security verification and end-to-end evidence.** This is a source-linked recovery record, not a claim of successful production recovery.

## Evidence

- Google account: a recent recovery and 2FA-change notification requires owner confirmation. The present 2FA and session state are unverified. Do not disclose incident details or recovery links in public issue trackers.
- Stripe live account: all seven matching legacy $47 Lead Leak Audit / diagnostic links inactive (164 live payment links scanned). The RRS-497-WEEK $497/week, AGE-1497-MO $1,497/month, and MLS-497 $497 one-time links were active with matching price amounts and recurrence. Checkout completion, signed webhooks, settlements, and fulfillment were not verified.
- Stripe webhook routing: 15 endpoints were listed, seven enabled. Multiple enabled endpoints subscribe to overlapping checkout and invoice events; durable idempotency and fulfillment isolation must be proven before claiming safe payment routing.
- Supabase: the connected accounts list zero accessible projects and a direct lookup was permission-denied. A historical pause notification references a different, marketplace-linked organization; the current status and relationship to the production acquisition backend remain unverified. Do not create a replacement or assume that restoring this particular project fixes the website.
- Website: garcar-enterprise-os-ui has an acquisition inquiry endpoint and a public CSV **column template**. It does not expose an authenticated customer CSV upload. The separate review-workspace-sandbox Railway service is test-only, not a live customer upload workflow.
- Railway site deployment was reported SUCCESS, but zero /api/acquisition requests were counted over the sampled seven-day window. Deployment success is not an end-to-end acceptance test.
- Linear: more than 250 unread review notifications were observed. Ten bot boilerplate notifications were marked read while preserving substantive findings.

## Fail-closed release gates

1. **Identity:** owner confirms or denies the Google recovery request. If unrecognized, secure the account, sign out unknown sessions, revoke unfamiliar third-party access, and restore phishing-resistant 2FA. Rotate credentials only after trusted control is reestablished. Do not put secrets in issues, logs, or chat.
2. **Supabase:** locate the correct project and verify its actual state with authorized access. First check the marketplace-linked organization referenced in the owner's private Supabase notification. Resume only a confirmed paused project, after confirming it actually backs the affected application. Verify RLS, tenant boundaries, migrations, and persistence before production intake.
3. **Acquisition:** use the read-only readiness script in this PR. Require process health, configuration, authenticated upstream handshake, and public CSV template checks. A pass is a read-only preflight, **not** a lead-write test.
4. **Payments:** preserve disabled legacy $47 links until a secure fulfillment path is independently tested. Require a correctly priced Stripe link, signed webhook, idempotent durable receipt, secure customer intake, and a canonical fulfillment owner across overlapping enabled receivers. Do not run a live charge as a health check.
5. **Customer CSV:** implement authenticated upload, authorization, size/type validation, malware controls as appropriate, tenant isolation, encryption, retention, and durable receipts before claiming a customer drop-page. Never email raw lead lists or wire public uploads to the staging-only reviewer.
6. **Prospects:** verify real company/contact details and deduplicate against CRM. Obtain explicit owner approval of exact outbound recipients and copy; do not send to .example domains.
7. **Notifications:** preserve substantive PR/security review comments; clear only low-value boilerplate. Avoid scheduled polling or webhook loops until the integration is healthy.

## Verification

Run the local contract suite: node --test scripts/verify-live-readiness.test.mjs

Dispatch the GitHub Actions workflow **Garcar read-only revenue readiness** manually to check the four public GET endpoints. The workflow has read-only repository permissions and performs no production mutation. The site is not considered commercially ready until the separate write, payment, and fulfillment gates pass.

## References

- Website: https://github.com/Garrettc123/garcar-enterprise-os-ui
- Payment hardening: https://github.com/Garrettc123/garcar-emergency-payments/pull/3
- Subscription deduplication: https://github.com/Garrettc123/garcar-emergency-payments/pull/5
- Google security: https://myaccount.google.com/security-checkup
- Supabase project restoration: https://supabase.com/docs/guides/platform/free-project-pausing
- Linear inbox: https://linear.app/docs/inbox

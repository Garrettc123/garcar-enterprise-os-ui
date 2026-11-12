// Verify that buyer acquisition can only return the canonical $497 review checkout.
// This prevents a compromised or misconfigured upstream from substituting a different
// Stripe-hosted product or linking a checkout to another lead.
export const REVIEW_CHECKOUT_BASE = 'https://buy.stripe.com/8x2eVddjf0hQ86Tf0f43S2h';

export function isExpectedReviewCheckoutUrl(value, leadId) {
  if (typeof value !== 'string' || typeof leadId !== 'string' ||
      !/^lead_[a-f0-9]{32}$/.test(leadId)) return false;
  try {
    const url = new URL(value);
    const expected = new URL(REVIEW_CHECKOUT_BASE);
    return url.protocol === 'https:' &&
      url.origin === expected.origin &&
      url.pathname === expected.pathname &&
      !url.username && !url.password && !url.hash &&
      url.searchParams.size === 1 &&
      url.searchParams.get('client_reference_id') === leadId;
  } catch {
    return false;
  }
}

// Read-only verification of real Stripe offer identities and the single site checkout.
// This module never contacts Stripe or mutates a price, link, or payment setting.
const MONEY = /^[a-z]{3}$/;
const ID = /^(plink|price|prod)_[A-Za-z0-9]+$/;
const expected = new Map([
  ['MLS-497', {minor:49700,type:'one_time',interval:null,site:true}],
  ['RRS-497-WEEK', {minor:49700,type:'recurring',interval:'week',site:false}],
  ['AGE-1497-MO', {minor:149700,type:'recurring',interval:'month',site:false}],
  ['LLA-47-48H', {minor:4700,type:'one_time',interval:null,site:false}],
]);

export function validateObservedStripeOffers(registry, canonicalUrl) {
  if (!registry || registry.schema_version!==1 || registry.status!=='NOT_RELEASE_APPROVED'
      || registry.audit!=='read_only_live_stripe_inventory'
      || registry.website_offer_id!=='MLS-497'
      || !Array.isArray(registry.offers) || registry.offers.length!==expected.size)
    throw new Error('Registry schema or release state invalid');
  if (registry.policy?.require_owner_identity_security_clearance!==true
      || registry.policy?.require_signed_webhook_and_durable_receipt!==true
      || registry.policy?.require_authenticated_fulfillment!==true
      || registry.policy?.no_automatic_price_updates!==true
      || registry.policy?.never_conflate_equal_amounts_with_different_intervals!==true)
    throw new Error('Required security gates cannot be removed');
  if (registry.webhook_inventory?.full_route_reconciliation_completed!==false
      || registry.buyer_data_transfer?.authenticated_csv_upload_verified!==false)
    throw new Error('Unverified webhook or CSV readiness cannot be promoted');
  const seen = {offer:new Set(),link:new Set(),price:new Set(),product:new Set()};
  let siteOfferCount=0;
  for (const row of registry.offers) {
    const rule = expected.get(row.offer_id);
    if (!rule || seen.offer.has(row.offer_id)) throw new Error('Unknown or repeated offer ID');
    seen.offer.add(row.offer_id);
    if (row.price_minor!==rule.minor || row.currency!=='usd' || !MONEY.test(row.currency)
        || row.price_type!==rule.type || row.billing_interval!==rule.interval
        || row.site_checkout_allowed!==rule.site
        || row.fulfillment_verified!==false || typeof row.link_active!=='boolean')
      throw new Error('Offer price, cadence or fulfillment mismatch: '+row.offer_id);
    const prefixes={link:'plink_',price:'price_',product:'prod_'};
    for (const [type,key] of [['link','payment_link_id'],['price','price_id'],['product','product_id']]) {
      if (!ID.test(String(row[key])) || !String(row[key]).startsWith(prefixes[type])
          || seen[type].has(row[key]))
        throw new Error('Invalid or reused '+type+' ID');
      seen[type].add(row[key]);
    }
    let u;
    try {u=new URL(row.payment_link_url);} catch {throw new Error('Invalid link URL');}
    if (u.protocol!=='https:' || u.hostname!=='buy.stripe.com'
        || u.username || u.password || u.search || u.hash || u.port
        || !/^\/[A-Za-z0-9]+$/.test(u.pathname))
      throw new Error('Unapproved checkout URL');
    if (row.site_checkout_allowed) {
      siteOfferCount++;
      if (!row.link_active || row.payment_link_url!==canonicalUrl)
        throw new Error('Site checkout is not the verified active MLS-497 link');
    }
    if (row.offer_id==='LLA-47-48H' && row.link_active)
      throw new Error('Unreviewed audit link activation');
  }
  if (siteOfferCount!==1 || seen.offer.size!==expected.size)
    throw new Error('There must be exactly one approved site checkout');
  if (!Array.isArray(registry.known_conflicts)
      || !registry.known_conflicts.some(x=>x.payment_link_id==='plink_1UR1CAFKGbk21LK5Z02t1ITK'
         && x.actual_price_minor===700 && x.link_active===false))
    throw new Error('Misleading $7 PDF link must remain quarantined');
  return {checked_offers:seen.offer.size,site_checkout_offer:'MLS-497',
    production_release_approved:false,webhook_fulfillment_verified:false,
    observed_snapshot_not_live_health:true};
}

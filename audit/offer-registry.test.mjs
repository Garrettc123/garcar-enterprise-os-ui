import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateObservedStripeOffers} from './validate-offer-registry.mjs';
import {REVIEW_CHECKOUT_BASE,isExpectedReviewCheckoutUrl} from '../checkout-validation.mjs';

const snapshot=JSON.parse(readFileSync(new URL('./stripe-offer-registry-2026-11-17.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(snapshot);
const mustReject=(fn)=>assert.throws(fn,Error);
const ok=validateObservedStripeOffers(snapshot,REVIEW_CHECKOUT_BASE);
assert.equal(ok.checked_offers,4);
assert.equal(ok.production_release_approved,false);
assert.equal(ok.webhook_fulfillment_verified,false);
assert.equal(snapshot.offers.filter(x=>x.site_checkout_allowed).length,1);
assert.equal(snapshot.offers.find(x=>x.offer_id==='MLS-497').price_type,'one_time');
assert.equal(snapshot.offers.find(x=>x.offer_id==='RRS-497-WEEK').price_type,'recurring');
assert.equal(snapshot.offers.find(x=>x.offer_id==='RRS-497-WEEK').billing_interval,'week');
assert.equal(snapshot.offers.find(x=>x.offer_id==='AGE-1497-MO').billing_interval,'month');
assert.equal(snapshot.offers.find(x=>x.offer_id==='LLA-47-48H').link_active,false);

const sampleLead='lead_'+'a'.repeat(32);
assert.equal(isExpectedReviewCheckoutUrl(REVIEW_CHECKOUT_BASE+'?client_reference_id='+sampleLead,sampleLead),true);
for(const row of snapshot.offers.filter(x=>x.offer_id!=='MLS-497')){
  assert.equal(isExpectedReviewCheckoutUrl(row.payment_link_url+'?client_reference_id='+sampleLead,sampleLead),false);
}

{
 const x=copy();x.offers.find(z=>z.offer_id==='RRS-497-WEEK').site_checkout_allowed=true;
 mustReject(()=>validateObservedStripeOffers(x,REVIEW_CHECKOUT_BASE));
}
{
 const x=copy();x.offers.find(z=>z.offer_id==='MLS-497').price_type='recurring';
 mustReject(()=>validateObservedStripeOffers(x,REVIEW_CHECKOUT_BASE));
}
{
 const x=copy();x.offers.find(z=>z.offer_id==='AGE-1497-MO').billing_interval='week';
 mustReject(()=>validateObservedStripeOffers(x,REVIEW_CHECKOUT_BASE));
}
{
 const x=copy();x.offers.find(z=>z.offer_id==='LLA-47-48H').link_active=true;
 mustReject(()=>validateObservedStripeOffers(x,REVIEW_CHECKOUT_BASE));
}
{
 const x=copy();x.offers[0].price_id=x.offers[1].price_id;
 mustReject(()=>validateObservedStripeOffers(x,REVIEW_CHECKOUT_BASE));
}
{
 const x=copy();x.offers[0].payment_link_url='https://buy.stripe.com.evil.example/fake';
 mustReject(()=>validateObservedStripeOffers(x,REVIEW_CHECKOUT_BASE));
}
{
 const x=copy();x.offers[0].payment_link_url=x.offers[0].payment_link_url+'?sku=weekly';
 mustReject(()=>validateObservedStripeOffers(x,REVIEW_CHECKOUT_BASE));
}
{
 const x=copy();x.offers[0].fulfillment_verified=true;
 mustReject(()=>validateObservedStripeOffers(x,REVIEW_CHECKOUT_BASE));
}
{
 const x=copy();x.policy.require_signed_webhook_and_durable_receipt=false;
 mustReject(()=>validateObservedStripeOffers(x,REVIEW_CHECKOUT_BASE));
}
{
 const x=copy();x.known_conflicts=[];
 mustReject(()=>validateObservedStripeOffers(x,REVIEW_CHECKOUT_BASE));
}

const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const start=readFileSync(new URL('../start.html',import.meta.url),'utf8');
assert.equal((home.match(/buy\.stripe\.com/g)||[]).length,1,'Homepage must not expose more Stripe options');
assert(home.includes(REVIEW_CHECKOUT_BASE));
assert(server.includes('isExpectedReviewCheckoutUrl(data.checkout_url,data.lead_id)'), 'Backend must validate exact checkout');
assert(start.includes('does not confirm payment'), 'Do not imply checkout redirect confirms payment');
assert(!server.includes("'/api/upload'"), 'Do not claim a nonexistent authenticated CSV upload endpoint');
console.log('PASS: observed Stripe offer registry checked; no $47 service checkout or recurring-plan substitution approved');

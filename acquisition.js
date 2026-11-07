const form = document.querySelector('#acquisition-form');
const feedback = document.querySelector('#acquisition-result');
const submit = form?.querySelector('button[type="submit"]');

if (form && feedback) {
  const params = new URLSearchParams(window.location.search);
  const safeTag = (name) => {
    const value = (params.get(name) || '').slice(0,80);
    return /^[a-z0-9_-]*$/i.test(value) ? value : '';
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (submit) { submit.disabled = true; submit.textContent = 'SECURING YOUR INQUIRY…'; }
    feedback.textContent = 'Submitting your request securely.';
    const values = Object.fromEntries(new FormData(form));
    const body = {
      company: values.company || '', full_name: values.full_name || '',
      email: values.email || '', crm: values.crm || 'unsure',
      contact_permission: values.contact_permission === 'on',
      marketing_consent: values.marketing_consent === 'on',
      company_website_fax: values.company_website_fax || '',
      utm_source: safeTag('utm_source'),
      utm_medium: safeTag('utm_medium'),
      utm_campaign: safeTag('utm_campaign')
    };
    try {
      const response = await fetch('/api/acquisition', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok || data.accepted !== true)
        throw new Error('We could not record your inquiry. Please try again or contact support.');
      const message = document.createElement('p');
      message.textContent = 'Your request was received. No payment has been taken, and no automated message has been sent.';
      const link = document.createElement('a');
      link.textContent = 'Continue to secure $497 Stripe checkout ↗';
      if (!String(data.checkout_url || '').startsWith('https://buy.stripe.com/'))
        throw new Error('Payment checkout is currently unavailable.');
      link.href = data.checkout_url;
      link.rel = 'noopener noreferrer';
      feedback.replaceChildren(message, link);
      form.reset();
    } catch (error) {
      feedback.textContent = error.message || 'Could not submit your request.';
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = 'REQUEST MY REVIEW'; }
    }
  });
}

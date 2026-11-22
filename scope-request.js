'use strict';
(() => {
  const form = document.getElementById('scope-form');
  const preview = document.getElementById('scope-preview');
  const emailLink = document.getElementById('scope-email-link');
  const status = document.getElementById('scope-status');
  if (!form || !preview || !emailLink || !status) return;

  const categories = Object.freeze({
    agents: 'AI agents and orchestration',
    automation: 'Business and CRM automation',
    infrastructure: 'Developer APIs and infrastructure',
    licensing: 'Software licensing and delivery'
  });
  const timelines = Object.freeze({
    exploring: 'Exploring options',
    thirty: 'Within 30 days',
    ninety: 'Within 90 days',
    flexible: 'Flexible'
  });
  const value = name => String(form.elements.namedItem(name)?.value || '').trim();
  const clear = () => {
    emailLink.hidden = true;
    emailLink.removeAttribute('href');
    preview.value = '';
    status.textContent = '';
  };
  form.addEventListener('input', clear);
  form.addEventListener('change', clear);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const service = categories[value('service')];
    const timeline = timelines[value('timeline')];
    const outcome = value('outcome');
    if (!service || !timeline || !outcome || outcome.length > 700) {
      clear();
      status.textContent = 'Select a service, timeline and describe the intended result.';
      return;
    }
    const organization = value('organization').slice(0, 120);
    const tools = value('tools').slice(0, 160);
    const body = [
      'Garcar Enterprise — custom project scope request',
      '',
      'Service: ' + service,
      'Organization: ' + (organization || 'Not provided'),
      'Current tools: ' + (tools || 'Not provided'),
      'Target timeline: ' + timeline,
      'Desired business outcome:',
      outcome,
      '',
      'Please reply to discuss feasibility, acceptance criteria and a written scope.',
      'No credentials, customer records or confidential files are attached.'
    ].join('\n');
    preview.value = body;
    emailLink.href = 'mailto:gwc2780@gmail.com?subject=' +
      encodeURIComponent('Garcar Enterprise scope request — ' + service) +
      '&body=' + encodeURIComponent(body);
    emailLink.hidden = false;
    status.textContent = 'Draft prepared locally. Review it, then choose whether to open your email app. Nothing was sent.';
  });
})();

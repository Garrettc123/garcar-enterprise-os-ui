'use strict';
(() => {
  const search = document.getElementById('directory-search');
  const category = document.getElementById('directory-category');
  const status = document.getElementById('directory-status');
  const reset = document.getElementById('directory-reset');
  const count = document.getElementById('directory-results');
  const empty = document.getElementById('directory-empty');
  const cards = Array.from(document.querySelectorAll('#directory-grid .directory-card'));
  if (!search || !category || !status || !reset || !count || !empty || !cards.length) return;
  const normalize = value => String(value || '').toLocaleLowerCase('en-US').trim();
  const update = () => {
    const q = normalize(search.value);
    let visible = 0;
    for (const card of cards) {
      const matchesText = !q || normalize(card.textContent).includes(q);
      const matchesCategory = category.value === 'all' || (card.dataset.category || '').split(/\s+/).includes(category.value);
      const matchesStatus = status.value === 'all' || card.dataset.status === status.value;
      card.hidden = !(matchesText && matchesCategory && matchesStatus);
      if (!card.hidden) visible++;
    }
    count.textContent = visible + (visible === 1 ? ' entry' : ' entries') + ' shown of ' + cards.length;
    empty.hidden = visible !== 0;
  };
  search.addEventListener('input', update);
  category.addEventListener('change', update);
  status.addEventListener('change', update);
  reset.addEventListener('click', () => { search.value=''; category.value='all'; status.value='all'; update(); search.focus(); });
  update();
})();
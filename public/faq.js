/* Progressive enhancement: all answers remain in the HTML and native details work without JavaScript. */
(() => {
  const input = document.querySelector('#faq-search');
  const tools = document.querySelector('.faq-tools');
  if (!input || !tools) return;
  const items = [...document.querySelectorAll('.faq-item')];
  const categories = [...document.querySelectorAll('.faq-category')];
  const count = document.querySelector('#faq-count');
  const empty = document.querySelector('#faq-empty');
  let previousOpen = null;
  const filter = () => {
    const words = input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (words.length && !previousOpen) previousOpen = new Set(items.filter(item => item.open));
    let matches = 0;
    for (const item of items) {
      const text = item.textContent.toLocaleLowerCase();
      item.hidden = !words.every(word => text.includes(word));
      if (!item.hidden) matches++;
      if (words.length) item.open = !item.hidden;
      else if (previousOpen) item.open = previousOpen.has(item);
    }
    if (!words.length) previousOpen = null;
    for (const category of categories) category.hidden = ![...category.querySelectorAll('.faq-item')].some(item => !item.hidden);
    count.textContent = words.length ? `${matches} of ${items.length} answers match.` : `${items.length} answers. Choose a topic or type to search.`;
    empty.hidden = matches !== 0;
  };
  const revealHash = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target || (!target.matches('.faq-item') && !target.closest('.faq-category'))) return;
    input.value = '';
    filter();
    const item = target.closest('.faq-item');
    if (item) item.open = true;
    target.scrollIntoView();
  };
  input.addEventListener('input', filter);
  document.querySelector('#faq-clear').addEventListener('click', () => { input.value = ''; filter(); input.focus(); });
  window.addEventListener('hashchange', revealHash);
  document.querySelector('.toc').addEventListener('click', () => { input.value = ''; filter(); });
  tools.hidden = false;
  filter();
  revealHash();
})();

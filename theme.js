(() => {
  const key = 'mitinta-theme';
  const apply = (theme) => {
    const value = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = value;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = value === 'dark' ? '#151518' : '#ffffff';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(value === 'dark'));
    });
    window.dispatchEvent(new Event('mitinta-theme-change'));
  };
  try { apply(localStorage.getItem(key)); } catch { apply('light'); }
  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-theme-toggle]')) return;
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(key, next); } catch { /* Theme still works without storage. */ }
    apply(next);
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(event.newValue);
  });
})();

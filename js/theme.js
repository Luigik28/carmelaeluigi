document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('[data-theme-toggle]');
  if (!toggle) return;
  const updateIcon = () => {
    toggle.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '☾';
  };
  updateIcon();
  toggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateIcon();
  });
});

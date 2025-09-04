// Simple dark/light theme toggle shared across pages
(function(){
  try {
    const KEY = 'nafez:theme';
    const btn = document.getElementById('themeToggle');
    const sw = document.getElementById('themeSwitch');
    const root = document.documentElement; // <html>
    const label = document.getElementById('themeLabel');

    function applyTheme(t){
      if (t === 'light') {
        root.classList.add('theme-light');
        if (btn) btn.textContent = 'Light';
        if (sw) sw.checked = true;
      } else {
        root.classList.remove('theme-light');
        if (btn) btn.textContent = 'Dark';
        if (sw) sw.checked = false;
        if (label) label.textContent = 'Dark';
      }
    }

    // Page title normalization for some shells/encodings
    try {
      if (location && typeof location.pathname === 'string') {
        if (location.pathname.endsWith('/alpha/home')) document.title = 'Nafez Alpha - Home';
      }
    } catch(_){}

    // Initial theme
    let theme = localStorage.getItem(KEY);
    if (!theme) {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    applyTheme(theme);
    if (label) label.textContent = (theme === 'light' ? 'Light' : 'Dark');

    // Toggle action
    if (btn) {
      btn.addEventListener('click', function(){
        theme = (root.classList.contains('theme-light') ? 'dark' : 'light');
        localStorage.setItem(KEY, theme);
        applyTheme(theme);
      });
    }
    if (sw) {
      sw.addEventListener('change', function(){
        theme = this.checked ? 'light' : 'dark';
        localStorage.setItem(KEY, theme);
        applyTheme(theme);
      });
    }
    if (label) {
      label.addEventListener('click', function(){
        theme = (root.classList.contains('theme-light') ? 'dark' : 'light');
        localStorage.setItem(KEY, theme);
        applyTheme(theme);
      });
    }
  } catch(_){}
})();

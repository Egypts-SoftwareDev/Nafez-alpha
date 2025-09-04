// Simple dark/light theme toggle shared across pages
(function(){
  try {
    const KEY = 'nafez:theme';
    const btn = document.getElementById('themeToggle');
    const sw = document.getElementById('themeSwitch');
    const root = document.documentElement; // <html>

    function applyTheme(t){
      if (t === 'light') {
        root.classList.add('theme-light');
        if (btn) btn.textContent = 'Light';
        if (sw) sw.checked = true;
      } else {
        root.classList.remove('theme-light');
        if (btn) btn.textContent = 'Dark';
        if (sw) sw.checked = false;
      }
    }

    // Initial theme
    let theme = localStorage.getItem(KEY);
    if (!theme) {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    applyTheme(theme);

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
  } catch(_){}
})();
